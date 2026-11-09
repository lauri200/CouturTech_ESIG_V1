const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');
const config = require('../config');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { parse, notFound, badRequest, conflict, HttpError } = require('../utils/errors');
const { getParams, setParams, publicParams } = require('../services/params');
const { executerAlertes } = require('../services/alertes');
const { EN_COURS } = require('../services/statuts');

const router = express.Router();

// ---- Paramètres ----
router.get('/parametres/public', async (_req, res) => res.json(publicParams(await getParams())));
router.get('/parametres', authenticate, requireRole('GERANT'), async (_req, res) => res.json(await getParams()));
router.put('/parametres', authenticate, requireRole('GERANT'), async (req, res) => {
  const d = parse(z.record(z.string(), z.union([z.string(), z.number()])), req.body);
  if (d.D_ALERTE_HEURES !== undefined && !(Number(d.D_ALERTE_HEURES) >= 0)) throw badRequest('Délai d’alerte invalide.');
  if (d.FRAIS_COLLECTE !== undefined && !(Number(d.FRAIS_COLLECTE) >= 0)) throw badRequest('Frais de collecte invalides.');
  if (d.ACOMPTE_POURCENT !== undefined && !(Number(d.ACOMPTE_POURCENT) >= 0 && Number(d.ACOMPTE_POURCENT) <= 100)) throw badRequest('Pourcentage d’acompte invalide (0 à 100).');
  res.json(await setParams(d));
});

// ---- Fichiers (photos de tissu client, photos de modèles) ----
const MIMES = ['image/jpeg', 'image/png', 'image/webp'];
router.post('/fichiers', authenticate, async (req, res) => {
  const d = parse(z.object({ nom: z.string().trim().min(1).max(160), type_mime: z.string(), donnees: z.string().min(10) }), req.body);
  if (!MIMES.includes(d.type_mime)) throw badRequest('Format accepté : JPG, PNG ou WEBP.');
  const buf = Buffer.from(d.donnees.replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (buf.length > config.maxUploadBytes) throw badRequest('Image trop lourde (2 Mo maximum).');
  const { rows } = await query('INSERT INTO fichier (nom, type_mime, donnees, utilisateur_id) VALUES ($1,$2,$3,$4) RETURNING id', [d.nom, d.type_mime, buf, req.user.id]);
  res.status(201).json({ id: rows[0].id, url: `/api/fichiers/${rows[0].id}` });
});
router.get('/fichiers/:id', async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) throw notFound();
  const { rows } = await query('SELECT type_mime, donnees FROM fichier WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw notFound();
  res.set('Content-Type', rows[0].type_mime).set('Cache-Control', 'public, max-age=31536000, immutable').send(rows[0].donnees);
});

// ---- Équipe ----
const ROLES_EQUIPE = ['GERANT', 'TAILLEUR', 'LIVREUR'];
router.get('/utilisateurs', authenticate, requireRole('GERANT'), async (req, res) => {
  const roles = req.query.role ? String(req.query.role).split(',') : ROLES_EQUIPE;
  const { rows } = await query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.role, u.actif, u.created_at,
      (SELECT count(*)::int FROM commande c WHERE c.tailleur_id = u.id AND c.statut IN ('ATTRIBUEE','EN_CONFECTION')) AS taches_en_cours,
      (SELECT count(*)::int FROM collecte co WHERE co.livreur_id = u.id AND co.statut IN ('PLANIFIEE','COLLECTEE')) AS collectes_en_cours
     FROM utilisateur u WHERE u.role = ANY($1) ORDER BY u.role, u.prenom`, [roles]);
  res.json(rows);
});
router.get('/clients', authenticate, requireRole('GERANT'), async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.quartier, u.created_at, count(c.id)::int AS nb_commandes
     FROM utilisateur u LEFT JOIN commande c ON c.client_id = u.id WHERE u.role = 'CLIENT' AND u.actif
     GROUP BY u.id ORDER BY u.created_at DESC`);
  res.json(rows);
});
router.post('/utilisateurs', authenticate, requireRole('GERANT'), async (req, res) => {
  const d = parse(z.object({
    nom: z.string().trim().min(1).max(80),
    prenom: z.string().trim().min(1).max(80),
    email: z.string().trim().toLowerCase().email('E-mail invalide'),
    telephone: z.string().trim().regex(/^\+228\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/, 'Format attendu : +228 XX XX XX XX'),
    role: z.enum(ROLES_EQUIPE),
  }), req.body);
  if ((await query('SELECT 1 FROM utilisateur WHERE email = $1', [d.email])).rowCount) throw conflict('Cet e-mail est déjà utilisé.');
  const provisoire = crypto.randomBytes(6).toString('base64url');
  const { rows } = await query(
    `INSERT INTO utilisateur (nom, prenom, email, telephone, role, mot_de_passe_hash, doit_changer_mdp) VALUES ($1,$2,$3,$4,$5,$6,TRUE)
     RETURNING id, nom, prenom, email, telephone, role, actif`, [d.nom, d.prenom, d.email, d.telephone, d.role, await bcrypt.hash(provisoire, 10)]);
  res.status(201).json({ ...rows[0], mot_de_passe_provisoire: provisoire });
});
router.patch('/utilisateurs/:id', authenticate, requireRole('GERANT'), async (req, res) => {
  const d = parse(z.object({ actif: z.boolean() }), req.body);
  const id = Number(req.params.id);
  if (id === req.user.id && !d.actif) throw conflict('Vous ne pouvez pas désactiver votre propre compte.');
  if (!d.actif) {
    const occupe = await query("SELECT 1 FROM commande WHERE tailleur_id = $1 AND statut IN ('ATTRIBUEE','EN_CONFECTION') UNION SELECT 1 FROM collecte WHERE livreur_id = $1 AND statut IN ('PLANIFIEE','COLLECTEE') LIMIT 1", [id]);
    if (occupe.rowCount) throw conflict('Ce membre a des tâches en cours : réattribuez-les avant de le désactiver.');
  }
  const { rows } = await query("UPDATE utilisateur SET actif = $2 WHERE id = $1 AND role <> 'CLIENT' RETURNING id, nom, prenom, email, telephone, role, actif", [id, d.actif]);
  if (!rows[0]) throw notFound('Membre introuvable.');
  res.json(rows[0]);
});

// ---- Notifications in-app ----
router.get('/notifications', authenticate, async (req, res) => {
  const { rows } = await query(
    `SELECT n.id, n.code, n.sujet, n.contenu, n.lue, n.created_at, n.commande_id, c.numero
     FROM notification n LEFT JOIN commande c ON c.id = n.commande_id
     WHERE n.utilisateur_id = $1 AND n.canal = 'INAPP' ORDER BY n.created_at DESC, n.id DESC LIMIT 50`, [req.user.id]);
  res.json({ items: rows, non_lues: rows.filter((r) => !r.lue).length });
});
router.patch('/notifications/lire', authenticate, async (req, res) => {
  await query("UPDATE notification SET lue = TRUE WHERE utilisateur_id = $1 AND canal = 'INAPP' AND NOT lue", [req.user.id]);
  res.json({ ok: true });
});
router.get('/notifications/journal', authenticate, requireRole('GERANT'), async (req, res) => {
  const p = [];
  let w = "WHERE n.canal <> 'INAPP'";
  if (req.query.statut) { p.push(req.query.statut); w += ` AND n.statut = $${p.length}`; }
  const { rows } = await query(
    `SELECT n.id, n.code, n.canal, n.sujet, n.contenu, n.statut, n.tentatives, n.erreur, n.created_at, c.numero, u.prenom || ' ' || u.nom AS destinataire
     FROM notification n JOIN utilisateur u ON u.id = n.utilisateur_id LEFT JOIN commande c ON c.id = n.commande_id ${w}
     ORDER BY n.created_at DESC, n.id DESC LIMIT 200`, p);
  res.json(rows);
});

// ---- Tableau de bord ----
router.get('/dashboard', authenticate, requireRole('GERANT'), async (_req, res) => {
  const k = (await query(`SELECT
      count(*) FILTER (WHERE statut = ANY($1))::int AS en_cours,
      count(*) FILTER (WHERE statut = 'PRETE' OR statut = 'EN_ESSAYAGE')::int AS pretes,
      count(*) FILTER (WHERE deadline < CURRENT_DATE AND statut IN ('ATTRIBUEE','EN_CONFECTION'))::int AS en_retard,
      count(*) FILTER (WHERE statut IN ('ATTRIBUEE','EN_CONFECTION') AND deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + 2)::int AS deadline_proche,
      count(*) FILTER (WHERE statut = 'EN_ATTENTE_COLLECTE')::int AS collectes_attente,
      count(*) FILTER (WHERE statut IN ('CONFIRMEE','TISSU_RECU'))::int AS a_attribuer,
      COALESCE(sum(total - montant_paye) FILTER (WHERE statut <> 'ANNULEE'), 0)::int AS reste_a_encaisser,
      count(*) FILTER (WHERE statut = 'RETIREE' AND date_trunc('month', updated_at) = date_trunc('month', now()))::int AS retirees_mois
    FROM commande`, [EN_COURS])).rows[0];
  k.encaisse_mois = (await query("SELECT COALESCE(sum(montant),0)::int AS v FROM paiement WHERE date_trunc('month', date_paiement) = date_trunc('month', now())")).rows[0].v;
  k.stock_bas = (await query('SELECT id, nom, stock_metres, seuil_alerte FROM tissu WHERE actif AND stock_metres <= seuil_alerte ORDER BY stock_metres')).rows;
  k.par_statut = (await query('SELECT statut, count(*)::int AS n FROM commande GROUP BY statut')).rows;
  k.charge_tailleurs = (await query(`SELECT u.id, u.prenom || ' ' || u.nom AS nom, count(c.id)::int AS n,
      count(c.id) FILTER (WHERE c.deadline < CURRENT_DATE)::int AS retards
    FROM utilisateur u LEFT JOIN commande c ON c.tailleur_id = u.id AND c.statut IN ('ATTRIBUEE','EN_CONFECTION')
    WHERE u.role = 'TAILLEUR' AND u.actif GROUP BY u.id ORDER BY n DESC`)).rows;
  k.ponctualite = (await query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE h.created_at::date <= c.deadline)::int AS a_l_heure
    FROM commande c JOIN historique_statut h ON h.commande_id = c.id AND h.nouveau_statut = 'PRETE' WHERE c.deadline IS NOT NULL`)).rows[0];
  res.json(k);
});

// ---- Cron (alertes de délai, retards, relances) ----
async function cron(req, res) {
  const secret = req.get('Authorization') === `Bearer ${config.cronSecret}` || req.get('x-cron-secret') === config.cronSecret;
  if (!secret) throw new HttpError(401, 'Non autorisé.');
  res.json(await executerAlertes());
}
router.get('/cron/alertes', cron);
router.post('/cron/alertes', cron);

module.exports = router;
