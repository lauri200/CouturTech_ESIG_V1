import { useState } from 'react';
import { useApi } from '../../lib/hooks';
import { date } from '../../lib/format';
import { EnTete, Erreur, Spinner } from '../../components/ui';

export default function Journal() {
  const [statut, setStatut] = useState('');
  const { data, erreur, recharger } = useApi(`/notifications/journal${statut ? `?statut=${statut}` : ''}`);
  return (
    <>
      <EnTete titre="Journal des envois" sousTitre="E-mails et SMS envoyés (les échecs sont relancés automatiquement)" />
      <div className="mb-4 flex gap-2">{[['', 'Tous'], ['ENVOYEE', 'Envoyés'], ['ECHEC', 'Échecs']].map(([v, l]) => <button key={l} type="button" onClick={() => setStatut(v)} className={`rounded-full px-4 py-2 text-sm font-medium ${statut === v ? 'bg-nuit text-white' : 'border border-nuit/15 bg-white'}`}>{l}</button>)}</div>
      <Erreur erreur={erreur} onRetry={recharger} />
      {!data ? <Spinner /> : (
        <div className="carte overflow-x-auto">
          <table className="tableau">
            <thead><tr><th>Date</th><th>Code</th><th>Canal</th><th>Destinataire</th><th>Commande</th><th>Message</th><th>Statut</th></tr></thead>
            <tbody>{data.map((n) => (
              <tr key={n.id}><td className="whitespace-nowrap">{date(n.created_at, true)}</td><td>{n.code}</td><td>{n.canal}</td><td>{n.destinataire}</td><td>{n.numero || '—'}</td>
                <td className="min-w-[260px] text-xs">{n.contenu}</td>
                <td className={n.statut === 'ECHEC' ? 'text-red-700' : 'text-emerald-700'}>{n.statut}{n.tentatives > 1 ? ` (${n.tentatives})` : ''}{n.erreur && <p className="text-xs">{n.erreur}</p>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
