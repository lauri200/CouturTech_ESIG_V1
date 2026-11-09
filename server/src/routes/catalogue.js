const express = require('express');
const { z } = require('zod');
const { query, tx } = require('../db');
const { authenticate, optionalAuth, requireRole } = require('../middleware/auth');
const { parse, notFound, badRequest } = require('../utils/errors');
const { notifier, getGerants } = require('../services/notifications');

const TAILLES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
const router = express.Router();

const MODELE_SELECT = `
  SELECT m.*,
    COALESCE((SELECT json_agg(p.url ORDER BY p.ordre) FROM modele_photo p WHERE p.modele_id = m.id), '[]') AS photos,
    COALESCE((SELECT json_object_agg(mm.taille, mm.metres) FROM modele_metrage mm WHERE mm.modele_id = m.id), '{}') AS metrages
  FROM modele m`;

const estGerant = (req) => req.user && req.user.role === 'GERANT';

router.get('/modeles', optionalAuth, async (req, res) => {
  const where = [];
  const params = [];
  if (!(estGerant(req) && req.query.tous === '1')) where.push('m.actif');
  if (req.query.categorie) { params.push(req.query.categorie); where.push(`m.categorie = $${params.length}`); }
  if (req.query.prix_max) { params.push(Number(req.query.prix_max)); where.push(`m.prix_confection <= $${params.length}`); }
  if (req.query.mis_en_avant === '1') where.push('m.mis_en_avant');
  const limit = Math.min(Number(req.query.limit) || 12, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await query(`SELECT count(*)::int AS n FROM modele m ${w}`, params);
  const { rows } = await query(`${MODELE_SELECT} ${w} ORDER BY m.mis_en_avant DESC, m.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
  const cats = await query('SELECT DISTINCT categorie FROM modele WHERE actif ORDER BY categorie');
  res.json({ items: rows, total: total.rows[0].n, page, pages: Math.max(Math.ceil(total.rows[0].n / limit), 1), categories: cats.rows.map((r) => r.categorie) });
});

router.get('/modeles/:id', optionalAuth, async (req, res) => {
  const { rows } = await query(`${MODELE_SELECT} WHERE m.id = $1`, [Number(req.params.id)]);
  if (!rows[0] || (!rows[0].actif && !estGerant(req))) throw notFound('Modèle introuvable.');
  res.json(rows[0]);
});

const modeleSchema = z.object({
  reference: z.string().trim().min(1).max(30),
  nom: z.string().trim().min(1).max(120),
  categorie: z.string().trim().min(1).max(40),
  description: z.string().trim().max(2000).default(''),
  prix_confection: z.coerce.number().int().min(0),
  delai_jours: z.coerce.number().int().min(1),
  mis_en_avant: z.boolean().default(false),
  actif: z.boolean().default(true),
  photos: z.array(z.string().trim().min(1).max(300)).min(1, 'Au moins une photo').max(4, '4 photos maximum'),
  metrages: z.record(z.enum(TAILLES), z.coerce.number().positive()).refine((m) => Object.keys(m).length > 0, 'Au moins une taille'),
});

async function enregistrerModele(id, data) {
  return tx(async (db) => {
    let modeleId = id;
    const vals = [data.reference, data.nom, data.categorie, data.description, data.prix_confection, data.delai_jours, data.mis_en_avant, data.actif];
    if (id) {
      const r = await db.query(`UPDATE modele SET reference=$2, nom=$3, categorie=$4, description=$5, prix_confection=$6, delai_jours=$7, mis_en_avant=$8, actif=$9 WHERE id=$1 RETURNING id`, [id, ...vals]);
      if (!r.rowCount) throw notFound('Modèle introuvable.');
    } else {
      const r = await db.query(`INSERT INTO modele (reference, nom, categorie, description, prix_confection, delai_jours, mis_en_avant, actif) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, vals);
      modeleId = r.rows[0].id;
    }
    await db.query('DELETE FROM modele_photo WHERE modele_id = $1', [modeleId]);
    for (const [i, url] of data.photos.entries()) await db.query('INSERT INTO modele_photo (modele_id, url, ordre) VALUES ($1,$2,$3)', [modeleId, url, i]);
    await db.query('DELETE FROM modele_metrage WHERE modele_id = $1', [modeleId]);
    for (const [taille, metres] of Object.entries(data.metrages)) await db.query('INSERT INTO modele_metrage (modele_id, taille, metres) VALUES ($1,$2,$3)', [modeleId, taille, metres]);
    return modeleId;
  }).catch((e) => { if (e.code === '23505') throw badRequest('Cette référence existe déjà.'); throw e; });
}

router.post('/modeles', authenticate, requireRole('GERANT'), async (req, res) => {
  const id = await enregistrerModele(null, parse(modeleSchema, req.body));
  const { rows } = await query(`${MODELE_SELECT} WHERE m.id = $1`, [id]);
  res.status(201).json(rows[0]);
});

router.put('/modeles/:id', authenticate, requireRole('GERANT'), async (req, res) => {
  const id = await enregistrerModele(Number(req.params.id), parse(modeleSchema, req.body));
  const { rows } = await query(`${MODELE_SELECT} WHERE m.id = $1`, [id]);
  res.json(rows[0]);
});

router.delete('/modeles/:id', authenticate, requireRole('GERANT'), async (req, res) => {
  const r = await query('UPDATE modele SET actif = FALSE WHERE id = $1', [Number(req.params.id)]);
  if (!r.rowCount) throw notFound('Modèle introuvable.');
  res.json({ message: 'Modèle désactivé.' });
});

// ---- Tissus ----
const TISSU_SELECT = `
  SELECT t.*, (t.stock_metres >= COALESCE((SELECT min(mm.metres) FROM modele_metrage mm JOIN modele m ON m.id = mm.modele_id WHERE m.actif), 0)) AND t.stock_metres > 0 AS disponible,
    (t.stock_metres <= t.seuil_alerte) AS stock_bas
  FROM tissu t`;

router.get('/tissus', optionalAuth, async (req, res) => {
  const where = [];
  const params = [];
  if (!(estGerant(req) && req.query.tous === '1')) where.push('t.actif');
  if (req.query.type) { params.push(req.query.type); where.push(`t.type = $${params.length}`); }
  if (req.query.couleur) { params.push(`%${req.query.couleur}%`); where.push(`t.couleur ILIKE $${params.length}`); }
  const { rows } = await query(`${TISSU_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.type, t.nom`, params);
  const types = await query('SELECT DISTINCT type FROM tissu WHERE actif ORDER BY type');
  res.json({ items: rows, types: types.rows.map((r) => r.type) });
});

router.get('/tissus/:id', optionalAuth, async (req, res) => {
  const { rows } = await query(`${TISSU_SELECT} WHERE t.id = $1`, [Number(req.params.id)]);
  if (!rows[0] || (!rows[0].actif && !estGerant(req))) throw notFound('Tissu introuvable.');
  res.json(rows[0]);
});

const tissuSchema = z.object({
  nom: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(40),
  couleur: z.string().trim().max(60).default(''),
  photo_url: z.string().trim().max(300).nullable().optional(),
  prix_metre: z.coerce.number().int().min(0),
  seuil_alerte: z.coerce.number().min(0),
  actif: z.boolean().default(true),
});

router.post('/tissus', authenticate, requireRole('GERANT'), async (req, res) => {
  const d = parse(tissuSchema.extend({ stock_metres: z.coerce.number().min(0).default(0) }), req.body);
  const t = await tx(async (db) => {
    const { rows } = await db.query(
      'INSERT INTO tissu (nom, type, couleur, photo_url, prix_metre, stock_metres, seuil_alerte, actif) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [d.nom, d.type, d.couleur, d.photo_url || null, d.prix_metre, d.stock_metres, d.seuil_alerte, d.actif],
    );
    if (d.stock_metres > 0) await db.query("INSERT INTO mouvement_stock (tissu_id, type, metres, motif, utilisateur_id) VALUES ($1,'ENTREE',$2,'Stock initial',$3)", [rows[0].id, d.stock_metres, req.user.id]);
    return rows[0];
  });
  res.status(201).json(t);
});

router.put('/tissus/:id', authenticate, requireRole('GERANT'), async (req, res) => {
  const d = parse(tissuSchema, req.body);
  const { rows } = await query(
    'UPDATE tissu SET nom=$2, type=$3, couleur=$4, photo_url=$5, prix_metre=$6, seuil_alerte=$7, actif=$8 WHERE id=$1 RETURNING *',
    [Number(req.params.id), d.nom, d.type, d.couleur, d.photo_url || null, d.prix_metre, d.seuil_alerte, d.actif],
  );
  if (!rows[0]) throw notFound('Tissu introuvable.');
  res.json(rows[0]);
});

router.get('/tissus/:id/mouvements', authenticate, requireRole('GERANT'), async (req, res) => {
  const { rows } = await query(
    `SELECT ms.*, c.numero AS commande_numero, u.prenom || ' ' || u.nom AS auteur FROM mouvement_stock ms
     LEFT JOIN commande c ON c.id = ms.commande_id LEFT JOIN utilisateur u ON u.id = ms.utilisateur_id
     WHERE ms.tissu_id = $1 ORDER BY ms.created_at DESC, ms.id DESC`, [Number(req.params.id)],
  );
  res.json(rows);
});

// Variation de stock + RG16 (alerte au franchissement du seuil).
async function mouvementStock(db, { tissuId, type, metres, motif, commandeId = null, userId = null }) {
  const { rows } = await db.query('SELECT * FROM tissu WHERE id = $1 FOR UPDATE', [tissuId]);
  const t = rows[0];
  if (!t) throw notFound('Tissu introuvable.');
  const delta = type === 'SORTIE' ? -Math.abs(metres) : type === 'AJUSTEMENT' ? metres : Math.abs(metres);
  const nouveau = Math.round((t.stock_metres + delta) * 100) / 100;
  if (nouveau < 0) throw badRequest('Stock insuffisant.');
  await db.query('UPDATE tissu SET stock_metres = $2 WHERE id = $1', [tissuId, nouveau]);
  await db.query('INSERT INTO mouvement_stock (tissu_id, commande_id, type, metres, motif, utilisateur_id) VALUES ($1,$2,$3,$4,$5,$6)', [tissuId, commandeId, type, delta, motif, userId]);
  const franchi = t.stock_metres > t.seuil_alerte && nouveau <= t.seuil_alerte;
  return { tissu: { ...t, stock_metres: nouveau }, alerteStockBas: franchi };
}

async function alerterStockBas(tissu) {
  const gerants = await getGerants();
  await notifier('N12', gerants.map((g) => ({ user: g, canaux: ['INAPP'] })), { tissu: tissu.nom, stock: tissu.stock_metres, seuil: tissu.seuil_alerte });
}

router.post('/tissus/:id/mouvements', authenticate, requireRole('GERANT'), async (req, res) => {
  const d = parse(z.object({
    type: z.enum(['ENTREE', 'AJUSTEMENT']),
    metres: z.coerce.number().refine((v) => v !== 0, 'Quantité non nulle'),
    motif: z.string().trim().min(1, 'Motif obligatoire').max(300),
  }), req.body);
  if (d.type === 'ENTREE' && d.metres < 0) throw badRequest('Une entrée doit être positive.');
  const r = await tx((db) => mouvementStock(db, { tissuId: Number(req.params.id), type: d.type, metres: d.metres, motif: d.motif, userId: req.user.id }));
  if (r.alerteStockBas) await alerterStockBas(r.tissu);
  res.status(201).json(r.tissu);
});

module.exports = { router, mouvementStock, alerterStockBas, TAILLES };
