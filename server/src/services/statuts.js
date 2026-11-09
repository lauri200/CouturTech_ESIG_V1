const STATUTS = ['CONFIRMEE', 'EN_ATTENTE_COLLECTE', 'TISSU_RECU', 'ATTRIBUEE', 'EN_CONFECTION', 'PRETE', 'EN_ESSAYAGE', 'RETIREE', 'ANNULEE'];

const LIBELLES = {
  CONFIRMEE: 'CONFIRMÉE',
  EN_ATTENTE_COLLECTE: 'EN ATTENTE DE COLLECTE',
  TISSU_RECU: 'TISSU REÇU',
  ATTRIBUEE: 'ATTRIBUÉE',
  EN_CONFECTION: 'EN CONFECTION',
  PRETE: 'PRÊTE',
  EN_ESSAYAGE: 'EN ESSAYAGE',
  RETIREE: 'RETIRÉE',
  ANNULEE: 'ANNULÉE',
};

// RG11 : seules les transitions fléchées du CDC sont acceptées.
const TRANSITIONS = {
  CONFIRMEE: ['EN_ATTENTE_COLLECTE', 'ATTRIBUEE', 'ANNULEE'],
  EN_ATTENTE_COLLECTE: ['TISSU_RECU', 'ANNULEE'],
  TISSU_RECU: ['ATTRIBUEE', 'ANNULEE'],
  ATTRIBUEE: ['EN_CONFECTION', 'ANNULEE'],
  EN_CONFECTION: ['PRETE'],
  PRETE: ['EN_ESSAYAGE'],
  EN_ESSAYAGE: ['RETIREE'],
  RETIREE: [],
  ANNULEE: [],
};

const EN_COURS = ['CONFIRMEE', 'EN_ATTENTE_COLLECTE', 'TISSU_RECU', 'ATTRIBUEE', 'EN_CONFECTION', 'PRETE', 'EN_ESSAYAGE'];
const EN_PRODUCTION = ['ATTRIBUEE', 'EN_CONFECTION'];

const peutTransiter = (de, vers) => (TRANSITIONS[de] || []).includes(vers);

function estEnRetard(cmd, aujourdHui) {
  return Boolean(cmd.deadline) && EN_PRODUCTION.includes(cmd.statut) && String(cmd.deadline).slice(0, 10) < aujourdHui;
}

function statutPaiement(paye, total) {
  if (paye <= 0) return 'NON_PAYE';
  if (paye < total) return 'ACOMPTE';
  return 'SOLDE';
}

module.exports = { STATUTS, LIBELLES, TRANSITIONS, EN_COURS, EN_PRODUCTION, peutTransiter, estEnRetard, statutPaiement };
