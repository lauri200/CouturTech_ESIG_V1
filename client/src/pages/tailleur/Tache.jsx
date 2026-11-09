import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { date, joursRestants } from '../../lib/format';
import { Badge, Erreur, Ligne, Retard, Spinner } from '../../components/ui';
import Historique from '../../components/Historique';
import { useToast } from '../../components/Toast';

export default function Tache() {
  const { id } = useParams();
  const { data: c, erreur, recharger } = useApi(`/commandes/${id}`);
  const toast = useToast();
  const [note, setNote] = useState('');
  useEffect(() => { if (c) setNote(c.note_tailleur || ''); }, [c]);
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  if (!c) return <Spinner />;
  const j = joursRestants(c.deadline);
  const avancer = async (statut, msg) => {
    try { await api(`/commandes/${c.id}/statut`, { method: 'PATCH', body: { statut } }); toast(msg); recharger(); } catch (e) { toast(e.message, 'erreur'); }
  };
  const sauverNote = async () => {
    try { await api(`/commandes/${c.id}/notes`, { method: 'PATCH', body: { note_tailleur: note } }); toast('Note enregistrée.'); } catch (e) { toast(e.message, 'erreur'); }
  };
  return (
    <div className="max-w-4xl">
      <Link to="/tailleur" className="btn-lien">← Mes tâches</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{c.numero}</h1><Badge statut={c.statut} />{c.en_retard && <Retard />}</div>
      <div className={`mt-4 rounded-xl p-4 ${c.en_retard ? 'bg-red-700 text-white' : 'bg-nuit text-white'}`}>
        <p className="text-sm uppercase tracking-wide text-white/70">Deadline</p>
        <p className="font-titre text-3xl font-bold">{date(c.deadline)}</p>
        <p className="text-sm text-white/80">{c.en_retard ? 'Deadline dépassée : prévenez le gérant.' : j === 0 ? 'À rendre aujourd’hui' : j > 0 ? `Encore ${j} jour(s)` : ''}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {c.statut === 'ATTRIBUEE' && <button type="button" className="btn-or flex-1 text-base sm:flex-none" onClick={() => avancer('EN_CONFECTION', 'Confection démarrée.')}>DÉMARRER LA CONFECTION</button>}
        {c.statut === 'EN_CONFECTION' && <button type="button" className="btn-or flex-1 text-base sm:flex-none" onClick={() => avancer('PRETE', 'Tenue prête : le client est prévenu.')}>MARQUER PRÊTE</button>}
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="carte p-4">
          <img src={c.modele_photo} alt={c.modele_nom} className="mb-3 aspect-[4/5] w-full rounded-lg object-cover" />
          <dl>
            <Ligne label="Modèle">{c.modele_nom} ({c.modele_reference})</Ligne>
            <Ligne label="Taille">{c.taille}</Ligne>
            <Ligne label="Métrage">{c.metrage} m</Ligne>
            <Ligne label="Client(e)">{c.client_prenom}</Ligne>
          </dl>
        </section>
        <div className="space-y-6">
          <section className="carte p-4">
            <h2 className="font-semibold">Tissu</h2>
            {c.source_tissu === 'MAISON' ? (
              <div className="mt-2 flex items-center gap-3">{c.tissu_photo && <img src={c.tissu_photo} alt="" className="h-20 w-20 rounded-lg object-cover" />}<div><p className="font-medium">{c.tissu_nom}</p><p className="text-sm text-nuit/60">{c.tissu_type} · stock de la maison</p></div></div>
            ) : (
              <div className="mt-2"><p className="text-sm">Tissu apporté par le client : {c.description_tissu_client}</p>{c.photo_tissu_client_url && <img src={c.photo_tissu_client_url} alt="Tissu du client" className="mt-2 h-28 w-28 rounded-lg object-cover" />}</div>
            )}
          </section>
          <section className="carte p-4">
            <h2 className="font-semibold">Note interne</h2>
            <textarea rows={3} className="champ mt-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : doublure à commander, bouton à remplacer…" aria-label="Note interne" />
            <button type="button" className="btn-contour mt-2" onClick={sauverNote}>ENREGISTRER LA NOTE</button>
            {c.notes_retouches && <p className="mt-3 text-sm"><span className="text-nuit/60">Retouches :</span> {c.notes_retouches}</p>}
          </section>
          <section className="carte p-4"><h2 className="mb-3 font-semibold">Historique</h2><Historique items={c.historique} afficherAuteur={false} /></section>
        </div>
      </div>
    </div>
  );
}
