const nodemailer = require('nodemailer');
const config = require('../config');
const { query } = require('../db');
const { getParams } = require('./params');

// Messages types du CDC (§10). Variables entre accolades.
const MODELES = {
  N01: { sujet: 'CouturTech – Commande {numero} confirmée', texte: 'Bonjour {prenom}, votre commande {numero} ({modele}, taille {taille}) est enregistrée. Montant : {total}. Date de remise : {date}.' },
  N02: { sujet: 'CouturTech – Collecte de votre tissu', texte: 'CouturTech : un livreur récupère votre tissu le {date} entre {creneau}. Commande {numero}.' },
  N03: { sujet: 'CouturTech – Tissu reçu à l’atelier', texte: 'Votre tissu est arrivé à l’atelier. Votre commande {numero} sera prête le {date}.' },
  N04: { sujet: 'CouturTech – Nouvelle tâche', texte: 'Nouvelle tâche : {modele} taille {taille}, commande {numero}. Deadline : {deadline}.' },
  N05: { sujet: 'CouturTech – Rappel de délai', texte: 'Rappel : la commande {numero} doit être prête le {deadline}.' },
  N06: { sujet: 'CouturTech – Retard sur la commande {numero}', texte: 'Retard : commande {numero} non prête à la deadline du {deadline}. Tailleur : {tailleur}.' },
  N07: { sujet: 'CouturTech – Nouvelle date pour la commande {numero}', texte: 'Votre commande {numero} sera prête le {date}. Motif : {motif}.' },
  N08: { sujet: 'CouturTech – Votre commande {numero} est prête', texte: 'Bonne nouvelle {prenom} ! Votre commande {numero} est prête. Venez l’essayer à l’atelier : {adresse}, {horaires}. Reste à payer : {reste}.' },
  N09: { sujet: 'CouturTech – Merci pour votre commande {numero}', texte: 'Merci {prenom} ! Commande {numero} retirée. Votre facture : {lien}.' },
  N10: { sujet: 'CouturTech – Collecte {numero}', texte: 'Collecte {numero} : {adresse} ({repere}), le {date} {creneau}. Contact : {telephone}.' },
  N11: { sujet: 'CouturTech – Collecte non effectuée', texte: 'Nous n’avons pas pu récupérer votre tissu ({motif}). Un nouveau passage vous sera proposé. Commande {numero}.' },
  N12: { sujet: 'CouturTech – Stock bas', texte: 'Stock bas : {tissu} – {stock} m restants (seuil {seuil} m).' },
  N13: { sujet: 'CouturTech – Commande {numero} annulée', texte: 'La commande {numero} a été annulée. Motif : {motif}.' },
};

const remplir = (gabarit, vars) => gabarit.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

let transporter;
function getTransporter() {
  if (!config.mail.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.port === 465,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    });
  }
  return transporter;
}

async function envoyerEmail(to, sujet, texte) {
  const t = getTransporter();
  if (!t) {
    if (config.env !== 'test') console.log(`[EMAIL simulé] → ${to} | ${sujet} | ${texte}`);
    return;
  }
  await t.sendMail({ from: config.mail.from, to, subject: sujet, text: `${texte}\n\n${config.appUrl}` });
}

async function envoyerSms(to, texte) {
  if (!config.sms.apiUrl) {
    if (config.env !== 'test') console.log(`[SMS simulé] → ${to} | ${texte}`);
    return;
  }
  const res = await fetch(config.sms.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.sms.apiKey}` },
    body: JSON.stringify({ to, from: config.sms.sender, message: texte }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`API SMS : HTTP ${res.status}`);
}

async function livrer(notif, user) {
  try {
    if (notif.canal === 'EMAIL') await envoyerEmail(user.email, notif.sujet, notif.contenu);
    if (notif.canal === 'SMS') await envoyerSms(user.telephone, notif.contenu);
    await query("UPDATE notification SET statut = 'ENVOYEE', tentatives = tentatives + 1, erreur = NULL WHERE id = $1", [notif.id]);
  } catch (err) {
    // RG17 : un échec d'envoi ne bloque jamais la transition ; il est journalisé puis relancé par le cron.
    await query("UPDATE notification SET statut = 'ECHEC', tentatives = tentatives + 1, erreur = $2 WHERE id = $1", [notif.id, String(err.message).slice(0, 500)]);
  }
}

/**
 * Envoie la notification `code` à chaque destinataire sur les canaux indiqués.
 * destinataires : [{ user: {id,email,telephone,prenom}, canaux: ['EMAIL','SMS','INAPP'] }]
 */
async function notifier(code, destinataires, vars = {}, commandeId = null) {
  const modele = MODELES[code];
  if (!modele) throw new Error(`Notification inconnue : ${code}`);
  for (const { user, canaux } of destinataires) {
    if (!user) continue;
    const v = { prenom: user.prenom, ...vars };
    const sujet = remplir(modele.sujet, v);
    const contenu = remplir(modele.texte, v);
    for (const canal of canaux) {
      const statut = canal === 'INAPP' ? 'ENVOYEE' : 'EN_ATTENTE';
      const { rows } = await query(
        `INSERT INTO notification (utilisateur_id, commande_id, code, canal, sujet, contenu, statut, tentatives)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [user.id, commandeId, code, canal, sujet, contenu, statut, canal === 'INAPP' ? 1 : 0],
      );
      if (canal !== 'INAPP') await livrer(rows[0], user);
    }
  }
}

async function relancerEchecs() {
  const params = await getParams();
  const max = Number(params.MAX_TENTATIVES_NOTIF) || 3;
  const { rows } = await query(
    `SELECT n.*, u.email, u.telephone FROM notification n JOIN utilisateur u ON u.id = n.utilisateur_id
     WHERE n.statut IN ('ECHEC','EN_ATTENTE') AND n.canal <> 'INAPP' AND n.tentatives < $1`,
    [max],
  );
  for (const n of rows) await livrer(n, { email: n.email, telephone: n.telephone });
  return rows.length;
}

async function getGerants() {
  const { rows } = await query("SELECT id, nom, prenom, email, telephone FROM utilisateur WHERE role = 'GERANT' AND actif");
  return rows;
}

async function getUser(id) {
  if (!id) return null;
  const { rows } = await query('SELECT id, nom, prenom, email, telephone FROM utilisateur WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { MODELES, notifier, relancerEchecs, getGerants, getUser, envoyerEmail };
