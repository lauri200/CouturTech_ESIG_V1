const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db');
const { HttpError, forbidden } = require('../utils/errors');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

async function loadUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Session expirée. Veuillez vous reconnecter.');
  }
  const { rows } = await query(
    'SELECT id, nom, prenom, email, telephone, role, adresse, quartier, actif, doit_changer_mdp FROM utilisateur WHERE id = $1',
    [payload.sub],
  );
  if (!rows[0] || !rows[0].actif) throw new HttpError(401, 'Compte inactif ou introuvable.');
  return rows[0];
}

async function authenticate(req, _res, next) {
  const user = await loadUser(req);
  if (!user) throw new HttpError(401, 'Authentification requise.');
  req.user = user;
  next();
}

async function optionalAuth(req, _res, next) {
  req.user = await loadUser(req).catch(() => null);
  next();
}

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw forbidden();
  next();
};

module.exports = { signToken, authenticate, optionalAuth, requireRole };
