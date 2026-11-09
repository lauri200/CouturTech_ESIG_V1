import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { aujourdhui, date } from '../../lib/format';
import { Badge, Champ, EnTete, Erreur, Modal, Spinner, Vide } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function Collectes() {
  const [filtre, setFiltre] = useState('A_PLANIFIER,ECHOUEE,PLANIFIEE,COLLECTEE');
  const { data, erreur, recharger } = useApi(`/collectes${filtre ? `?statut=${filtre}` : ''}`);
  const livreurs = useApi('/utilisateurs?role=LIVREUR');
  const params = useApi('/parametres');
  const toast = useToast();
  const [sel, setSel] = useState(null);
  const [f, setF] = useState({});
  const [err, setErr] = useState(null);
  const creneaux = (params.data?.CRENEAUX_COLLECTE || '').split(',').filter(Boolean);
  const planifier = async () => {
    try {
      await api(`/collectes/${sel.id}/planifier`, { method: 'PATCH', body: { ...f, livreur_id: Number(f.livreur_id) || undefined } });
      setSel(null); toast('Collecte planifiée : client et livreur prévenus.'); recharger();
    } catch (e) { setErr(e); }
  };
  const remettre = async (co) => {
    try { await api(`/collectes/${co.id}/statut`, { method: 'PATCH', body: { statut: 'REMISE_ATELIER' } }); toast('Tissu reçu à l’atelier.'); recharger(); } catch (e) { toast(e.message, 'erreur'); }
  };
  return (
    <>
      <EnTete titre="Collectes de tissu" sousTitre="Planifiez le passage du livreur chez le client" />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['A_PLANIFIER,ECHOUEE,PLANIFIEE,COLLECTEE', 'En cours'], ['A_PLANIFIER,ECHOUEE', 'À planifier'], ['REMISE_ATELIER', 'Terminées'], ['', 'Toutes']].map(([v, l]) => (
          <button key={l} type="button" onClick={() => setFiltre(v)} className={`rounded-full px-4 py-2 text-sm font-medium ${filtre === v ? 'bg-nuit text-white' : 'border border-nuit/15 bg-white'}`}>{l}</button>
        ))}
      </div>
      <Erreur erreur={erreur} onRetry={recharger} />
      {!data ? <Spinner /> : data.length === 0 ? <Vide titre="Aucune collecte" /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((co) => (
            <article key={co.id} className="carte p-4 text-sm">
              <div className="flex items-center justify-between gap-2"><Link to={`/gerant/commandes/${co.commande_id}`} className="font-semibold text-or-600">{co.numero}</Link><Badge statut={co.statut} type="collecte" /></div>
              <p className="mt-2 font-medium">{co.client_nom} · <a href={`tel:${co.telephone}`} className="text-or-600">{co.telephone}</a></p>
              <p>{co.adresse}, {co.quartier}</p>
              {co.repere && <p className="text-nuit/60">Repère : {co.repere}</p>}
              <p className="mt-2 text-nuit/70">Souhaitée : {date(co.date_souhaitee)} · {co.creneau_souhaite}</p>
              {co.date_prevue && <p className="text-nuit/70">Prévue : {date(co.date_prevue)} · {co.creneau} · {co.livreur_nom}</p>}
              {co.statut === 'ECHOUEE' && <p className="mt-1 text-red-700">Échec : {co.motif_echec}</p>}
              <p className="mt-2 text-xs text-nuit/60">Tissu : {co.description_tissu_client}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['A_PLANIFIER', 'ECHOUEE', 'PLANIFIEE'].includes(co.statut) && (
                  <button type="button" className="btn-or" onClick={() => { setErr(null); setSel(co); setF({ livreur_id: co.livreur_id || '', date_prevue: co.date_prevue || (co.date_souhaitee >= aujourdhui() ? co.date_souhaitee : aujourdhui()), creneau: co.creneau || co.creneau_souhaite }); }}>
                    {co.statut === 'PLANIFIEE' ? 'REPLANIFIER' : 'PLANIFIER'}
                  </button>
                )}
                {co.statut === 'COLLECTEE' && <button type="button" className="btn-primaire" onClick={() => remettre(co)}>TISSU REÇU À L’ATELIER</button>}
              </div>
            </article>
          ))}
        </div>
      )}
      <Modal ouvert={Boolean(sel)} titre={`Planifier la collecte ${sel?.numero || ''}`} onFermer={() => setSel(null)}>
        <div className="space-y-4">
          <Champ label="Livreur" id="lv"><select id="lv" className="champ" value={f.livreur_id} onChange={(e) => setF({ ...f, livreur_id: e.target.value })}>
            <option value="">Choisir…</option>{livreurs.data?.filter((l) => l.actif).map((l) => <option key={l.id} value={l.id}>{l.prenom} {l.nom} ({l.collectes_en_cours} en cours)</option>)}
          </select></Champ>
          <Champ label="Date" id="dt"><input id="dt" type="date" min={aujourdhui()} className="champ" value={f.date_prevue} onChange={(e) => setF({ ...f, date_prevue: e.target.value })} /></Champ>
          <Champ label="Créneau" id="cr"><select id="cr" className="champ" value={f.creneau} onChange={(e) => setF({ ...f, creneau: e.target.value })}>{creneaux.map((c) => <option key={c} value={c}>{c}</option>)}</select></Champ>
          <Erreur erreur={err} />
          <button type="button" className="btn-or w-full" onClick={planifier}>CONFIRMER</button>
        </div>
      </Modal>
    </>
  );
}
