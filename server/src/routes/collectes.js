const express = require('express');
const { z } = require('zod');
const { query, tx } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { parse, notFound, forbidden, conflict, badRequest } = require('../utils/errors');
const { frDate, todayISO } = require('../utils/dates');
const { notifier, getGerants, getUser } = require('../services/notifications');
const { chargerCommande, changerStatut } = require('./commandes');

const router = express.Router();
router.use(authenticate, requireRole('GERANT', 'LIVREUR'));

const BASE = `
  SELECT co.*, c.numero, c.statut AS commande_statut, c.description_tissu_client, c.photo_tissu_client_url, c.client_id,
    cl.prenom || ' ' || cl.nom AS client_nom, l.prenom || ' ' || l.nom AS livreur_nom
  FROM collecte co JOIN commande c ON c.id = co.commande_id JOIN utilisateur cl ON cl.id = c.client_id
  LEFT JOIN utilisateur l ON l.id = co.livreur_id`;

const TRANSITIONS = {
  A_PLANIFIER: ['PLANIFIEE'],
  PLANIFIEE: ['PLANIFIEE', 'COLLECTEE', 'ECHOUEE'],
  ECHOUEE: ['PLANIFIEE'],
  COLLECTEE: ['REMISE_ATELIER'],
  REMISE_ATELIER: [],
};

// RG13 : après remise à l'atelier, le livreur ne voit plus les coordonnées du client.
function vue(co, user) {
  if (user.role === 'LIVREUR' && co.statut === 'REMISE_ATELIER') {
    return { ...co, adresse: '—', repere: null, telephone: '—', client_nom: co.client_nom.split(' ')[0] };
  }
  return co;
}

async function charger(id, db = { query }) {
  const { rows } = await db.query(`${BASE} WHERE co.id = $1`, [id]);
  if (!rows[0]) throw notFound('Collecte introuvable.');
  return rows[0];
}

router.get('/', async (req, res) => {
  const where = [];
  const p = [];
  if (req.user.role === 'LIVREUR') { p.push(req.user.id); where.push(`co.livreur_id = $${p.length}`); }
  if (req.query.statut) { p.push(String(req.query.statut).split(',')); where.push(`co.statut = ANY($${p.length})`); }
  if (req.query.date) { p.push(req.query.date); where.push(`co.date_prevue = $${p.length}`); }
  const { rows } = await query(`${BASE} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY CASE co.statut WHEN 'A_PLANIFIER' THEN 0 WHEN 'ECHOUEE' THEN 1 WHEN 'PLANIFIEE' THEN 2 WHEN 'COLLECTEE' THEN 3 ELSE 4 END, co.date_prevue NULLS FIRST, co.id`, p);
  res.json(rows.map((r) => vue(r, req.user)));
});

router.get('/:id', async (req, res) => {
  const co = await charger(Number(req.params.id));
  if (req.user.role === 'LIVREUR' && co.livreur_id !== req.user.id) throw forbidden('Cette collecte ne vous est pas affectée.');
  res.json(vue(co, req.user));
});

router.patch('/:id/planifier', requireRole('GERANT'), async (req, res) => {
  const d = parse(z.object({
    livreur_id: z.coerce.number().int().positive({ message: 'Choisissez un livreur.' }),
    date_prevue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date obligatoire'),
    creneau: z.string().trim().min(1, 'Créneau obligatoire').max(20),
  }), req.body);
  if (d.date_prevue < todayISO()) throw badRequest('La date de collecte ne peut pas être dans le passé.');
  const co = await tx(async (db) => {
    const c = (await db.query('SELECT * FROM collecte WHERE id = $1 FOR UPDATE', [Number(req.params.id)])).rows[0];
    if (!c) throw notFound('Collecte introuvable.');
    if (!TRANSITIONS[c.statut].includes('PLANIFIEE')) throw conflict('Cette collecte ne peut plus être planifiée.');
    const l = (await db.query("SELECT id FROM utilisateur WHERE id = $1 AND role = 'LIVREUR' AND actif", [d.livreur_id])).rows[0];
    if (!l) throw badRequest('Livreur introuvable ou inactif.');
    await db.query("UPDATE collecte SET livreur_id = $2, date_prevue = $3, creneau = $4, statut = 'PLANIFIEE', motif_echec = NULL WHERE id = $1", [c.id, d.livreur_id, d.date_prevue, d.creneau]);
    return charger(c.id, db);
  });
  await notifier('N02', [{ user: await getUser(co.client_id), canaux: ['EMAIL', 'SMS', 'INAPP'] }], { numero: co.numero, date: frDate(co.date_prevue), creneau: co.creneau }, co.commande_id);
  await notifier('N10', [{ user: await getUser(co.livreur_id), canaux: ['SMS', 'INAPP'] }],
    { numero: co.numero, adresse: `${co.adresse}, ${co.quartier}`, repere: co.repere || 'sans repère', date: frDate(co.date_prevue), creneau: co.creneau, telephone: co.telephone }, co.commande_id);
  res.json(co);
});

router.patch('/:id/statut', async (req, res) => {
  const d = parse(z.object({
    statut: z.enum(['COLLECTEE', 'ECHOUEE', 'REMISE_ATELIER']),
    motif: z.string().trim().max(300).optional(),
  }), req.body);
  if (d.statut === 'ECHOUEE' && !d.motif) throw badRequest('Indiquez le motif (client absent, injoignable…).');
  const co = await tx(async (db) => {
    const c = (await db.query('SELECT * FROM collecte WHERE id = $1 FOR UPDATE', [Number(req.params.id)])).rows[0];
    if (!c) throw notFound('Collecte introuvable.');
    if (req.user.role === 'LIVREUR' && c.livreur_id !== req.user.id) throw forbidden('Cette collecte ne vous est pas affectée.');
    if (!TRANSITIONS[c.statut].includes(d.statut)) throw conflict('Action impossible à ce stade de la collecte.');
    const set = { COLLECTEE: 'collectee_at = now()', REMISE_ATELIER: 'remise_at = now()', ECHOUEE: 'motif_echec = $3' }[d.statut];
    await db.query(`UPDATE collecte SET statut = $2, ${set} WHERE id = $1`, d.statut === 'ECHOUEE' ? [c.id, d.statut, d.motif] : [c.id, d.statut]);
    if (d.statut === 'REMISE_ATELIER') {
      const cmd = await chargerCommande(c.commande_id, db, true);
      await changerStatut(db, cmd, 'TISSU_RECU', req.user.id, 'Tissu remis à l’atelier');
    }
    return charger(c.id, db);
  });
  const client = await getUser(co.client_id);
  const gerants = await getGerants();
  if (d.statut === 'ECHOUEE') {
    await notifier('N11', [{ user: client, canaux: ['SMS', 'INAPP'] }, ...gerants.map((g) => ({ user: g, canaux: ['INAPP'] }))], { numero: co.numero, motif: d.motif }, co.commande_id);
  }
  if (d.statut === 'REMISE_ATELIER') {
    const cmd = await chargerCommande(co.commande_id);
    await notifier('N03', [{ user: client, canaux: ['EMAIL', 'INAPP'] }, ...gerants.map((g) => ({ user: g, canaux: ['INAPP'] }))], { numero: co.numero, date: frDate(cmd.date_remise_prevue) }, co.commande_id);
  }
  res.json(vue(co, req.user));
});

module.exports = router;
