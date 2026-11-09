class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(422, msg, details);
const forbidden = (msg = 'Accès interdit.') => new HttpError(403, msg);
const notFound = (msg = 'Ressource introuvable.') => new HttpError(404, msg);
const conflict = (msg) => new HttpError(409, msg);

function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ champ: i.path.join('.'), message: i.message }));
    throw badRequest('Données invalides.', details);
  }
  return r.data;
}

module.exports = { HttpError, badRequest, forbidden, notFound, conflict, parse };
