import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ouvrirPdf, televerserImage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { date, fcfa, libelleMission, MODES_PAIEMENT, PARCOURS_CLIENT, STATUTS, TYPES_MISSION } from '../../lib/format';
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
  const [retouche, setRetouche] = useState(false);
  const [motif, setMotif] = useState('');
  const [photo, setPhoto] = useState(null);
  const [envoi, setEnvoi] = useState(false);
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
  const demanderRetouche = async () => {
    setEnvoi(true);
    setErr(null);
    try {
      await api(`/commandes/${c.id}/retouche`, { method: 'POST', body: { motif, photo_url: photo } });
      setRetouche(false);
      toast('Demande de retouche envoyée. Nous planifions la récupération de votre tenue.');
      recharger();
    } catch (ex) { setErr(ex); } finally { setEnvoi(false); }
  };
  const ajouterPhoto = async (file) => {
    if (!file) return;
    try { setPhoto((await televerserImage(file)).url); } catch (ex) { setErr(ex); }
  };
  const delaiRetouche = Number(params.data?.DELAI_RETOUCHE_JOURS) || 7;
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

      {['PRETE', 'EN_LIVRAISON'].includes(c.statut) && (
        <div className="mt-4 rounded-xl bg-nuit p-5 text-white">
          <p className="font-titre text-xl font-semibold">{c.statut === 'PRETE' ? 'Votre tenue est prête : elle vous sera livrée à domicile.' : 'Votre tenue est en route.'}</p>
          <p className="mt-1 text-sm text-white/80">Livraison : {c.adresse_livraison}, {c.quartier_livraison}</p>
          {c.reste_a_payer > 0 && <p className="mt-1 text-sm text-white/80">Reste à payer avant la livraison : <strong>{fcfa(c.reste_a_payer)}</strong>.</p>}
        </div>
      )}
      {c.statut === 'LIVREE' && (
        <div className="mt-4 rounded-xl border border-nuit/10 bg-white p-5">
          <p className="font-titre text-xl font-semibold">Votre tenue a été livrée.</p>
          <p className="mt-1 text-sm text-nuit/70">Un ajustement est nécessaire ? Demandez une retouche sous {delaiRetouche} jours : notre livreur vient récupérer la tenue chez vous, sans déplacement.</p>
          <button type="button" className="btn-or mt-3" onClick={() => setRetouche(true)}>Demander une retouche</button>
        </div>
      )}
      {c.statut === 'RETOUCHE_DEMANDEE' && (
        <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-5 text-orange-900" role="status">
          <p className="font-semibold">Retouche demandée</p>
          <p className="text-sm">Nous planifions la récupération de votre tenue. Motif : {c.motif_retouche}</p>
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
          {(c.missions || []).map((m) => (
            <section key={m.id} className="carte p-4">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{TYPES_MISSION[m.type].libelle}</h2><span className="rounded-full bg-nuit/5 px-2 py-0.5 text-xs font-semibold">{libelleMission(m)}</span></div>
              <dl className="mt-2">
                <Ligne label="Adresse">{m.adresse}, {m.quartier}</Ligne>
                {m.date_prevue && <Ligne label="Prévue">{date(m.date_prevue)} · {m.creneau}</Ligne>}
                {m.motif_echec && m.statut === 'ECHOUEE' && <Ligne label="Motif">{m.motif_echec}</Ligne>}
              </dl>
            </section>
          ))}
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
              {c.frais_livraison > 0 && <Ligne label="Livraison">{fcfa(c.frais_livraison)}</Ligne>}
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
      <Modal ouvert={retouche} titre="Demander une retouche" onFermer={() => setRetouche(false)}>
        <label htmlFor="motif" className="text-sm font-semibold">Que faut-il ajuster ?</label>
        <textarea id="motif" rows={4} className="champ mt-1" value={motif} placeholder="Ex. : manches trop longues d’environ 2 cm" onChange={(e) => setMotif(e.target.value)} />
        <label htmlFor="photo" className="mt-3 block text-sm font-semibold">Photo de la tenue portée (facultatif)</label>
        <input id="photo" type="file" accept="image/*" className="mt-1 text-sm" onChange={(e) => ajouterPhoto(e.target.files[0])} />
        {photo && <img src={photo} alt="" className="mt-2 h-24 rounded-lg object-cover" />}
        <Erreur erreur={err} />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-contour" onClick={() => setRetouche(false)}>Retour</button>
          <button type="button" className="btn-or" disabled={envoi || motif.trim().length < 5} onClick={demanderRetouche}>{envoi ? 'Envoi…' : 'Envoyer la demande'}</button>
        </div>
      </Modal>
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
