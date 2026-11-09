import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { date, fcfa } from '../../lib/format';
import { Badge, EnTete, Erreur, Spinner, Stat } from '../../components/ui';

export default function Paiements() {
  const [sp, setSp] = useSearchParams();
  const p = sp.get('paiement') || 'NON_PAYE,ACOMPTE';
  const { data, erreur, recharger } = useApi('/commandes');
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  if (!data) return <Spinner />;
  const actives = data.filter((c) => c.statut !== 'ANNULEE');
  const liste = actives.filter((c) => p.split(',').includes(c.statut_paiement));
  const somme = (arr, k) => arr.reduce((s, c) => s + Number(c[k]), 0);
  return (
    <>
      <EnTete titre="Paiements" sousTitre="Suivi des acomptes et soldes (saisie manuelle)" />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total commandé" valeur={fcfa(somme(actives, 'total'))} />
        <Stat label="Encaissé" valeur={fcfa(somme(actives, 'montant_paye'))} />
        <Stat label="Reste à encaisser" valeur={fcfa(somme(actives, 'reste_a_payer'))} />
        <Stat label="Prêtes non soldées" valeur={actives.filter((c) => ['PRETE', 'EN_ESSAYAGE'].includes(c.statut) && c.statut_paiement !== 'SOLDE').length} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[['NON_PAYE,ACOMPTE', 'À encaisser'], ['NON_PAYE', 'Non payé'], ['ACOMPTE', 'Acompte'], ['SOLDE', 'Soldé']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setSp({ paiement: v })} className={`rounded-full px-4 py-2 text-sm font-medium ${p === v ? 'bg-nuit text-white' : 'border border-nuit/15 bg-white'}`}>{l}</button>
        ))}
      </div>
      <div className="carte overflow-x-auto">
        <table className="tableau">
          <thead><tr><th>N°</th><th>Client</th><th>Statut</th><th>Remise</th><th>Total</th><th>Payé</th><th>Reste</th><th>Paiement</th></tr></thead>
          <tbody>{liste.map((c) => (
            <tr key={c.id}>
              <td><Link to={`/gerant/commandes/${c.id}`} className="font-semibold text-or-600">{c.numero}</Link></td>
              <td>{c.client_prenom} {c.client_nom}</td><td><Badge statut={c.statut} /></td><td>{date(c.date_remise_prevue)}</td>
              <td className="whitespace-nowrap">{fcfa(c.total)}</td><td className="whitespace-nowrap">{fcfa(c.montant_paye)}</td><td className="whitespace-nowrap font-semibold">{fcfa(c.reste_a_payer)}</td>
              <td><Badge statut={c.statut_paiement} type="paiement" /></td>
            </tr>
          ))}</tbody>
        </table>
        {liste.length === 0 && <p className="p-6 text-center text-sm text-nuit/60">Aucune commande.</p>}
      </div>
    </>
  );
}
