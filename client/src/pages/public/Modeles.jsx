import { useSearchParams } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { Erreur, Spinner, Vide } from '../../components/ui';
import { CarteModele } from './Accueil';

export default function Modeles() {
  const [sp, setSp] = useSearchParams();
  const categorie = sp.get('categorie') || '';
  const page = Number(sp.get('page') || 1);
  const qs = new URLSearchParams({ limit: '12', page: String(page), ...(categorie ? { categorie } : {}) });
  const { data, erreur, chargement, recharger } = useApi(`/modeles?${qs}`);
  const choisir = (c) => setSp(c ? { categorie: c } : {});
  return (
    <div className="conteneur py-10">
      <h1 className="titre-section">Nos modèles</h1>
      <p className="mt-1 text-nuit/70">Choisissez un modèle, puis votre taille et votre tissu.</p>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Catégories">
        {['', ...(data?.categories || [])].map((c) => (
          <button key={c || 'tous'} type="button" role="tab" aria-selected={categorie === c} onClick={() => choisir(c)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${categorie === c ? 'bg-nuit text-white' : 'border border-nuit/15 bg-white hover:border-nuit/40'}`}>
            {c || 'Tous'}
          </button>
        ))}
      </div>
      <div className="mt-6">
        <Erreur erreur={erreur} onRetry={recharger} />
        {chargement && !data ? <Spinner /> : data?.items.length === 0 ? (
          <Vide titre="Aucun modèle pour le moment" texte="Revenez bientôt : de nouveaux modèles sont ajoutés régulièrement." />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {data?.items.map((m) => <CarteModele key={m.id} m={m} />)}
          </div>
        )}
        {data?.pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button type="button" className="btn-contour" disabled={page <= 1} onClick={() => setSp({ ...(categorie ? { categorie } : {}), page: String(page - 1) })}>Précédent</button>
            <span className="text-sm">Page {page} / {data.pages}</span>
            <button type="button" className="btn-contour" disabled={page >= data.pages} onClick={() => setSp({ ...(categorie ? { categorie } : {}), page: String(page + 1) })}>Suivant</button>
          </div>
        )}
      </div>
    </div>
  );
}
