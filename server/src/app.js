const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { HttpError } = require('./utils/errors');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.env === 'production' ? config.appUrl : true }));
app.use(express.json({ limit: '4mb' }));

const api = express.Router();
api.get('/health', (_req, res) => res.json({ ok: true }));
api.use('/auth', require('./routes/auth'));
api.use('/', require('./routes/catalogue').router);
api.use('/commandes', require('./routes/commandes').router);
api.use('/collectes', require('./routes/collectes'));
api.use('/', require('./routes/divers'));
api.use((_req, _res, next) => next(new HttpError(404, 'Ressource introuvable.')));

app.use('/api', api);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(422).json({ message: 'JSON invalide.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Fichier trop lourd.' });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Erreur serveur. Réessayez.' : err.message, ...(err.details ? { details: err.details } : {}) });
});

module.exports = app;
