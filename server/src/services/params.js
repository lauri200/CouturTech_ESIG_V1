const { query } = require('../db');

const DEFAUTS = {
  NOM_MAISON: 'CHIDE’S COUTURE',
  ADRESSE_ATELIER: 'Kégué, sur la voie de Kpatcha, Lomé',
  HORAIRES_ATELIER: 'Lundi au samedi, 09h – 21h',
  TELEPHONE_MAISON: '+228 00 00 00 00',
  EMAIL_MAISON: 'contact@couturtech.local',
  D_ALERTE_HEURES: '48',
  FRAIS_COLLECTE: '1000',
  ACOMPTE_POURCENT: '50',
  CRENEAUX_COLLECTE: '08h-10h,10h-12h,14h-16h,16h-18h',
  MAX_TENTATIVES_NOTIF: '3',
};
const PUBLICS = ['NOM_MAISON', 'ADRESSE_ATELIER', 'HORAIRES_ATELIER', 'TELEPHONE_MAISON', 'EMAIL_MAISON', 'FRAIS_COLLECTE', 'ACOMPTE_POURCENT', 'CRENEAUX_COLLECTE'];

async function getParams(db = { query }) {
  const { rows } = await db.query('SELECT cle, valeur FROM parametre');
  const out = { ...DEFAUTS };
  for (const r of rows) out[r.cle] = r.valeur;
  return out;
}

async function setParams(values) {
  for (const [cle, valeur] of Object.entries(values)) {
    if (!(cle in DEFAUTS)) continue;
    await query(
      'INSERT INTO parametre (cle, valeur) VALUES ($1, $2) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur',
      [cle, String(valeur)],
    );
  }
  return getParams();
}

const publicParams = (p) => Object.fromEntries(PUBLICS.map((k) => [k, p[k]]));

module.exports = { DEFAUTS, getParams, setParams, publicParams };
