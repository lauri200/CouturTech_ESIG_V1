const { HttpError } = require('../utils/errors');

// Mesures corporelles en centimètres ; `bodygram` = nom du champ renvoyé par l'API Bodygram (en mm).
const MESURES = {
  tour_cou: { libelle: 'Tour de cou', bodygram: 'neckGirth' },
  carrure_dos: { libelle: 'Carrure dos', bodygram: 'acrossBackShoulderWidth' },
  tour_poitrine: { libelle: 'Tour de poitrine', bodygram: 'bustGirth' },
  sous_poitrine: { libelle: 'Tour sous poitrine', bodygram: 'underBustGirth' },
  tour_taille: { libelle: 'Tour de taille', bodygram: 'waistGirth' },
  tour_hanches: { libelle: 'Tour de hanches', bodygram: 'hipGirth' },
  longueur_dos: { libelle: 'Longueur nuque-taille', bodygram: 'backNeckPointToWaist' },
  longueur_manche: { libelle: 'Longueur de manche', bodygram: 'backNeckPointToWristLengthR' },
  tour_bras: { libelle: 'Tour de bras', bodygram: 'upperArmGirthR' },
  tour_poignet: { libelle: 'Tour de poignet', bodygram: 'wristGirthR' },
  tour_cuisse: { libelle: 'Tour de cuisse', bodygram: 'thighGirthR' },
  entrejambe: { libelle: 'Longueur d’entrejambe', bodygram: 'insideLegLengthR' },
  longueur_jambe: { libelle: 'Longueur extérieure de jambe', bodygram: 'outsideLegLengthR' },
};

const config = () => ({ orgId: process.env.BODYGRAM_ORG_ID || '', apiKey: process.env.BODYGRAM_API_KEY || '' });
const scanDisponible = () => Boolean(config().orgId && config().apiKey);
const sansPrefixe = (b64) => String(b64).replace(/^data:image\/\w+;base64,/, '');

function convertir(measurements = []) {
  const parNom = Object.fromEntries(measurements.map((m) => [m.name, m]));
  const valeurs = {};
  for (const [cle, def] of Object.entries(MESURES)) {
    const m = parNom[def.bodygram];
    if (m && Number.isFinite(m.value)) valeurs[cle] = Math.round((m.unit === 'cm' ? m.value * 10 : m.value)) / 10;
  }
  return valeurs;
}

// Appel serveur uniquement : la clé API ne quitte jamais le serveur.
async function scannerBodygram({ age, genre, stature_cm, poids_kg, photo_face, photo_profil }, fetchImpl = fetch) {
  if (!scanDisponible()) throw new HttpError(503, 'Le scan par photos n’est pas encore activé. Saisissez vos mesures manuellement.');
  const { orgId, apiKey } = config();
  let r;
  try {
    r = await fetchImpl(`https://platform.bodygram.com/api/orgs/${encodeURIComponent(orgId)}/scans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ photoScan: {
        age, gender: genre, height: Math.round(stature_cm * 10), weight: Math.round(poids_kg * 1000),
        frontPhoto: sansPrefixe(photo_face), rightPhoto: sansPrefixe(photo_profil),
      } }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new HttpError(502, 'Le service de scan ne répond pas. Réessayez plus tard.');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, 'Le service de scan a refusé la demande. Réessayez plus tard.');
  const entry = data.entry || {};
  if (entry.status !== 'success') throw new HttpError(422, 'Le scan a échoué : reprenez les photos en suivant le guide (pose, lumière, vêtements ajustés).');
  const valeurs = convertir(entry.measurements);
  if (!Object.keys(valeurs).length) throw new HttpError(502, 'Le service de scan n’a renvoyé aucune mesure exploitable.');
  return { valeurs, reference: entry.id || null };
}

module.exports = { MESURES, scanDisponible, scannerBodygram, convertir };
