import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { date, libelleMission, missionTerminee, TYPES_MISSION } from '../../lib/format';
import { EnTete, Erreur, Spinner, Vide } from '../../components/ui';

export default function MesCollectes() {
  const [onglet, setOnglet] = useState('PLANIFIEE,COLLECTEE');
  const { data: brut, erreur, recharger } = useApi(`/collectes?statut=${onglet}`);
  const histo = onglet.startsWith('REMISE');
  const data = brut?.filter((co) => (co.statut === 'ECHOUEE' && histo) || missionTerminee(co) === histo);
  return (
    <>
      <EnTete titre="Mes missions" sousTitre="Collectes de tissu, livraisons et récupérations pour retouche" />
      <div className="mb-4 flex gap-2">{[['PLANIFIEE,COLLECTEE', 'À faire'], ['REMISE_ATELIER,ECHOUEE,COLLECTEE', 'Historique']].map(([v, l]) => <button key={v} type="button" onClick={() => setOnglet(v)} className={`rounded-full px-4 py-2 text-sm font-medium ${onglet === v ? 'bg-nuit text-white' : 'border border-nuit/15 bg-white'}`}>{l}</button>)}</div>
      <Erreur erreur={erreur} onRetry={recharger} />
      {!data ? <Spinner /> : data.length === 0 ? <Vide titre="Aucune mission" texte="Les missions planifiées par le gérant apparaissent ici." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((co) => (
            <li key={co.id}>
              <Link to={`/livreur/collectes/${co.id}`} className="carte block p-4 hover:shadow-md">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{co.numero}</span><span className="rounded-full bg-nuit/5 px-2 py-0.5 text-xs font-semibold">{libelleMission(co)}</span></div>
                <p className="text-xs font-semibold uppercase tracking-wide text-nuit/60">{TYPES_MISSION[co.type]?.libelle}</p>
                <p className="mt-2 text-lg font-semibold">{date(co.date_prevue)} · {co.creneau}</p>
                <p className="text-sm">{co.quartier} – {co.adresse}</p>
                <p className="text-sm text-nuit/60">{co.client_nom}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
