import { useState } from 'react';
import { useApi } from '../../lib/hooks';
import { fcfa } from '../../lib/format';
import { Erreur, Spinner, Vide } from '../../components/ui';

export function CarteTissu({ t, selectionne, onChoisir, besoin }) {
  const suffisant = besoin ? t.stock_metres >= besoin : t.disponible;
  const contenu = (
    <>
      <div className="relative aspect-square overflow-hidden bg-nuit-50">
        {t.photo_url && <img src={t.photo_url} alt={t.nom} loading="lazy" className="h-full w-full object-cover" />}
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold ${suffisant ? 'bg-emerald-600 text-white' : 'bg-nuit/80 text-white'}`}>{suffisant ? 'Disponible' : 'Épuisé'}</span>
      </div>
      <div className="p-3 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-or-600">{t.type}</p>
        <p className="font-semibold leading-tight">{t.nom}</p>
        <p className="text-sm text-nuit/70">{fcfa(t.prix_metre)} / m</p>
        {besoin && <p className="text-xs text-nuit/50">{besoin} m nécessaires · {fcfa(Math.round(besoin * t.prix_metre))}</p>}
      </div>
    </>
  );
  if (!onChoisir) return <div className="carte overflow-hidden">{contenu}</div>;
  return (
    <button type="button" disabled={!suffisant} onClick={() => onChoisir(t)} aria-pressed={selectionne}
      className={`carte overflow-hidden transition disabled:cursor-not-allowed disabled:opacity-50 ${selectionne ? 'ring-2 ring-or ring-offset-2' : 'hover:shadow-md'}`}>
      {contenu}
    </button>
  );
}

export default function Tissus() {
  const [type, setType] = useState('');
  const { data, erreur, chargement, recharger } = useApi(`/tissus${type ? `?type=${encodeURIComponent(type)}` : ''}`);
  const [types, setTypes] = useState([]);
  if (data?.types && types.length === 0 && data.types.length) setTypes(data.types);
  return (
    <div className="conteneur py-10">
      <h1 className="titre-section">Tissus de la maison</h1>
      <p className="mt-1 text-nuit/70">Wax, bazin, dentelle, soie… Vous pouvez aussi apporter votre propre tissu : nous venons le chercher.</p>
      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {['', ...types].map((c) => (
          <button key={c || 'tous'} type="button" onClick={() => setType(c)} aria-pressed={type === c}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${type === c ? 'bg-nuit text-white' : 'border border-nuit/15 bg-white hover:border-nuit/40'}`}>{c || 'Tous'}</button>
        ))}
      </div>
      <div className="mt-6">
        <Erreur erreur={erreur} onRetry={recharger} />
        {chargement && !data ? <Spinner /> : data?.items.length === 0 ? <Vide titre="Aucun tissu" /> : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data?.items.map((t) => <CarteTissu key={t.id} t={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}
