import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { date, fcfa } from '../../lib/format';
import { Badge, Erreur, Spinner, Vide } from '../../components/ui';

export default function MesCommandes() {
  const { data, erreur, chargement, recharger } = useApi('/commandes');
  return (
    <div className="conteneur py-8">
      <div className="flex items-end justify-between gap-4">
        <h1 className="titre-section">Mes commandes</h1>
        <Link to="/modeles" className="btn-or">Nouvelle commande</Link>
      </div>
      <div className="mt-6">
        <Erreur erreur={erreur} onRetry={recharger} />
        {chargement && !data ? <Spinner /> : data?.length === 0 ? (
          <Vide titre="Aucune commande" texte="Choisissez un modèle pour lancer votre première confection." action={<Link to="/modeles" className="btn-or">Voir les modèles</Link>} />
        ) : (
          <ul className="space-y-3">
            {data?.map((c) => (
              <li key={c.id}>
                <Link to={`/client/commandes/${c.id}`} className="carte flex gap-4 p-3 transition hover:shadow-md sm:p-4">
                  <img src={c.modele_photo} alt="" className="h-24 w-[72px] shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-nuit/50">{c.numero}</span><Badge statut={c.statut} /></div>
                    <p className="mt-1 truncate font-semibold">{c.modele_nom} · {c.taille}</p>
                    <p className="text-sm text-nuit/60">{c.source_tissu === 'MAISON' ? c.tissu_nom : 'Votre tissu'}</p>
                    <p className="mt-1 text-sm">{c.statut === 'RETIREE' || c.statut === 'ANNULEE' ? `Commandée le ${date(c.created_at)}` : `Remise prévue : ${date(c.date_remise_prevue)}`}</p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="font-bold">{fcfa(c.total)}</p>
                    <Badge statut={c.statut_paiement} type="paiement" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
