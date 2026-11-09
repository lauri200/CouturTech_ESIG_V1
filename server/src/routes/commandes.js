const express = require('express');
const { z } = require('zod');
const { query, tx } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { parse, notFound, forbidden, conflict, badRequest } = require('../utils/errors');
const { todayISO, addDays, frDate, fcfa } = require('../utils/dates');
const { peutTransiter, statutPaiement, LIBELLES } = require('../services/statuts');
const { prochainNumero } = require('../services/numero');
const { getParams } = require('../services/params');
const { notifier, getGerants, getUser } = require('../services/notifications');
const { genererPdf } = require('../services/pdf');
const { mouvementStock, alerterStockBas, TAILLES } = require('./catalogue');

const router = express.Router();
router.use(authenticate);

const BASE = `
  SELECT c.*, m.nom AS modele_nom, m.reference AS modele_reference, m.categorie AS modele_categorie,
    (SELECT url FROM modele_photo p WHERE p.modele_id = m.id ORDER BY ordre LIMIT 1) AS modele_photo,
    t.nom AS tissu_nom, t.type AS tissu_type, t.photo_url AS tissu_photo, t.prix_metre AS tissu_prix_metre,
    cl.nom AS client_nom, cl.prenom AS client_prenom, cl.telephone AS client_telephone, cl.email AS client_email,
    ta.prenom || ' ' || ta.nom AS tailleur_nom,
    co.id AS collecte_id, co.statut AS collecte_statut,
    (c.deadline IS NOT NULL AND c.deadline < CURRENT_DATE AND c.statut IN ('ATTRIBUEE','EN_CONFECTION')) AS en_retard,
    (c.total - c.montant_paye) AS reste_a_payer
  FROM commande c
  JOIN modele m ON m.id = c.modele_id
  JOIN utilisateur cl ON cl.id = c.client_id
  LEFT JOIN tissu t ON t.id = c.tissu_id
  LEFT JOIN utilisateur ta ON ta.id = c.tailleur_id
  LEFT JOIN collecte co ON co.commande_id = c.id`;

// RG13 : le tailleur ne voit ni prix, ni téléphone, ni adresse, ni e-mail du client.
const CHAMPS_TAILLEUR = ['id', 'numero', 'modele_id', 'modele_nom', 'modele_reference', 'modele_categorie', 'modele_photo', 'taille', 'source_tissu',
  'tissu_nom', 'tissu_type', 'tissu_photo', 'description_tissu_client', 'photo_tissu_client_url', 'metrage', 'statut', 'deadline',
  'note_tailleur', 'notes_retouches', 'en_retard', 'created_at', 'updated_at'];
function vuePourRole(cmd, user) {
  if (user.role !== 'TAILLEUR') return cmd;
  const out = Object.fromEntries(CHAMPS_TAILLEUR.map((k) => [k, cmd[k]]));
  out.client_prenom = cmd.client_prenom;
  return out;
}

async function chargerCommande(id, db = { query }, lock = false) {
  if (lock) await db.query('SELECT id FROM commande WHERE id = $1 FOR UPDATE', [id]);
  const { rows } = await db.query(`${BASE} WHERE c.id = $1`, [id]);
  if (!rows[0]) throw notFound('Commande introuvable.');
  return rows[0];
}

function verifierAcces(cmd, user) {
  if (user.role === 'GERANT') return;
  if (user.role === 'CLIENT' && cmd.client_id === user.id) return;
  if (user.role === 'TAILLEUR' && cmd.tailleur_id === user.id) return;
  throw forbidden('Vous n’avez pas accès à cette commande.');
}

async function changerStatut(db, cmd, vers, userId, motif = null) {
  if (!peutTransiter(cmd.statut, vers)) {
    throw conflict(`Transition interdite : ${LIBELLES[cmd.statut]} → ${LIBELLES[vers]}.`);
  }
  await db.query('UPDATE commande SET statut = $2, updated_at = now() WHERE id = $1', [cmd.id, vers]);
  await db.query('INSERT INTO historique_statut (commande_id, ancien_statut, nouveau_statut, utilisateur_id, motif) VALUES ($1,$2,$3,$4,$5)', [cmd.id, cmd.statut, vers, userId, motif]);
  cmd.statut = vers;
}

async function creerDocument(db, cmd, type) {
  const exist = await db.query('SELECT * FROM facture WHERE commande_id = $1 AND type = $2', [cmd.id, type]);
  if (exist.rows[0]) return exist.rows[0];
  const numero = await prochainNumero(db, type === 'DEVIS' ? 'DEV' : 'FAC');
  const { rows } = await db.query('INSERT INTO facture (commande_id, type, numero, montant_total) VALUES ($1,$2,$3,$4) RETURNING *', [cmd.id, type, numero, cmd.total]);
  return rows[0];
}

// ---- Création (RG1 à RG5) ----
const creationSchema = z.object({
  modele_id: z.coerce.number().int().positive(),
  taille: z.enum(TAILLES, { message: 'Choisissez une taille.' }),
  source_tissu: z.enum(['MAISON', 'CLIENT'], { message: 'Choisissez un tissu.' }),
  tissu_id: z.coerce.number().int().positive().optional().nullable(),
  description_tissu_client: z.string().trim().max(500).optional().nullable(),
  photo_tissu_client_url: z.string().trim().max(300).optional().nullable(),
  collecte: z.object({
    adresse: z.string().trim().min(1, 'Adresse obligatoire').max(200),
    quartier: z.string().trim().min(1, 'Quartier obligatoire').max(80),
    repere: z.string().trim().max(200).optional().default(''),
    telephone: z.string().trim().regex(/^\+228\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/, 'Format attendu : +228 XX XX XX XX'),
    date_souhaitee: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date obligatoire'),
    creneau_souhaite: z.string().trim().min(1, 'Créneau obligatoire').max(20),
  }).optional(),
});

router.post('/', requireRole('CLIENT'), async (req, res) => {
  const d = parse(creationSchema, req.body);
  const cle = (req.get('Idempotency-Key') || '').slice(0, 80) || null;
  if (cle) {
    const ex = await query('SELECT id FROM commande WHERE client_id = $1 AND idempotency_key = $2', [req.user.id, cle]);
    if (ex.rows[0]) return res.status(200).json(await chargerCommande(ex.rows[0].id));
  }
  if (d.source_tissu === 'MAISON' && !d.tissu_id) throw badRequest('Choisissez un tissu de la maison.');
  if (d.source_tissu === 'CLIENT') {
    if (!d.description_tissu_client) throw badRequest('Décrivez votre tissu (type, couleur, longueur).');
    if (!d.collecte) throw badRequest('Indiquez l’adresse de collecte.');
    if (d.collecte.date_souhaitee < todayISO()) throw badRequest('La date de collecte doit être aujourd’hui ou plus tard.');
  }
  const params = await getParams();
  let stockBas = null;
  const id = await tx(async (db) => {
    const m = (await db.query('SELECT * FROM modele WHERE id = $1 AND actif', [d.modele_id])).rows[0];
    if (!m) throw badRequest('Modèle indisponible.');
    const mm = (await db.query('SELECT metres FROM modele_metrage WHERE modele_id = $1 AND taille = $2', [m.id, d.taille])).rows[0];
    if (!mm) throw badRequest('Cette taille n’est pas proposée pour ce modèle.');
    const metrage = mm.metres;
    let prixTissu = 0;
    let tissu = null;
    if (d.source_tissu === 'MAISON') {
      tissu = (await db.query('SELECT * FROM tissu WHERE id = $1 AND actif FOR UPDATE', [d.tissu_id])).rows[0];
      if (!tissu) throw badRequest('Tissu indisponible.');
      if (tissu.stock_metres < metrage) throw conflict(`Stock insuffisant pour ce tissu (${metrage} m nécessaires).`);
      prixTissu = Math.round(tissu.prix_metre * metrage);
    }
    const frais = d.source_tissu === 'CLIENT' ? Number(params.FRAIS_COLLECTE) || 0 : 0;
    const total = m.prix_confection + prixTissu + frais;
    const numero = await prochainNumero(db, 'CMD');
    const debut = todayISO();
    const statut = d.source_tissu === 'CLIENT' ? 'EN_ATTENTE_COLLECTE' : 'CONFIRMEE';
    const { rows } = await db.query(
      `INSERT INTO commande (numero, client_id, modele_id, taille, source_tissu, tissu_id, description_tissu_client, photo_tissu_client_url,
        metrage, prix_confection, prix_tissu, frais_collecte, total, statut, date_debut, date_remise_prevue, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
      [numero, req.user.id, m.id, d.taille, d.source_tissu, tissu ? tissu.id : null, d.source_tissu === 'CLIENT' ? d.description_tissu_client : null,
        d.source_tissu === 'CLIENT' ? d.photo_tissu_client_url || null : null, metrage, m.prix_confection, prixTissu, frais, total, statut,
        debut, addDays(debut, m.delai_jours), cle],
    );
    const cid = rows[0].id;
    await db.query("INSERT INTO historique_statut (commande_id, ancien_statut, nouveau_statut, utilisateur_id) VALUES ($1, NULL, 'CONFIRMEE', $2)", [cid, req.user.id]);
    if (statut === 'EN_ATTENTE_COLLECTE') {
      await db.query("INSERT INTO historique_statut (commande_id, ancien_statut, nouveau_statut, utilisateur_id) VALUES ($1, 'CONFIRMEE', 'EN_ATTENTE_COLLECTE', $2)", [cid, req.user.id]);
      const c = d.collecte;
      await db.query('INSERT INTO collecte (commande_id, adresse, quartier, repere, telephone, date_souhaitee, creneau_souhaite) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [cid, c.adresse, c.quartier, c.repere, c.telephone, c.date_souhaitee, c.creneau_souhaite]);
    } else {
      const r = await mouvementStock(db, { tissuId: tissu.id, type: 'SORTIE', metres: metrage, motif: `Réservation commande ${numero}`, commandeId: cid, userId: req.user.id });
      if (r.alerteStockBas) stockBas = r.tissu;
    }
    await creerDocument(db, { id: cid, total }, 'DEVIS');
    return cid;
  }).catch(async (e) => {
    if (e.code === '23505' && cle) {
      const ex = await query('SELECT id FROM commande WHERE client_id = $1 AND idempotency_key = $2', [req.user.id, cle]);
      if (ex.rows[0]) return ex.rows[0].id;
    }
    throw e;
  });
  const cmd = await chargerCommande(id);
  if (stockBas) await alerterStockBas(stockBas);
  const gerants = await getGerants();
  await notifier('N01', [
    { user: req.user, canaux: ['EMAIL', 'INAPP'] },
    ...gerants.map((g) => ({ user: g, canaux: ['INAPP'] })),
  ], { numero: cmd.numero, modele: cmd.modele_nom, taille: cmd.taille, total: fcfa(cmd.total), date: frDate(cmd.date_remise_prevue) }, id);
  res.status(201).json(cmd);
});

// ---- Consultation ----
router.get('/', requireRole('CLIENT', 'GERANT', 'TAILLEUR'), async (req, res) => {
  const where = [];
  const p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replaceAll('?', `$${p.length}`)); };
  if (req.user.role === 'CLIENT') add('c.client_id = ?', req.user.id);
  if (req.user.role === 'TAILLEUR') add('c.tailleur_id = ?', req.user.id);
  if (req.query.statut) add('c.statut = ANY(?)', String(req.query.statut).split(','));
  if (req.user.role === 'GERANT') {
    if (req.query.tailleur_id) add('c.tailleur_id = ?', Number(req.query.tailleur_id));
    if (req.query.q) add("(c.numero ILIKE ? OR (cl.prenom || ' ' || cl.nom) ILIKE ? OR m.nom ILIKE ?)", `%${req.query.q}%`);
    if (req.query.du) add('c.created_at::date >= ?', req.query.du);
    if (req.query.au) add('c.created_at::date <= ?', req.query.au);
    if (req.query.paiement) add('c.statut_paiement = ?', req.query.paiement);
  }
  if (req.query.retard === '1') where.push("c.deadline < CURRENT_DATE AND c.statut IN ('ATTRIBUEE','EN_CONFECTION')");
  const ordre = req.user.role === 'TAILLEUR' ? 'c.deadline ASC NULLS LAST, c.id' : 'c.created_at DESC, c.id DESC';
  const { rows } = await query(`${BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${ordre} LIMIT 500`, p);
  res.json(rows.map((r) => vuePourRole(r, req.user)));
});

router.get('/:id', async (req, res) => {
  const cmd = await chargerCommande(Number(req.params.id));
  verifierAcces(cmd, req.user);
  const hist = await query(
    `SELECT h.*, u.prenom || ' ' || u.nom AS auteur, u.role AS auteur_role FROM historique_statut h LEFT JOIN utilisateur u ON u.id = h.utilisateur_id
     WHERE h.commande_id = $1 ORDER BY h.created_at, h.id`, [cmd.id]);
  const out = vuePourRole(cmd, req.user);
  out.historique = hist.rows.map((h) => (req.user.role === 'TAILLEUR' ? { ...h, auteur: undefined } : h));
  if (req.user.role !== 'TAILLEUR') {
    out.collecte = (await query(
      `SELECT co.*, l.prenom || ' ' || l.nom AS livreur_nom FROM collecte co LEFT JOIN utilisateur l ON l.id = co.livreur_id WHERE co.commande_id = $1`, [cmd.id])).rows[0] || null;
    out.paiements = (await query('SELECT * FROM paiement WHERE commande_id = $1 ORDER BY date_paiement, id', [cmd.id])).rows;
    out.documents = (await query('SELECT id, type, numero, montant_total, created_at FROM facture WHERE commande_id = $1 ORDER BY id', [cmd.id])).rows;
  }
  res.json(out);
});

// ---- Attribution (RG6, RG7) ----
router.post('/:id/attribuer', requireRole('GERANT'), async (req, res) => {
  const d = parse(z.object({
    tailleur_id: z.coerce.number().int().positive({ message: 'Choisissez un tailleur.' }),
    deadline: z.string({ message: 'La deadline est obligatoire.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'La deadline est obligatoire.'),
  }), req.body);
  const cmd = await tx(async (db) => {
    const c = await chargerCommande(Number(req.params.id), db, true);
    if (c.source_tissu === 'CLIENT' && c.statut !== 'TISSU_RECU') throw conflict('Le tissu du client n’est pas encore arrivé à l’atelier.');
    if (!['CONFIRMEE', 'TISSU_RECU'].includes(c.statut)) throw conflict(`Attribution impossible au statut ${LIBELLES[c.statut]}.`);
    const t = (await db.query("SELECT id FROM utilisateur WHERE id = $1 AND role = 'TAILLEUR' AND actif", [d.tailleur_id])).rows[0];
    if (!t) throw badRequest('Tailleur introuvable ou inactif.');
    if (d.deadline < todayISO()) throw badRequest('La deadline ne peut pas être dans le passé.');
    if (c.date_remise_prevue && d.deadline > c.date_remise_prevue) throw badRequest(`La deadline doit être au plus tard le ${frDate(c.date_remise_prevue)} (date de remise prévue).`);
    const pct = Number((await getParams(db)).ACOMPTE_POURCENT) || 0;
    const acompteMin = Math.ceil((c.total * pct) / 100);
    if (c.montant_paye < acompteMin) throw conflict(`Acompte de ${pct} % requis avant la confection : ${fcfa(acompteMin)} minimum, ${fcfa(c.montant_paye)} payé.`);
    await db.query('UPDATE commande SET tailleur_id = $2, deadline = $3, alerte_delai_envoyee = FALSE, retard_notifie = FALSE WHERE id = $1', [c.id, d.tailleur_id, d.deadline]);
    await changerStatut(db, c, 'ATTRIBUEE', req.user.id, `Deadline : ${frDate(d.deadline)}`);
    return chargerCommande(c.id, db);
  });
  await notifier('N04', [{ user: await getUser(cmd.tailleur_id), canaux: ['INAPP', 'SMS'] }],
    { numero: cmd.numero, modele: cmd.modele_nom, taille: cmd.taille, deadline: frDate(cmd.deadline) }, cmd.id);
  res.json(cmd);
});

// ---- Modification de deadline / date de remise (RG7) ----
router.patch('/:id/deadline', requireRole('GERANT'), async (req, res) => {
  const d = parse(z.object({
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_remise_prevue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    motif: z.string().trim().min(1, 'Le motif est obligatoire.').max(300),
  }), req.body);
  let ancienneRemise;
  const cmd = await tx(async (db) => {
    const c = await chargerCommande(Number(req.params.id), db, true);
    if (['RETIREE', 'ANNULEE'].includes(c.statut)) throw conflict('Commande clôturée.');
    ancienneRemise = c.date_remise_prevue;
    const remise = d.date_remise_prevue || c.date_remise_prevue;
    const deadline = d.deadline || c.deadline;
    if (deadline && remise && deadline > remise) throw badRequest('La deadline ne peut pas dépasser la date de remise prévue.');
    await db.query('UPDATE commande SET deadline = $2, date_remise_prevue = $3, alerte_delai_envoyee = CASE WHEN $2::date IS DISTINCT FROM deadline THEN FALSE ELSE alerte_delai_envoyee END, retard_notifie = CASE WHEN $2::date IS DISTINCT FROM deadline THEN FALSE ELSE retard_notifie END, updated_at = now() WHERE id = $1', [c.id, deadline, remise]);
    const lib = [d.deadline && `deadline ${frDate(c.deadline)} → ${frDate(deadline)}`, d.date_remise_prevue && `remise ${frDate(c.date_remise_prevue)} → ${frDate(remise)}`].filter(Boolean).join(', ');
    await db.query('INSERT INTO historique_statut (commande_id, ancien_statut, nouveau_statut, utilisateur_id, motif) VALUES ($1,$2,$2,$3,$4)', [c.id, c.statut, req.user.id, `Date modifiée (${lib}) : ${d.motif}`]);
    return chargerCommande(c.id, db);
  });
  if (cmd.date_remise_prevue !== ancienneRemise) {
    await notifier('N07', [{ user: await getUser(cmd.client_id), canaux: ['EMAIL', 'INAPP'] }], { numero: cmd.numero, date: frDate(cmd.date_remise_prevue), motif: d.motif }, cmd.id);
  }
  res.json(cmd);
});

// ---- Avancement (RG10 à RG12) ----
router.patch('/:id/statut', requireRole('GERANT', 'TAILLEUR'), async (req, res) => {
  const d = parse(z.object({
    statut: z.enum(['EN_CONFECTION', 'PRETE', 'EN_ESSAYAGE', 'RETIREE']),
    notes_retouches: z.string().trim().max(1000).optional(),
  }), req.body);
  const params = await getParams();
  const cmd = await tx(async (db) => {
    const c = await chargerCommande(Number(req.params.id), db, true);
    if (req.user.role === 'TAILLEUR') {
      if (c.tailleur_id !== req.user.id) throw forbidden('Cette tâche ne vous est pas attribuée.');
      if (!['EN_CONFECTION', 'PRETE'].includes(d.statut)) throw forbidden('Action réservée au gérant.');
    }
    if (d.statut === 'RETIREE' && c.statut === 'EN_ESSAYAGE' && c.statut_paiement !== 'SOLDE') {
      throw conflict(`Solde non réglé : reste ${fcfa(c.total - c.montant_paye)} à encaisser avant le retrait.`);
    }
    await changerStatut(db, c, d.statut, req.user.id);
    if (d.notes_retouches !== undefined) await db.query('UPDATE commande SET notes_retouches = $2 WHERE id = $1', [c.id, d.notes_retouches]);
    if (d.statut === 'RETIREE') await creerDocument(db, c, 'FACTURE');
    return chargerCommande(c.id, db);
  });
  const client = await getUser(cmd.client_id);
  if (d.statut === 'PRETE') {
    const gerants = await getGerants();
    await notifier('N08', [
      { user: client, canaux: ['EMAIL', 'SMS', 'INAPP'] },
      ...gerants.map((g) => ({ user: g, canaux: ['INAPP'] })),
    ], { numero: cmd.numero, adresse: params.ADRESSE_ATELIER, horaires: params.HORAIRES_ATELIER, reste: fcfa(cmd.reste_a_payer) }, cmd.id);
  }
  if (d.statut === 'RETIREE') {
    await notifier('N09', [{ user: client, canaux: ['EMAIL', 'INAPP'] }], { numero: cmd.numero, lien: `${require('../config').appUrl}/client/commandes/${cmd.id}` }, cmd.id);
  }
  res.json(vuePourRole(cmd, req.user));
});

router.patch('/:id/notes', requireRole('GERANT', 'TAILLEUR'), async (req, res) => {
  const d = parse(z.object({ note_tailleur: z.string().trim().max(1000).optional(), notes_retouches: z.string().trim().max(1000).optional() }), req.body);
  const c = await chargerCommande(Number(req.params.id));
  if (req.user.role === 'TAILLEUR' && c.tailleur_id !== req.user.id) throw forbidden('Cette tâche ne vous est pas attribuée.');
  if (d.note_tailleur !== undefined) await query('UPDATE commande SET note_tailleur = $2 WHERE id = $1', [c.id, d.note_tailleur]);
  if (d.notes_retouches !== undefined && req.user.role === 'GERANT') await query('UPDATE commande SET notes_retouches = $2 WHERE id = $1', [c.id, d.notes_retouches]);
  res.json(vuePourRole(await chargerCommande(c.id), req.user));
});

// ---- Annulation (RG14) ----
router.post('/:id/annuler', requireRole('CLIENT', 'GERANT'), async (req, res) => {
  const d = parse(z.object({ motif: z.string().trim().max(300).optional() }), req.body);
  let stockBas = null;
  const cmd = await tx(async (db) => {
    const c = await chargerCommande(Number(req.params.id), db, true);
    verifierAcces(c, req.user);
    if (req.user.role === 'CLIENT') {
      const ok = c.statut === 'CONFIRMEE' || (c.statut === 'EN_ATTENTE_COLLECTE' && ['A_PLANIFIER', 'PLANIFIEE', 'ECHOUEE'].includes(c.collecte_statut));
      if (!ok) throw conflict('Annulation impossible : la confection a commencé ou votre tissu a été récupéré. Contactez la maison.');
    } else if (!d.motif) {
      throw badRequest('Le motif est obligatoire.');
    }
    await changerStatut(db, c, 'ANNULEE', req.user.id, d.motif || 'Annulée par le client');
    if (c.source_tissu === 'MAISON' && c.tissu_id) {
      const r = await mouvementStock(db, { tissuId: c.tissu_id, type: 'RETOUR', metres: c.metrage, motif: `Annulation ${c.numero}`, commandeId: c.id, userId: req.user.id });
      stockBas = r.tissu;
    }
    return chargerCommande(c.id, db);
  });
  void stockBas;
  const dest = [{ user: await getUser(cmd.client_id), canaux: ['EMAIL', 'INAPP'] }];
  if (cmd.tailleur_id) dest.push({ user: await getUser(cmd.tailleur_id), canaux: ['INAPP'] });
  if (req.user.role === 'CLIENT') (await getGerants()).forEach((g) => dest.push({ user: g, canaux: ['INAPP'] }));
  await notifier('N13', dest, { numero: cmd.numero, motif: d.motif || 'annulée par le client' }, cmd.id);
  res.json(cmd);
});

// ---- Paiements (RG15) ----
router.get('/:id/paiements', requireRole('CLIENT', 'GERANT'), async (req, res) => {
  const c = await chargerCommande(Number(req.params.id));
  verifierAcces(c, req.user);
  res.json((await query('SELECT * FROM paiement WHERE commande_id = $1 ORDER BY date_paiement, id', [c.id])).rows);
});

router.post('/:id/paiements', requireRole('GERANT'), async (req, res) => {
  const d = parse(z.object({
    montant: z.coerce.number().int().positive('Montant supérieur à 0'),
    mode: z.enum(['ESPECES', 'MOBILE_MONEY', 'AUTRE']),
    reference: z.string().trim().max(80).optional().default(''),
    date_paiement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }), req.body);
  const cmd = await tx(async (db) => {
    const c = await chargerCommande(Number(req.params.id), db, true);
    if (c.statut === 'ANNULEE') throw conflict('Commande annulée.');
    const reste = c.total - c.montant_paye;
    if (d.montant > reste) throw badRequest(`Montant supérieur au reste à payer (${fcfa(reste)}).`);
    await db.query('INSERT INTO paiement (commande_id, montant, mode, reference, date_paiement, enregistre_par) VALUES ($1,$2,$3,$4,$5,$6)',
      [c.id, d.montant, d.mode, d.reference || null, d.date_paiement || todayISO(), req.user.id]);
    const paye = c.montant_paye + d.montant;
    await db.query('UPDATE commande SET montant_paye = $2, statut_paiement = $3, updated_at = now() WHERE id = $1', [c.id, paye, statutPaiement(paye, c.total)]);
    return chargerCommande(c.id, db);
  });
  res.status(201).json(cmd);
});

// ---- Devis / facture PDF ----
async function envoyerPdf(req, res, type) {
  const c = await chargerCommande(Number(req.params.id));
  verifierAcces(c, req.user);
  const docRow = (await query('SELECT * FROM facture WHERE commande_id = $1 AND type = $2', [c.id, type])).rows[0];
  if (!docRow) throw notFound(type === 'DEVIS' ? 'Devis introuvable.' : 'La facture est disponible après le retrait.');
  const paiements = (await query('SELECT * FROM paiement WHERE commande_id = $1 ORDER BY date_paiement, id', [c.id])).rows;
  const pdf = await genererPdf({ type, numero: docRow.numero, date: docRow.created_at, commande: c, params: await getParams(), paiements: type === 'FACTURE' ? paiements : [] });
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${type === 'DEVIS' ? 'devis' : 'facture'}-${c.numero}.pdf"`);
  res.send(pdf);
}
router.get('/:id/devis.pdf', requireRole('CLIENT', 'GERANT'), (req, res) => envoyerPdf(req, res, 'DEVIS'));
router.get('/:id/facture.pdf', requireRole('CLIENT', 'GERANT'), (req, res) => envoyerPdf(req, res, 'FACTURE'));

module.exports = { router, chargerCommande, changerStatut };
