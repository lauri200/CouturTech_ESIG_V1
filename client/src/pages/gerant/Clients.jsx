import { useApi } from '../../lib/hooks';
import { date } from '../../lib/format';
import { EnTete, Erreur, Spinner } from '../../components/ui';

export default function Clients() {
  const { data, erreur, recharger } = useApi('/clients');
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  if (!data) return <Spinner />;
  return (
    <>
      <EnTete titre="Clients" sousTitre={`${data.length} client(s) inscrit(s)`} />
      <div className="carte overflow-x-auto">
        <table className="tableau">
          <thead><tr><th>Client</th><th>Téléphone</th><th>E-mail</th><th>Quartier</th><th>Commandes</th><th>Inscription</th></tr></thead>
          <tbody>{data.map((c) => <tr key={c.id}><td className="font-medium">{c.prenom} {c.nom}</td><td><a href={`tel:${c.telephone}`} className="text-or-600">{c.telephone}</a></td><td>{c.email}</td><td>{c.quartier || '—'}</td><td>{c.nb_commandes}</td><td>{date(c.created_at)}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
