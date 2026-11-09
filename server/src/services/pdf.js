const PDFDocument = require('pdfkit');
const { frDate, fcfa } = require('../utils/dates');

const NAVY = '#1E2A3A';
const GOLD = '#A8842C';

function genererPdf({ type, numero, date, commande, params, paiements }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor(NAVY).fontSize(22).font('Helvetica-Bold').text('CouturTech', 50, 50);
    doc.fillColor('#555').fontSize(9).font('Helvetica')
      .text(params.NOM_MAISON).text(params.ADRESSE_ATELIER).text(`${params.TELEPHONE_MAISON} · ${params.EMAIL_MAISON}`);
    doc.fillColor(GOLD).fontSize(18).font('Helvetica-Bold').text(type === 'DEVIS' ? 'DEVIS' : 'FACTURE', 350, 50, { width: 195, align: 'right' });
    doc.fillColor(NAVY).fontSize(10).font('Helvetica')
      .text(`N° ${numero}`, 350, 75, { width: 195, align: 'right' })
      .text(`Date : ${frDate(date)}`, { width: 195, align: 'right' })
      .text(`Commande : ${commande.numero}`, { width: 195, align: 'right' });

    doc.moveTo(50, 130).lineTo(545, 130).strokeColor(GOLD).lineWidth(1).stroke();
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(10).text('Client', 50, 145);
    doc.font('Helvetica').fillColor('#222')
      .text(`${commande.client_prenom} ${commande.client_nom}`)
      .text(commande.client_telephone || '')
      .text(commande.client_email || '');

    const tissu = commande.source_tissu === 'MAISON'
      ? `${commande.tissu_nom} (${commande.metrage} m × ${fcfa(commande.tissu_prix_metre)})`
      : 'Tissu fourni par le client';
    const lignes = [
      [`Confection – ${commande.modele_nom} (réf. ${commande.modele_reference}), taille ${commande.taille}`, commande.prix_confection],
      [tissu, commande.prix_tissu],
    ];
    if (commande.frais_collecte > 0) lignes.push(['Collecte du tissu à domicile', commande.frais_collecte]);

    let y = 225;
    doc.rect(50, y, 495, 20).fill(NAVY);
    doc.fillColor('#fff').font('Helvetica-Bold').text('Désignation', 58, y + 6).text('Montant', 445, y + 6, { width: 92, align: 'right' });
    y += 24;
    doc.font('Helvetica').fillColor('#222');
    for (const [lib, montant] of lignes) {
      doc.text(lib, 58, y, { width: 370 }).text(fcfa(montant), 445, y, { width: 92, align: 'right' });
      y += 22;
    }
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke();
    y += 10;
    const paye = (paiements || []).reduce((s, p) => s + p.montant, 0);
    const totaux = [['Total', commande.total], ['Payé', paye], ['Reste à payer', Math.max(commande.total - paye, 0)]];
    for (const [lib, v] of totaux) {
      doc.font(lib === 'Total' ? 'Helvetica-Bold' : 'Helvetica').fillColor(NAVY)
        .text(lib, 330, y, { width: 110 }).text(fcfa(v), 445, y, { width: 92, align: 'right' });
      y += 18;
    }
    if (paiements && paiements.length) {
      y += 12;
      doc.font('Helvetica-Bold').fillColor(NAVY).text('Paiements', 50, y);
      y += 16;
      doc.font('Helvetica').fillColor('#222');
      for (const p of paiements) {
        doc.text(`${frDate(p.date_paiement)} – ${p.mode.replace('_', ' ').toLowerCase()}${p.reference ? ` (${p.reference})` : ''}`, 58, y)
          .text(fcfa(p.montant), 445, y, { width: 92, align: 'right' });
        y += 16;
      }
    }
    if (commande.date_remise_prevue) {
      doc.font('Helvetica').fillColor('#555').text(`Date de remise prévue : ${frDate(commande.date_remise_prevue)}`, 50, y + 20);
    }
    doc.fontSize(8).fillColor('#888').text('Document généré par CouturTech. Montants en francs CFA (FCFA).', 50, 780, { width: 495, align: 'center' });
    doc.end();
  });
}

module.exports = { genererPdf };
