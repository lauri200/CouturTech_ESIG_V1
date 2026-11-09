// Données de DÉMONSTRATION : prix, métrages et noms sont fictifs et à remplacer par ceux de la maison partenaire (à préciser).
const bcrypt = require('bcryptjs');
const { pool, tx } = require('../src/db');
const initSchema = require('./db-init');
const { todayISO, addDays } = require('../src/utils/dates');
const { prochainNumero } = require('../src/services/numero');

const MDP_DEMO = 'Demo2026!';

const UTILISATEURS = [
  ['Gérant', 'Démo', 'gerant@couturtech.tg', '+228 90 00 00 01', 'GERANT'],
  ['Tailleur', 'Kossi', 'tailleur@couturtech.tg', '+228 90 00 00 02', 'TAILLEUR'],
  ['Tailleur', 'Akouvi', 'tailleur2@couturtech.tg', '+228 90 00 00 03', 'TAILLEUR'],
  ['Livreur', 'Yao', 'livreur@couturtech.tg', '+228 90 00 00 04', 'LIVREUR'],
  ['Client', 'Ama', 'client@couturtech.tg', '+228 90 00 00 05', 'CLIENT', 'Rue de la démo', 'Bè'],
  ['Client', 'Komla', 'client2@couturtech.tg', '+228 90 00 00 06', 'CLIENT', 'Rue de la démo', 'Tokoin'],
];

const M = (s, m, l, xl, x2, x3) => ({ S: s, M: m, L: l, XL: xl, '2XL': x2, '3XL': x3 });
const MODELES = [
  ['RS-01', 'Robe sirène wax', 'Femme', 'Robe longue ajustée, évasée sous le genou. Encolure bateau, fermeture invisible au dos.', 25000, 7, true, 'robe-sirene-wax', M(3, 3.5, 3.5, 4, 4.5, 5)],
  ['BB-01', 'Grand boubou bazin homme', 'Homme', 'Boubou ample trois pièces en bazin, broderie à l’encolure, pantalon assorti.', 35000, 10, true, 'boubou-bazin-homme', M(5, 5.5, 6, 6.5, 7, 7.5)],
  ['CH-01', 'Chemise wax homme', 'Homme', 'Chemise manches courtes, col classique, coupe droite.', 10000, 4, false, 'chemise-wax-homme', M(2, 2, 2.5, 2.5, 3, 3)],
  ['RD-01', 'Robe de soirée dentelle', 'Femme', 'Robe de cérémonie doublée, dentelle sur le buste et les manches.', 45000, 12, true, 'robe-soiree-dentelle', M(3.5, 4, 4, 4.5, 5, 5.5)],
  ['KS-01', 'Kaba et slit', 'Femme', 'Ensemble traditionnel : kaba ajusté et pagne slit.', 18000, 6, false, 'kaba-slit', M(4, 4, 4.5, 5, 5, 5.5)],
  ['EH-01', 'Ensemble homme 3 pièces', 'Homme', 'Tunique, pantalon et bonnet assortis.', 28000, 8, false, 'ensemble-homme-3-pieces', M(4.5, 5, 5, 5.5, 6, 6.5)],
  ['JT-01', 'Ensemble jupe et top', 'Femme', 'Top à basque et jupe crayon mi-longue.', 20000, 6, true, 'ensemble-jupe-top', M(3, 3, 3.5, 3.5, 4, 4.5)],
  ['RE-01', 'Robe enfant wax', 'Enfant', 'Robe trapèze sans manches, nœud à la taille.', 8000, 3, false, 'robe-enfant-wax', M(1, 1.5, 1.5, 2, 2, 2.5)],
];

const TISSUS = [
  ['Wax orange et bleu', 'Wax', 'Orange / bleu', 'wax-orange-bleu', 3000, 40, 8],
  ['Wax vert et jaune', 'Wax', 'Vert / jaune', 'wax-vert-jaune', 3000, 25, 8],
  ['Wax violet et or', 'Wax', 'Violet / or', 'wax-violet-or', 3500, 9, 8],
  ['Bazin riche bleu roi', 'Bazin', 'Bleu', 'bazin-bleu', 6000, 30, 10],
  ['Bazin riche bordeaux', 'Bazin', 'Bordeaux', 'bazin-bordeaux', 6000, 18, 10],
  ['Dentelle champagne', 'Dentelle', 'Champagne', 'dentelle-champagne', 9000, 15, 5],
  ['Soie émeraude', 'Soie', 'Vert émeraude', 'soie-emeraude', 8000, 12, 4],
  ['Mousseline rose poudré', 'Mousseline', 'Rose', 'mousseline-rose', 4000, 3, 5],
];

async function seed() {
  await initSchema({ reset: true });
  const hash = await bcrypt.hash(MDP_DEMO, 10);
  await tx(async (db) => {
    const ids = {};
    for (const [nom, prenom, email, tel, role, adresse, quartier] of UTILISATEURS) {
      const { rows } = await db.query(
        'INSERT INTO utilisateur (nom, prenom, email, telephone, mot_de_passe_hash, role, adresse, quartier, consentement_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now()) RETURNING id',
        [nom, prenom, email, tel, hash, role, adresse || null, quartier || null]);
      ids[email] = rows[0].id;
    }
    const modeles = [];
    for (const [ref, nom, cat, desc, prix, delai, avant, img, metrages] of MODELES) {
      const { rows } = await db.query('INSERT INTO modele (reference, nom, categorie, description, prix_confection, delai_jours, mis_en_avant) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [ref, nom, cat, desc, prix, delai, avant]);
      await db.query('INSERT INTO modele_photo (modele_id, url, ordre) VALUES ($1,$2,0)', [rows[0].id, `/images/modeles/${img}.webp`]);
      for (const [t, m] of Object.entries(metrages)) await db.query('INSERT INTO modele_metrage (modele_id, taille, metres) VALUES ($1,$2,$3)', [rows[0].id, t, m]);
      modeles.push({ ...rows[0], metrages });
    }
    const tissus = [];
    for (const [nom, type, couleur, img, prix, stock, seuil] of TISSUS) {
      const { rows } = await db.query('INSERT INTO tissu (nom, type, couleur, photo_url, prix_metre, stock_metres, seuil_alerte) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [nom, type, couleur, `/images/tissus/${img}.webp`, prix, stock, seuil]);
      await db.query("INSERT INTO mouvement_stock (tissu_id, type, metres, motif, utilisateur_id) VALUES ($1,'ENTREE',$2,'Stock initial',$3)", [rows[0].id, stock, ids['gerant@couturtech.tg']]);
      tissus.push(rows[0]);
    }

    const today = todayISO();
    const gerant = ids['gerant@couturtech.tg'];
    // [client, modèle, taille, tissu (index ou null = tissu client), statuts successifs, tailleur, deadline (jours), payé]
    const demos = [
      ['client@couturtech.tg', 0, 'M', 0, ['CONFIRMEE'], null, null, 0],
      ['client@couturtech.tg', 3, 'L', null, ['CONFIRMEE', 'EN_ATTENTE_COLLECTE'], null, null, 0, 'A_PLANIFIER'],
      ['client2@couturtech.tg', 1, 'XL', 3, ['CONFIRMEE', 'ATTRIBUEE', 'EN_CONFECTION'], 'tailleur@couturtech.tg', 2, 20000],
      ['client2@couturtech.tg', 2, 'L', 1, ['CONFIRMEE', 'ATTRIBUEE'], 'tailleur2@couturtech.tg', -1, 0],
      ['client@couturtech.tg', 6, 'S', 5, ['CONFIRMEE', 'ATTRIBUEE', 'EN_CONFECTION', 'PRETE'], 'tailleur@couturtech.tg', 0, 15000],
      ['client2@couturtech.tg', 5, 'M', null, ['CONFIRMEE', 'EN_ATTENTE_COLLECTE'], null, null, 0, 'PLANIFIEE'],
      ['client@couturtech.tg', 4, 'M', 4, ['CONFIRMEE', 'ATTRIBUEE', 'EN_CONFECTION', 'PRETE', 'EN_ESSAYAGE', 'RETIREE'], 'tailleur2@couturtech.tg', -3, 'SOLDE'],
    ];
    for (const [clientEmail, mi, taille, ti, statuts, tailleurEmail, dl, paye, collecte] of demos) {
      const m = modeles[mi];
      const t = ti === null ? null : tissus[ti];
      const metrage = m.metrages[taille];
      const prixTissu = t ? Math.round(t.prix_metre * metrage) : 0;
      const total = m.prix_confection + prixTissu;
      const montant = paye === 'SOLDE' ? total : paye;
      const statut = statuts[statuts.length - 1];
      const numero = await prochainNumero(db, 'CMD');
      const deadline = dl === null ? null : addDays(today, dl);
      const debut = addDays(today, dl !== null && dl < 0 ? dl - 4 : -1);
      const { rows } = await db.query(
        `INSERT INTO commande (numero, client_id, modele_id, taille, source_tissu, tissu_id, description_tissu_client, metrage, prix_confection, prix_tissu, total, statut,
          statut_paiement, montant_paye, date_debut, date_remise_prevue, tailleur_id, deadline, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$15::date + time '09:00')
         RETURNING id`,
        [numero, ids[clientEmail], m.id, taille, t ? 'MAISON' : 'CLIENT', t ? t.id : null, t ? null : 'Bazin blanc, 6 mètres, apporté par le client', metrage,
          m.prix_confection, prixTissu, total, statut, montant === 0 ? 'NON_PAYE' : montant < total ? 'ACOMPTE' : 'SOLDE', montant, debut,
          addDays(debut, m.delai_jours + 2), tailleurEmail ? ids[tailleurEmail] : null, deadline]);
      const cid = rows[0].id;
      let prev = null;
      for (const s of statuts) {
        await db.query('INSERT INTO historique_statut (commande_id, ancien_statut, nouveau_statut, utilisateur_id, motif) VALUES ($1,$2,$3,$4,$5)',
          [cid, prev, s, s === 'CONFIRMEE' ? ids[clientEmail] : gerant, s === 'ATTRIBUEE' ? 'Attribution démo' : null]);
        prev = s;
      }
      if (t) await db.query("INSERT INTO mouvement_stock (tissu_id, commande_id, type, metres, motif) VALUES ($1,$2,'SORTIE',$3,$4)", [t.id, cid, -metrage, `Réservation commande ${numero}`]);
      if (t) await db.query('UPDATE tissu SET stock_metres = stock_metres - $2 WHERE id = $1', [t.id, metrage]);
      if (collecte) {
        await db.query('INSERT INTO collecte (commande_id, adresse, quartier, repere, telephone, date_souhaitee, creneau_souhaite, livreur_id, date_prevue, creneau, statut) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [cid, 'Rue de la démo', clientEmail === 'client@couturtech.tg' ? 'Bè' : 'Tokoin', 'Portail bleu, face à la pharmacie', clientEmail === 'client@couturtech.tg' ? '+228 90 00 00 05' : '+228 90 00 00 06',
            addDays(today, 1), '10h-12h', collecte === 'PLANIFIEE' ? ids['livreur@couturtech.tg'] : null, collecte === 'PLANIFIEE' ? addDays(today, 1) : null,
            collecte === 'PLANIFIEE' ? '10h-12h' : null, collecte]);
      }
      if (montant > 0) await db.query("INSERT INTO paiement (commande_id, montant, mode, date_paiement, enregistre_par) VALUES ($1,$2,'MOBILE_MONEY',$3,$4)", [cid, montant, debut, gerant]);
      const dev = await prochainNumero(db, 'DEV');
      await db.query("INSERT INTO facture (commande_id, type, numero, montant_total, created_at) VALUES ($1,'DEVIS',$2,$3,$4)", [cid, dev, total, debut]);
      if (statut === 'RETIREE') {
        const fac = await prochainNumero(db, 'FAC');
        await db.query("INSERT INTO facture (commande_id, type, numero, montant_total) VALUES ($1,'FACTURE',$2,$3)", [cid, fac, total]);
      }
      await db.query("INSERT INTO notification (utilisateur_id, commande_id, code, canal, sujet, contenu, statut) VALUES ($1,$2,'N01','INAPP',$3,$4,'ENVOYEE')",
        [ids[clientEmail], cid, `Commande ${numero} confirmée`, `Votre commande ${numero} (${m.nom}, taille ${taille}) est enregistrée.`]);
    }
  });
}

if (require.main === module) {
  seed().then(() => { console.log(`Données de démonstration chargées. Mot de passe des comptes : ${MDP_DEMO}`); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { seed, MDP_DEMO };
