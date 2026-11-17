const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { parse, badRequest } = require('../utils/errors');
const { MESURES, scanDisponible, scannerBodygram } = require('../services/mensurations');

const router = express.Router();
router.use(authenticate);

const mesure = z.coerce.number().min(5, 'Mesure trop petite').max(250, 'Mesure trop grande');
const valeursSchema = z.object(Object.fromEntries(Object.keys(MESURES).map((k) => [k, mesure.optional()])))
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Indiquez au moins une mesure.');

const sortie = (m) => ({ ...m, valeurs: m.valeurs });

router.get('/config', (_req, res) => {
  res.json({
    scan_disponible: scanDisponible(),
    fournisseur: scanDisponible() ? 'Bodygram' : null,
    mesures: Object.entries(MESURES).map(([cle, d]) => ({ cle, libelle: d.libelle })),
  });
});

router.get('/', requireRole('CLIENT', 'GERANT'), async (req, res) => {
  const clientId = req.user.role === 'CLIENT' ? req.user.id : Number(req.query.client_id);
  if (!clientId) throw badRequest('client_id requis.');
  const { rows } = await query('SELECT * FROM mensuration WHERE client_id = $1 ORDER BY created_at DESC, id DESC', [clientId]);
  res.json(rows.map(sortie));
});

router.post('/', requireRole('CLIENT'), async (req, res) => {
  const d = parse(z.object({ valeurs: valeursSchema }), req.body);
  const { rows } = await query("INSERT INTO mensuration (client_id, source, valeurs) VALUES ($1, 'MANUEL', $2) RETURNING *", [req.user.id, JSON.stringify(d.valeurs)]);
  res.status(201).json(sortie(rows[0]));
});

const photo = z.string().min(1000, 'Photo manquante').max(3_000_000, 'Photo trop lourde').regex(/^(data:image\/(jpeg|png|webp);base64,)?[A-Za-z0-9+/=]+$/, 'Photo invalide');
router.post('/scan', requireRole('CLIENT'), async (req, res) => {
  const d = parse(z.object({
    age: z.coerce.number().int().min(10).max(100),
    genre: z.enum(['female', 'male']),
    stature_cm: z.coerce.number().min(100).max(230),
    poids_kg: z.coerce.number().min(25).max(250),
    photo_face: photo,
    photo_profil: photo,
  }), req.body);
  const r = await scannerBodygram(d);
  const valeurs = { ...r.valeurs, stature: d.stature_cm };
  const { rows } = await query("INSERT INTO mensuration (client_id, source, fournisseur, valeurs) VALUES ($1, 'SCAN', 'BODYGRAM', $2) RETURNING *", [req.user.id, JSON.stringify(valeurs)]);
  res.status(201).json(sortie(rows[0]));
});

module.exports = router;
