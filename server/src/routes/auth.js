const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const config = require('../config');
const { query, tx } = require('../db');
const { signToken, authenticate } = require('../middleware/auth');
const { parse, HttpError, badRequest, conflict } = require('../utils/errors');
const { envoyerEmail } = require('../services/notifications');

const router = express.Router();
const telephone = z.string().trim().regex(/^\+228\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/, 'Format attendu : +228 XX XX XX XX');
const motDePasse = z.string().min(8, '8 caractères minimum');

const PUBLIC_FIELDS = 'id, nom, prenom, email, telephone, role, adresse, quartier, doit_changer_mdp';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.loginRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === 'test',
  message: { message: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});

router.post('/register', async (req, res) => {
  const data = parse(z.object({
    nom: z.string().trim().min(1).max(80),
    prenom: z.string().trim().min(1).max(80),
    telephone,
    email: z.string().trim().toLowerCase().email('E-mail invalide'),
    adresse: z.string().trim().max(200).optional().default(''),
    quartier: z.string().trim().max(80).optional().default(''),
    mot_de_passe: motDePasse,
    consentement: z.literal(true, { message: 'Vous devez accepter la politique de confidentialité.' }),
  }), req.body);
  const exist = await query('SELECT 1 FROM utilisateur WHERE email = $1', [data.email]);
  if (exist.rowCount) throw conflict('Cet e-mail est déjà utilisé.');
  const hash = await bcrypt.hash(data.mot_de_passe, 10);
  const { rows } = await query(
    `INSERT INTO utilisateur (nom, prenom, email, telephone, mot_de_passe_hash, role, adresse, quartier, consentement_at)
     VALUES ($1,$2,$3,$4,$5,'CLIENT',$6,$7, now()) RETURNING ${PUBLIC_FIELDS}`,
    [data.nom, data.prenom, data.email, data.telephone, hash, data.adresse, data.quartier],
  );
  res.status(201).json({ token: signToken(rows[0]), user: rows[0], message: 'Compte créé. Vous pouvez commander.' });
});

router.post('/login', loginLimiter, async (req, res) => {
  const data = parse(z.object({ email: z.string().trim().toLowerCase(), mot_de_passe: z.string() }), req.body);
  const { rows } = await query(`SELECT ${PUBLIC_FIELDS}, mot_de_passe_hash, actif FROM utilisateur WHERE email = $1`, [data.email]);
  const u = rows[0];
  if (!u || !u.actif || !(await bcrypt.compare(data.mot_de_passe, u.mot_de_passe_hash))) {
    throw new HttpError(401, 'E-mail ou mot de passe incorrect.');
  }
  delete u.mot_de_passe_hash; delete u.actif;
  res.json({ token: signToken(u), user: u });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = parse(z.object({ email: z.string().trim().toLowerCase() }), req.body);
  const { rows } = await query('SELECT id, prenom, email FROM utilisateur WHERE email = $1 AND actif', [email]);
  if (rows[0]) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await query("INSERT INTO reinitialisation_mdp (utilisateur_id, token_hash, expire_at) VALUES ($1, $2, now() + interval '1 hour')", [rows[0].id, hash]);
    const lien = `${config.appUrl}/reinitialiser-mot-de-passe?token=${token}`;
    await envoyerEmail(rows[0].email, 'CouturTech – Réinitialisation du mot de passe',
      `Bonjour ${rows[0].prenom}, pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) : ${lien}`).catch(() => {});
  }
  res.json({ message: 'Si un compte existe, un lien vous a été envoyé par e-mail.' });
});

router.post('/reset-password', async (req, res) => {
  const data = parse(z.object({ token: z.string().min(10), mot_de_passe: motDePasse }), req.body);
  const hash = crypto.createHash('sha256').update(data.token).digest('hex');
  await tx(async (db) => {
    const { rows } = await db.query('SELECT * FROM reinitialisation_mdp WHERE token_hash = $1 AND NOT utilise AND expire_at > now() FOR UPDATE', [hash]);
    if (!rows[0]) throw badRequest('Lien invalide ou expiré.');
    await db.query('UPDATE utilisateur SET mot_de_passe_hash = $2, doit_changer_mdp = FALSE WHERE id = $1', [rows[0].utilisateur_id, await bcrypt.hash(data.mot_de_passe, 10)]);
    await db.query('UPDATE reinitialisation_mdp SET utilise = TRUE WHERE id = $1', [rows[0].id]);
  });
  res.json({ message: 'Mot de passe modifié. Vous pouvez vous connecter.' });
});

router.get('/me', authenticate, (req, res) => res.json(req.user));

router.patch('/me', authenticate, async (req, res) => {
  const data = parse(z.object({
    nom: z.string().trim().min(1).max(80).optional(),
    prenom: z.string().trim().min(1).max(80).optional(),
    telephone: telephone.optional(),
    adresse: z.string().trim().max(200).optional(),
    quartier: z.string().trim().max(80).optional(),
    mot_de_passe_actuel: z.string().optional(),
    nouveau_mot_de_passe: motDePasse.optional(),
  }), req.body);
  if (data.nouveau_mot_de_passe) {
    const { rows } = await query('SELECT mot_de_passe_hash FROM utilisateur WHERE id = $1', [req.user.id]);
    if (!data.mot_de_passe_actuel || !(await bcrypt.compare(data.mot_de_passe_actuel, rows[0].mot_de_passe_hash))) {
      throw badRequest('Mot de passe actuel incorrect.');
    }
    await query('UPDATE utilisateur SET mot_de_passe_hash = $2, doit_changer_mdp = FALSE WHERE id = $1', [req.user.id, await bcrypt.hash(data.nouveau_mot_de_passe, 10)]);
  }
  const champs = ['nom', 'prenom', 'telephone', 'adresse', 'quartier'].filter((k) => data[k] !== undefined);
  if (champs.length) {
    await query(`UPDATE utilisateur SET ${champs.map((k, i) => `${k} = $${i + 2}`).join(', ')} WHERE id = $1`, [req.user.id, ...champs.map((k) => data[k])]);
  }
  const { rows } = await query(`SELECT ${PUBLIC_FIELDS} FROM utilisateur WHERE id = $1`, [req.user.id]);
  res.json(rows[0]);
});

router.delete('/me', authenticate, async (req, res) => {
  if (req.user.role !== 'CLIENT') throw badRequest('Seul un compte client peut être supprimé ici.');
  const enCours = await query("SELECT 1 FROM commande WHERE client_id = $1 AND statut NOT IN ('RETIREE','ANNULEE') LIMIT 1", [req.user.id]);
  if (enCours.rowCount) throw conflict('Vous avez une commande en cours : suppression impossible pour le moment.');
  const total = await query('SELECT 1 FROM commande WHERE client_id = $1 LIMIT 1', [req.user.id]);
  if (total.rowCount) {
    await query(`UPDATE utilisateur SET nom = 'Compte', prenom = 'supprimé', email = 'supprime-' || id || '@couturtech.invalid',
      telephone = '', adresse = NULL, quartier = NULL, actif = FALSE WHERE id = $1`, [req.user.id]);
  } else {
    await query('DELETE FROM utilisateur WHERE id = $1', [req.user.id]);
  }
  res.json({ message: 'Votre compte a été supprimé.' });
});

module.exports = router;
