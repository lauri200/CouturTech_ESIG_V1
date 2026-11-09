export const TAILLES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

// Mensurations indicatives (cm) : tour de poitrine, tour de taille, tour de hanches.
export const MENSURATIONS = {
  S: ['84–88', '66–70', '90–94'],
  M: ['88–92', '70–74', '94–98'],
  L: ['92–96', '74–78', '98–102'],
  XL: ['96–102', '78–84', '102–108'],
  '2XL': ['102–108', '84–90', '108–114'],
  '3XL': ['108–114', '90–96', '114–120'],
};

export const STATUTS = {
  CONFIRMEE: { libelle: 'Confirmée', classe: 'bg-sky-100 text-sky-800' },
  EN_ATTENTE_COLLECTE: { libelle: 'En attente de collecte', classe: 'bg-amber-100 text-amber-800' },
  TISSU_RECU: { libelle: 'Tissu reçu', classe: 'bg-teal-100 text-teal-800' },
  ATTRIBUEE: { libelle: 'Attribuée', classe: 'bg-indigo-100 text-indigo-800' },
  EN_CONFECTION: { libelle: 'En confection', classe: 'bg-violet-100 text-violet-800' },
  PRETE: { libelle: 'Prête', classe: 'bg-emerald-100 text-emerald-800' },
  EN_ESSAYAGE: { libelle: 'En essayage', classe: 'bg-lime-100 text-lime-800' },
  RETIREE: { libelle: 'Retirée', classe: 'bg-nuit-100 text-nuit' },
  ANNULEE: { libelle: 'Annulée', classe: 'bg-red-100 text-red-700' },
};

export const PARCOURS_CLIENT = ['CONFIRMEE', 'EN_ATTENTE_COLLECTE', 'TISSU_RECU', 'ATTRIBUEE', 'EN_CONFECTION', 'PRETE', 'EN_ESSAYAGE', 'RETIREE'];

export const STATUTS_COLLECTE = {
  A_PLANIFIER: { libelle: 'À planifier', classe: 'bg-amber-100 text-amber-800' },
  PLANIFIEE: { libelle: 'Planifiée', classe: 'bg-sky-100 text-sky-800' },
  COLLECTEE: { libelle: 'Tissu récupéré', classe: 'bg-violet-100 text-violet-800' },
  REMISE_ATELIER: { libelle: 'Remis à l’atelier', classe: 'bg-emerald-100 text-emerald-800' },
  ECHOUEE: { libelle: 'Échouée', classe: 'bg-red-100 text-red-700' },
};

export const PAIEMENTS = {
  NON_PAYE: { libelle: 'Non payé', classe: 'bg-red-50 text-red-700' },
  ACOMPTE: { libelle: 'Acompte', classe: 'bg-amber-50 text-amber-800' },
  SOLDE: { libelle: 'Soldé', classe: 'bg-emerald-50 text-emerald-700' },
};

export const MODES_PAIEMENT = { ESPECES: 'Espèces', MOBILE_MONEY: 'Mobile Money', AUTRE: 'Autre' };
export const ROLES = { CLIENT: 'Client', GERANT: 'Gérant', TAILLEUR: 'Tailleur', LIVREUR: 'Livreur' };
export const ESPACES = { CLIENT: '/client/commandes', GERANT: '/gerant', TAILLEUR: '/tailleur', LIVREUR: '/livreur' };

export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ')} FCFA`;

export function date(iso, avecHeure = false) {
  if (!iso) return '—';
  const s = String(iso);
  const d = s.length === 10 ? new Date(`${s}T12:00:00`) : new Date(s);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}) });
}

export function aujourdhui(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function joursRestants(iso) {
  if (!iso) return null;
  const a = new Date(`${aujourdhui()}T00:00:00`);
  const b = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return Math.round((b - a) / 86400000);
}
