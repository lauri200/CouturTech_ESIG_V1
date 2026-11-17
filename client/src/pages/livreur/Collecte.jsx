import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { date, libelleMission, TYPES_MISSION } from '../../lib/format';
import { Champ, Erreur, Ligne, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function Collecte() {
  const { id } = useParams();
  const { data: co, erreur, recharger } = useApi(`/collectes/${id}`);
  const toast = useToast();
  const [absent, setAbsent] = useState(false);
  const [motif, setMotif] = useState('Client absent');
  const [err, setErr] = useState(null);
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  if (!co) return <Spinner />;
  const maj = async (statut, msg, m) => {
    try { await api(`/collectes/${co.id}/statut`, { method: 'PATCH', body: { statut, ...(m ? { motif: m } : {}) } }); setAbsent(false); toast(msg); recharger(); } catch (e) { setErr(e); toast(e.message, 'erreur'); }
  };
  return (
    <div className="max-w-xl">
      <Link to="/livreur" className="btn-lien">← Mes missions</Link>
      <div className="mt-3 flex items-center gap-3"><h1 className="text-2xl font-bold">{co.numero}</h1><span className="rounded-full bg-nuit/5 px-2 py-0.5 text-xs font-semibold">{libelleMission(co)}</span></div>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-nuit/60">{TYPES_MISSION[co.type]?.libelle}</p>
      <section className="carte mt-4 p-4">
        <p className="text-lg font-semibold">{date(co.date_prevue)} · {co.creneau}</p>
        <dl className="mt-2">
          <Ligne label="Client">{co.client_nom}</Ligne>
          <Ligne label="Adresse">{co.adresse}</Ligne>
          <Ligne label="Quartier">{co.quartier}</Ligne>
          {co.repere && <Ligne label="Repère">{co.repere}</Ligne>}
          <Ligne label="Téléphone">{co.telephone === '—' ? '—' : <a href={`tel:${co.telephone}`} className="text-or-600">{co.telephone}</a>}</Ligne>
        </dl>
        {co.type === 'TISSU' && <p className="mt-3 rounded-lg bg-nuit-50 p-3 text-sm">Tissu : {co.description_tissu_client}</p>}
        {co.type === 'LIVRAISON' && <p className="mt-3 rounded-lg bg-nuit-50 p-3 text-sm">Tenue à remettre au client (commande soldée).</p>}
        {co.type === 'RETOUCHE' && <p className="mt-3 rounded-lg bg-nuit-50 p-3 text-sm">Tenue à récupérer pour retouche, puis à remettre à l’atelier.</p>}
        {co.type === 'TISSU' && co.photo_tissu_client_url && co.statut !== 'REMISE_ATELIER' && <img src={co.photo_tissu_client_url} alt="Tissu à récupérer" className="mt-3 h-32 w-32 rounded-lg object-cover" />}
        {co.statut === 'PLANIFIEE' && co.telephone !== '—' && <a href={`tel:${co.telephone}`} className="btn-contour mt-4 w-full">APPELER LE CLIENT</a>}
      </section>
      <Erreur erreur={err} />
      <div className="mt-4 space-y-2">
        {co.statut === 'PLANIFIEE' && <>
          <button type="button" className="btn-or w-full text-base" onClick={() => maj('COLLECTEE', co.type === 'LIVRAISON' ? 'Tenue livrée.' : 'Récupération enregistrée.')}>{{ TISSU: 'TISSU RÉCUPÉRÉ', LIVRAISON: 'TENUE LIVRÉE AU CLIENT', RETOUCHE: 'TENUE RÉCUPÉRÉE' }[co.type]}</button>
          <button type="button" className="btn-danger w-full" onClick={() => setAbsent(true)}>CLIENT ABSENT</button>
        </>}
        {co.statut === 'COLLECTEE' && co.type !== 'LIVRAISON' && <button type="button" className="btn-primaire w-full text-base" onClick={() => maj('REMISE_ATELIER', 'Remis à l’atelier.')}>REMISE À L’ATELIER</button>}
        {(co.statut === 'REMISE_ATELIER' || (co.type === 'LIVRAISON' && co.statut === 'COLLECTEE')) && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Mission terminée. Les coordonnées du client ne sont plus affichées.</p>}
      </div>
      <Modal ouvert={absent} titre="Mission non effectuée" onFermer={() => setAbsent(false)}>
        <Champ label="Motif" id="mo"><select id="mo" className="champ" value={motif} onChange={(e) => setMotif(e.target.value)}><option>Client absent</option><option>Client injoignable</option><option>Adresse introuvable</option><option>Tissu non prêt</option></select></Champ>
        <button type="button" className="btn bg-red-700 mt-4 w-full text-white" onClick={() => maj('ECHOUEE', 'Échec signalé au gérant.', motif)}>CONFIRMER</button>
      </Modal>
    </div>
  );
}
