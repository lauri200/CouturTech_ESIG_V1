import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { date, joursRestants } from '../../lib/format';
import { Badge, EnTete, Erreur, Retard, Spinner, Vide } from '../../components/ui';

export default function Taches() {
  const [onglet, setOnglet] = useState('ATTRIBUEE,EN_CONFECTION');
  const { data, erreur, recharger } = useApi(`/commandes?statut=${onglet}`);
  return (
    <>
      <EnTete titre="Mes tâches" sousTitre="Triées par deadline" />
      <div className="mb-4 flex gap-2">{[['ATTRIBUEE,EN_CONFECTION', 'À faire'], ['PRETE,EN_ESSAYAGE,RETIREE', 'Terminées']].map(([v, l]) => <button key={v} type="button" onClick={() => setOnglet(v)} className={`rounded-full px-4 py-2 text-sm font-medium ${onglet === v ? 'bg-nuit text-white' : 'border border-nuit/15 bg-white'}`}>{l}</button>)}</div>
      <Erreur erreur={erreur} onRetry={recharger} />
      {!data ? <Spinner /> : data.length === 0 ? <Vide titre="Aucune tâche" texte="Les nouvelles tâches apparaissent ici dès que le gérant vous les attribue." /> : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => {
            const j = joursRestants(c.deadline);
            return (
              <li key={c.id}>
                <Link to={`/tailleur/taches/${c.id}`} className={`carte flex gap-3 p-3 hover:shadow-md ${c.en_retard ? 'border-red-300 bg-red-50/40' : ''}`}>
                  <img src={c.modele_photo} alt="" className="h-24 w-[72px] rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-nuit/50">{c.numero}</span><Badge statut={c.statut} /></div>
                    <p className="mt-1 font-semibold">{c.modele_nom}</p>
                    <p className="text-sm">Taille <strong>{c.taille}</strong> · {c.source_tissu === 'MAISON' ? c.tissu_nom : 'Tissu client'}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm">Deadline : <strong>{date(c.deadline)}</strong>{c.en_retard ? <Retard /> : j !== null && onglet.startsWith('ATT') && <span className={`text-xs ${j <= 1 ? 'font-bold text-terre' : 'text-nuit/60'}`}>{j === 0 ? 'aujourd’hui' : `J-${j}`}</span>}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
