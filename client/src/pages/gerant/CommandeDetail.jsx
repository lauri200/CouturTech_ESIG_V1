import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ouvrirPdf } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { aujourdhui, date, fcfa, MODES_PAIEMENT } from '../../lib/format';
import { Badge, Champ, Erreur, Ligne, Modal, Retard, Spinner } from '../../components/ui';
import Historique from '../../components/Historique';
import { useToast } from '../../components/Toast';

export default function CommandeDetail() {
  const { id } = useParams();
  const { data: c, erreur, chargement, recharger } = useApi(`/commandes/${id}`);
  const tailleurs = useApi('/utilisateurs?role=TAILLEUR');
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [f, setF] = useState({});
  const [err, setErr] = useState(null);
  if (chargement && !c) return <Spinner />;
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;

  const ouvrir = (m, init = {}) => { setErr(null); setF(init); setModal(m); };
  const action = async (path, method, body, msg) => {
    try {
      await api(`/commandes/${c.id}${path}`, { method, body });
      setModal(null);
      toast(msg);
      recharger();
    } catch (ex) { setErr(ex); if (!modal) toast(ex.message, 'erreur'); }
  };
  const statut = (s, msg, extra = {}) => action('/statut', 'PATCH', { statut: s, ...extra }, msg);
  const peutAttribuer = c.statut === 'CONFIRMEE' || c.statut === 'TISSU_RECU';
  const annulable = ['CONFIRMEE', 'EN_ATTENTE_COLLECTE', 'TISSU_RECU', 'ATTRIBUEE'].includes(c.statut);

  return (
    <>
      <Link to="/gerant/commandes" className="btn-lien">← Commandes</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">{c.numero}</h1>
        <Badge statut={c.statut} />{c.en_retard && <Retard />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {peutAttribuer && <button type="button" className="btn-or" onClick={() => ouvrir('attribuer', { tailleur_id: c.tailleur_id || '', deadline: c.date_remise_prevue })}>ATTRIBUER</button>}
        {c.statut === 'EN_ATTENTE_COLLECTE' && <Link to="/gerant/collectes" className="btn-contour">Gérer la collecte</Link>}
        {c.statut === 'ATTRIBUEE' && <button type="button" className="btn-contour" onClick={() => statut('EN_CONFECTION', 'Confection démarrée.')}>DÉMARRER LA CONFECTION</button>}
        {c.statut === 'EN_CONFECTION' && <button type="button" className="btn-primaire" onClick={() => statut('PRETE', 'Commande prête : client prévenu.')}>MARQUER PRÊTE</button>}
        {c.statut === 'PRETE' && <button type="button" className="btn-primaire" onClick={() => statut('EN_ESSAYAGE', 'Essayage en cours.')}>CLIENT EN ESSAYAGE</button>}
        {c.statut === 'EN_ESSAYAGE' && <button type="button" className="btn-or" onClick={() => ouvrir('retrait', { notes_retouches: c.notes_retouches || '' })}>MARQUER RETIRÉE</button>}
        {!['RETIREE', 'ANNULEE'].includes(c.statut) && c.reste_a_payer > 0 && <button type="button" className="btn-contour" onClick={() => ouvrir('paiement', { montant: c.reste_a_payer, mode: 'ESPECES', reference: '', date_paiement: aujourdhui() })}>ENREGISTRER UN PAIEMENT</button>}
        {!['RETIREE', 'ANNULEE'].includes(c.statut) && <button type="button" className="btn-contour" onClick={() => ouvrir('date', { deadline: c.deadline || '', date_remise_prevue: c.date_remise_prevue, motif: '' })}>MODIFIER LES DATES</button>}
        <button type="button" className="btn-contour" onClick={() => ouvrirPdf(`/commandes/${c.id}/devis.pdf`).catch((e) => toast(e.message, 'erreur'))}>Devis PDF</button>
        {c.documents.some((d) => d.type === 'FACTURE') && <button type="button" className="btn-contour" onClick={() => ouvrirPdf(`/commandes/${c.id}/facture.pdf`)}>Facture PDF</button>}
        {annulable && <button type="button" className="btn-danger" onClick={() => ouvrir('annuler', { motif: '' })}>ANNULER</button>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="carte grid gap-4 p-4 sm:grid-cols-[110px_1fr]">
            <img src={c.modele_photo} alt="" className="h-36 w-[110px] rounded-lg object-cover" />
            <dl className="text-sm">
              <Ligne label="Modèle">{c.modele_nom} ({c.modele_reference})</Ligne>
              <Ligne label="Taille / métrage">{c.taille} · {c.metrage} m</Ligne>
              <Ligne label="Tissu">{c.source_tissu === 'MAISON' ? c.tissu_nom : `Client : ${c.description_tissu_client}`}</Ligne>
              <Ligne label="Tailleur">{c.tailleur_nom || '—'}</Ligne>
              <Ligne label="Deadline tailleur">{date(c.deadline)}</Ligne>
              <Ligne label="Remise prévue au client">{date(c.date_remise_prevue)}</Ligne>
            </dl>
            {c.photo_tissu_client_url && <img src={c.photo_tissu_client_url} alt="Tissu du client" className="h-28 w-28 rounded-lg object-cover sm:col-start-2" />}
          </section>
          <section className="carte grid gap-4 p-4 sm:grid-cols-2">
            <div>
              <h2 className="font-semibold">Client</h2>
              <p className="mt-1 text-sm">{c.client_prenom} {c.client_nom}</p>
              <p className="text-sm"><a href={`tel:${c.client_telephone}`} className="text-or-600">{c.client_telephone}</a></p>
              <p className="text-sm text-nuit/60">{c.client_email}</p>
            </div>
            <div>
              <h2 className="font-semibold">Notes</h2>
              <p className="mt-1 text-sm"><span className="text-nuit/60">Tailleur :</span> {c.note_tailleur || '—'}</p>
              <p className="text-sm"><span className="text-nuit/60">Retouches :</span> {c.notes_retouches || '—'}</p>
            </div>
          </section>
          {c.collecte && (
            <section className="carte p-4">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Collecte</h2><Badge statut={c.collecte.statut} type="collecte" /></div>
              <dl className="mt-2 text-sm">
                <Ligne label="Adresse">{c.collecte.adresse}, {c.collecte.quartier}</Ligne>
                <Ligne label="Repère">{c.collecte.repere || '—'}</Ligne>
                <Ligne label="Souhaitée">{date(c.collecte.date_souhaitee)} · {c.collecte.creneau_souhaite}</Ligne>
                <Ligne label="Livreur">{c.collecte.livreur_nom || '—'}{c.collecte.date_prevue ? ` · ${date(c.collecte.date_prevue)} ${c.collecte.creneau}` : ''}</Ligne>
              </dl>
            </section>
          )}
        </div>
        <div className="space-y-6">
          <section className="carte p-4">
            <h2 className="font-semibold">Paiement</h2>
            <dl className="mt-2 text-sm">
              <Ligne label="Confection">{fcfa(c.prix_confection)}</Ligne>
              <Ligne label="Tissu">{fcfa(c.prix_tissu)}</Ligne>
              {c.frais_collecte > 0 && <Ligne label="Collecte">{fcfa(c.frais_collecte)}</Ligne>}
              <Ligne label="Total"><strong>{fcfa(c.total)}</strong></Ligne>
              <Ligne label="Payé">{fcfa(c.montant_paye)}</Ligne>
              <Ligne label="Reste"><strong>{fcfa(c.reste_a_payer)}</strong></Ligne>
            </dl>
            <Badge statut={c.statut_paiement} type="paiement" />
            {c.paiements.length > 0 && <ul className="mt-3 space-y-1 border-t border-nuit/10 pt-2 text-xs">{c.paiements.map((p) => <li key={p.id}>{date(p.date_paiement)} · {MODES_PAIEMENT[p.mode]} · {fcfa(p.montant)}{p.reference ? ` · ${p.reference}` : ''}</li>)}</ul>}
          </section>
          <section className="carte p-4"><h2 className="mb-3 font-semibold">Historique</h2><Historique items={c.historique} /></section>
        </div>
      </div>

      <Modal ouvert={modal === 'attribuer'} titre="Attribuer à un tailleur" onFermer={() => setModal(null)}>
        <div className="space-y-4">
          <Champ label="Tailleur" id="ta"><select id="ta" className="champ" value={f.tailleur_id} onChange={(e) => setF({ ...f, tailleur_id: e.target.value })}>
            <option value="">Choisir…</option>{tailleurs.data?.filter((t) => t.actif).map((t) => <option key={t.id} value={t.id}>{t.prenom} {t.nom} ({t.taches_en_cours} en cours)</option>)}
          </select></Champ>
          <Champ label="Deadline" id="dl" aide={`Au plus tard le ${date(c.date_remise_prevue)} (remise prévue)`}><input id="dl" type="date" className="champ" min={aujourdhui()} max={c.date_remise_prevue} value={f.deadline || ''} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Champ>
          <Erreur erreur={err} />
          <button type="button" className="btn-or w-full" onClick={() => action('/attribuer', 'POST', { tailleur_id: Number(f.tailleur_id) || undefined, deadline: f.deadline || undefined }, 'Commande attribuée.')}>CONFIRMER L’ATTRIBUTION</button>
        </div>
      </Modal>
      <Modal ouvert={modal === 'date'} titre="Modifier les dates" onFermer={() => setModal(null)}>
        <div className="space-y-4">
          {c.deadline && <Champ label="Deadline tailleur" id="d1"><input id="d1" type="date" className="champ" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Champ>}
          <Champ label="Date de remise au client" id="d2" aide="Le client est prévenu si elle change"><input id="d2" type="date" className="champ" value={f.date_remise_prevue} onChange={(e) => setF({ ...f, date_remise_prevue: e.target.value })} /></Champ>
          <Champ label="Motif (obligatoire)" id="mo"><input id="mo" className="champ" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} /></Champ>
          <Erreur erreur={err} />
          <button type="button" className="btn-primaire w-full" onClick={() => action('/deadline', 'PATCH', { ...(c.deadline && f.deadline ? { deadline: f.deadline } : {}), date_remise_prevue: f.date_remise_prevue, motif: f.motif }, 'Dates modifiées.')}>ENREGISTRER</button>
        </div>
      </Modal>
      <Modal ouvert={modal === 'paiement'} titre="Enregistrer un paiement" onFermer={() => setModal(null)}>
        <div className="space-y-4">
          <Champ label="Montant (FCFA)" id="mt" aide={`Reste à payer : ${fcfa(c.reste_a_payer)}`}><input id="mt" type="number" min="1" max={c.reste_a_payer} className="champ" value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} /></Champ>
          <Champ label="Mode" id="md"><select id="md" className="champ" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>{Object.entries(MODES_PAIEMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Champ>
          <Champ label="Référence (facultatif)" id="rf"><input id="rf" className="champ" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Champ>
          <Champ label="Date" id="dp"><input id="dp" type="date" className="champ" value={f.date_paiement} onChange={(e) => setF({ ...f, date_paiement: e.target.value })} /></Champ>
          <Erreur erreur={err} />
          <button type="button" className="btn-or w-full" onClick={() => action('/paiements', 'POST', { ...f, montant: Number(f.montant) }, 'Paiement enregistré.')}>ENREGISTRER</button>
        </div>
      </Modal>
      <Modal ouvert={modal === 'retrait'} titre="Retrait de la tenue" onFermer={() => setModal(null)}>
        <div className="space-y-4">
          {c.statut_paiement !== 'SOLDE' && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Solde non réglé : reste {fcfa(c.reste_a_payer)}. Enregistrez le paiement avant le retrait.</p>}
          <Champ label="Retouches effectuées (facultatif)" id="rt"><textarea id="rt" rows={3} className="champ" value={f.notes_retouches} onChange={(e) => setF({ ...f, notes_retouches: e.target.value })} /></Champ>
          <Erreur erreur={err} />
          <button type="button" className="btn-or w-full" onClick={() => statut('RETIREE', 'Commande retirée : facture générée.', { notes_retouches: f.notes_retouches })}>CONFIRMER LE RETRAIT</button>
        </div>
      </Modal>
      <Modal ouvert={modal === 'annuler'} titre="Annuler la commande" onFermer={() => setModal(null)}>
        <div className="space-y-4">
          <Champ label="Motif (obligatoire)" id="ma"><input id="ma" className="champ" value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} /></Champ>
          <Erreur erreur={err} />
          <button type="button" className="btn w-full bg-red-700 text-white hover:bg-red-800" onClick={() => action('/annuler', 'POST', { motif: f.motif }, 'Commande annulée.')}>CONFIRMER L’ANNULATION</button>
        </div>
      </Modal>
    </>
  );
}
