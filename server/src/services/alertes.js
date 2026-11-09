const { query } = require('../db');
const { getParams } = require('./params');
const { notifier, relancerEchecs, getGerants, getUser } = require('./notifications');
const { todayISO, frDate } = require('../utils/dates');

// RG8 (alerte délai), RG9 (retard) et RG17 (relance des notifications en échec).
async function executerAlertes(maintenant = new Date()) {
  const params = await getParams();
  const heures = Number(params.D_ALERTE_HEURES) || 0;
  const aujourdHui = todayISO(maintenant);
  const gerants = await getGerants();

  const { rows: aAlerter } = await query(
    `SELECT c.id, c.numero, c.deadline, c.tailleur_id FROM commande c
     WHERE c.statut IN ('ATTRIBUEE','EN_CONFECTION') AND NOT c.alerte_delai_envoyee AND c.deadline IS NOT NULL
       AND (c.deadline::timestamp + interval '1 day') - make_interval(hours => $1) <= $2::timestamp`,
    [heures, maintenant.toISOString()],
  );
  for (const c of aAlerter) {
    const tailleur = await getUser(c.tailleur_id);
    await notifier('N05', [
      { user: tailleur, canaux: ['INAPP', 'SMS'] },
      ...gerants.map((g) => ({ user: g, canaux: ['INAPP'] })),
    ], { numero: c.numero, deadline: frDate(c.deadline) }, c.id);
    await query('UPDATE commande SET alerte_delai_envoyee = TRUE WHERE id = $1', [c.id]);
  }

  const { rows: enRetard } = await query(
    `SELECT c.id, c.numero, c.deadline, t.prenom || ' ' || t.nom AS tailleur FROM commande c
     LEFT JOIN utilisateur t ON t.id = c.tailleur_id
     WHERE c.statut IN ('ATTRIBUEE','EN_CONFECTION') AND NOT c.retard_notifie AND c.deadline < $1::date`,
    [aujourdHui],
  );
  for (const c of enRetard) {
    await notifier('N06', gerants.map((g) => ({ user: g, canaux: ['INAPP', 'EMAIL'] })),
      { numero: c.numero, deadline: frDate(c.deadline), tailleur: c.tailleur || '—' }, c.id);
    await query('UPDATE commande SET retard_notifie = TRUE WHERE id = $1', [c.id]);
  }

  const relances = await relancerEchecs();
  return { alertes: aAlerter.length, retards: enRetard.length, relances };
}

module.exports = { executerAlertes };
