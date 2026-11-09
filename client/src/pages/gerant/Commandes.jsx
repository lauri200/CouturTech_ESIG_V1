import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { date, fcfa, STATUTS } from '../../lib/format';
import { Badge, EnTete, Erreur, Retard, Spinner, Vide } from '../../components/ui';

export default function Commandes() {
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') || '');
  const qs = new URLSearchParams([...sp.entries()].filter(([, v]) => v)).toString();
  const { data, erreur, chargement, recharger } = useApi(`/commandes${qs ? `?${qs}` : ''}`);
  const tailleurs = useApi('/utilisateurs?role=TAILLEUR');
  const maj = (k, v) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n); };
  return (
    <>
      <EnTete titre="Commandes" sousTitre={data ? `${data.length} commande(s)` : ''} />
      <form className="carte mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); maj('q', q); }}>
        <input className="champ lg:col-span-2" placeholder="N°, client ou modèle…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Recherche" />
        <select className="champ" value={sp.get('statut') || ''} onChange={(e) => maj('statut', e.target.value)} aria-label="Statut">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.libelle}</option>)}
        </select>
        <select className="champ" value={sp.get('tailleur_id') || ''} onChange={(e) => maj('tailleur_id', e.target.value)} aria-label="Tailleur">
          <option value="">Tous les tailleurs</option>
          {tailleurs.data?.map((t) => <option key={t.id} value={t.id}>{t.prenom} {t.nom}</option>)}
        </select>
        <select className="champ" value={sp.get('paiement') || ''} onChange={(e) => maj('paiement', e.target.value)} aria-label="Paiement">
          <option value="">Tous paiements</option><option value="NON_PAYE">Non payé</option><option value="ACOMPTE">Acompte</option><option value="SOLDE">Soldé</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-or" checked={sp.get('retard') === '1'} onChange={(e) => maj('retard', e.target.checked ? '1' : '')} /> En retard</label>
      </form>
      <Erreur erreur={erreur} onRetry={recharger} />
      {chargement && !data ? <Spinner /> : data?.length === 0 ? <Vide titre="Aucune commande" texte="Modifiez les filtres." /> : (
        <div className="carte overflow-x-auto">
          <table className="tableau">
            <thead><tr><th>N°</th><th>Client</th><th>Modèle</th><th>Tissu</th><th>Statut</th><th>Tailleur</th><th>Deadline</th><th>Total</th><th>Paiement</th></tr></thead>
            <tbody>
              {data?.map((c) => (
                <tr key={c.id} className="hover:bg-or-50/40">
                  <td><Link to={`/gerant/commandes/${c.id}`} className="font-semibold text-or-600 hover:underline">{c.numero}</Link><p className="text-xs text-nuit/50">{date(c.created_at)}</p></td>
                  <td>{c.client_prenom} {c.client_nom}</td>
                  <td>{c.modele_nom}<p className="text-xs text-nuit/50">Taille {c.taille}</p></td>
                  <td>{c.source_tissu === 'MAISON' ? c.tissu_nom : <span className="text-nuit/60">Client</span>}</td>
                  <td><Badge statut={c.statut} /></td>
                  <td>{c.tailleur_nom || '—'}</td>
                  <td className="whitespace-nowrap">{date(c.deadline)} {c.en_retard && <Retard />}</td>
                  <td className="whitespace-nowrap">{fcfa(c.total)}</td>
                  <td><Badge statut={c.statut_paiement} type="paiement" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
