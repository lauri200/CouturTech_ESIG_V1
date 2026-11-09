import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { date } from '../../lib/format';
import { Badge, EnTete, Erreur, Spinner, Vide } from '../../components/ui';

export default function MesCollectes() {
  const [onglet, setOnglet] = useState('PLANIFIEE,COLLECTEE');
  const { data, erreur, recharger } = useApi(`/collectes?statut=${onglet}`);
  return (
    <>
      <EnTete titre="Mes collectes" sousTitre="Tissus à récupérer chez les clients" />
      <div className="mb-4 flex gap-2">{[['PLANIFIEE,COLLECTEE', 'À faire'], ['REMISE_ATELIER,ECHOUEE', 'Historique']].map(([v, l]) => <button key={v} type="button" onClick={() => setOnglet(v)} className={`rounded-full px-4 py-2 text-sm font-medium ${onglet === v ? 'bg-nuit text-white' : 'border border-nuit/15 bg-white'}`}>{l}</button>)}</div>
      <Erreur erreur={erreur} onRetry={recharger} />
      {!data ? <Spinner /> : data.length === 0 ? <Vide titre="Aucune collecte" texte="Les collectes planifiées par le gérant apparaissent ici." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((co) => (
            <li key={co.id}>
              <Link to={`/livreur/collectes/${co.id}`} className="carte block p-4 hover:shadow-md">
                <div className="flex items-center justify-between gap-2"><span className="font-semibold">{co.numero}</span><Badge statut={co.statut} type="collecte" /></div>
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
