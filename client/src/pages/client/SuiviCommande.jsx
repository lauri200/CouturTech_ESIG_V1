import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ouvrirPdf } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { date, fcfa, MODES_PAIEMENT, PARCOURS_CLIENT, STATUTS } from '../../lib/format';
import { Badge, Erreur, Ligne, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function SuiviCommande() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { data: c, erreur, chargement, recharger, setData } = useApi(`/commandes/${id}`);
  const params = useApi('/parametres/public');
  const toast = useToast();
  const [annul, setAnnul] = useState(false);
  const [err, setErr] = useState(null);
  if (chargement && !c) return <Spinner />;
  if (erreur) return <div className="conteneur py-10"><Erreur erreur={erreur} onRetry={recharger} /></div>;
  const etapes = PARCOURS_CLIENT.filter((s) => c.source_tissu === 'CLIENT' || !['EN_ATTENTE_COLLECTE', 'TISSU_RECU'].includes(s));
  const atteint = new Set(c.historique.map((h) => h.nouveau_statut));
  const idx = etapes.indexOf(c.statut);
  const annulable = c.statut === 'CONFIRMEE' || (c.statut === 'EN_ATTENTE_COLLECTE' && ['A_PLANIFIER', 'PLANIFIEE', 'ECHOUEE'].includes(c.collecte?.statut));
  const annuler = async () => {
    try {
      setData({ ...(await api(`/commandes/${c.id}/annuler`, { method: 'POST', body: {} })), historique: c.historique });
      setAnnul(false);
      toast('Commande annulée.');
      recharger();
    } catch (ex) { setErr(ex); }
  };
  const telecharger = (type) => ouvrirPdf(`/commandes/${c.id}/${type}.pdf`).catch((e) => toast(e.message, 'erreur'));
  return (
    <div className="conteneur max-w-5xl py-8">
      <Link to="/client/commandes" className="btn-lien">← Mes commandes</Link>
      {sp.get('confirmee') && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
          <p className="font-semibold">Commande confirmée !</p>
          <p className="text-sm">Un e-mail de confirmation vous a été envoyé. {c.source_tissu === 'CLIENT' ? 'Nous vous contactons pour la collecte de votre tissu.' : 'Votre commande va être attribuée à un tailleur.'}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="titre-section">Commande {c.numero}</h1>
        <Badge statut={c.statut} />
      </div>

      {c.statut !== 'ANNULEE' && (
        <ol className="carte mt-6 grid gap-3 p-4 sm:grid-cols-4 lg:grid-cols-8" aria-label="Avancement">
          {etapes.map((s, i) => {
            const fait = atteint.has(s) || i <= idx;
            return (
              <li key={s} className="flex items-center gap-2 sm:flex-col sm:items-start">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === idx ? 'bg-or text-white ring-4 ring-or/20' : fait ? 'bg-nuit text-white' : 'bg-nuit/10 text-nuit/50'}`}>{fait && i !== idx ? '✓' : i + 1}</span>
                <span className={`text-xs font-medium ${fait ? '' : 'text-nuit/50'}`}>{STATUTS[s].libelle}</span>
              </li>
            );
          })}
        </ol>
      )}

      {['PRETE', 'EN_ESSAYAGE'].includes(c.statut) && (
        <div className="mt-4 rounded-xl bg-nuit p-5 text-white">
          <p className="font-titre text-xl font-semibold">Votre tenue est prête : venez l’essayer.</p>
          <p className="mt-1 text-sm text-white/80">{params.data?.ADRESSE_ATELIER} · {params.data?.HORAIRES_ATELIER}</p>
          <p className="mt-1 text-sm text-white/80">Les retouches sont faites sur place. Reste à payer : <strong>{fcfa(c.reste_a_payer)}</strong>.</p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="carte flex gap-4 p-4">
            <img src={c.modele_photo} alt="" className="h-32 w-24 rounded-lg object-cover" />
            <div className="text-sm">
              <p className="text-lg font-semibold">{c.modele_nom}</p>
              <p>Taille <strong>{c.taille}</strong> · {c.metrage} m</p>
              <p>{c.source_tissu === 'MAISON' ? <>Tissu : <strong>{c.tissu_nom}</strong></> : <>Votre tissu : {c.description_tissu_client}</>}</p>
              <p className="mt-2">Remise prévue : <strong>{date(c.date_remise_prevue)}</strong></p>
              {c.notes_retouches && <p className="mt-2 text-nuit/70">Retouches : {c.notes_retouches}</p>}
            </div>
          </section>
          {c.collecte && (
            <section className="carte p-4">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Collecte du tissu</h2><Badge statut={c.collecte.statut} type="collecte" /></div>
              <dl className="mt-2">
                <Ligne label="Adresse">{c.collecte.adresse}, {c.collecte.quartier}</Ligne>
                <Ligne label="Souhaitée">{date(c.collecte.date_souhaitee)} · {c.collecte.creneau_souhaite}</Ligne>
                {c.collecte.date_prevue && <Ligne label="Prévue">{date(c.collecte.date_prevue)} · {c.collecte.creneau}</Ligne>}
                {c.collecte.motif_echec && c.collecte.statut === 'ECHOUEE' && <Ligne label="Motif">{c.collecte.motif_echec}</Ligne>}
              </dl>
            </section>
          )}
          <section className="carte p-4">
            <h2 className="text-lg font-semibold">Historique</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.historique.map((h) => (
                <li key={h.id} className="flex justify-between gap-4"><span>{h.ancien_statut === h.nouveau_statut ? 'Date modifiée' : STATUTS[h.nouveau_statut]?.libelle}</span><span className="text-nuit/60">{date(h.created_at, true)}</span></li>
              ))}
            </ul>
          </section>
        </div>
        <aside className="space-y-4">
          <section className="carte p-4">
            <dl>
              <Ligne label="Confection">{fcfa(c.prix_confection)}</Ligne>
              <Ligne label="Tissu">{c.source_tissu === 'MAISON' ? fcfa(c.prix_tissu) : 'Fourni'}</Ligne>
              {c.frais_collecte > 0 && <Ligne label="Collecte">{fcfa(c.frais_collecte)}</Ligne>}
              <div className="flex justify-between border-t border-nuit/10 pt-2 font-bold"><span>Total</span><span>{fcfa(c.total)}</span></div>
              <Ligne label="Payé">{fcfa(c.montant_paye)}</Ligne>
              <Ligne label="Reste à payer">{fcfa(c.reste_a_payer)}</Ligne>
            </dl>
            <div className="mt-2"><Badge statut={c.statut_paiement} type="paiement" /></div>
            {c.paiements.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-nuit/10 pt-3 text-xs text-nuit/70">
                {c.paiements.map((p) => <li key={p.id}>{date(p.date_paiement)} · {MODES_PAIEMENT[p.mode]} · {fcfa(p.montant)}</li>)}
              </ul>
            )}
          </section>
          <section className="carte space-y-2 p-4">
            {c.documents.some((d) => d.type === 'DEVIS') && <button type="button" className="btn-contour w-full" onClick={() => telecharger('devis')}>Télécharger le devis (PDF)</button>}
            {c.documents.some((d) => d.type === 'FACTURE') && <button type="button" className="btn-primaire w-full" onClick={() => telecharger('facture')}>Télécharger la facture (PDF)</button>}
            {annulable && <button type="button" className="btn-danger w-full" onClick={() => setAnnul(true)}>Annuler la commande</button>}
          </section>
        </aside>
      </div>
      <Modal ouvert={annul} titre="Annuler cette commande ?" onFermer={() => setAnnul(false)}>
        <p className="text-sm">La commande {c.numero} sera annulée{c.source_tissu === 'CLIENT' ? ' et la collecte de votre tissu ne sera pas effectuée' : ''}.</p>
        <Erreur erreur={err} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-contour" onClick={() => setAnnul(false)}>Retour</button>
          <button type="button" className="btn bg-red-700 text-white hover:bg-red-800" onClick={annuler}>Confirmer l’annulation</button>
        </div>
      </Modal>
    </div>
  );
}
