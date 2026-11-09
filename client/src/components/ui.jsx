import { useEffect } from 'react';
import { PAIEMENTS, STATUTS, STATUTS_COLLECTE } from '../lib/format';

export function Badge({ statut, type = 'commande' }) {
  const table = type === 'collecte' ? STATUTS_COLLECTE : type === 'paiement' ? PAIEMENTS : STATUTS;
  const s = table[statut] || { libelle: statut, classe: 'bg-gray-100 text-gray-700' };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.classe}`}>{s.libelle}</span>;
}

export function Retard() {
  return <span className="inline-flex items-center rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">EN RETARD</span>;
}

export function Spinner({ texte = 'Chargement…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-nuit/60" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-or border-t-transparent" />
      {texte}
    </div>
  );
}

export function Erreur({ erreur, onRetry }) {
  if (!erreur) return null;
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      <p>{erreur.message || String(erreur)}</p>
      {erreur.details?.length > 0 && (
        <ul className="mt-1 list-disc pl-5">{erreur.details.map((d, i) => <li key={i}>{d.message}</li>)}</ul>
      )}
      {onRetry && <button type="button" className="mt-2 font-semibold underline" onClick={onRetry}>Réessayer</button>}
    </div>
  );
}

export function Vide({ titre, texte, action }) {
  return (
    <div className="carte flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="font-titre text-lg font-semibold">{titre}</p>
      {texte && <p className="max-w-md text-sm text-nuit/60">{texte}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Champ({ label, erreur, aide, children, id }) {
  return (
    <div>
      {label && <label htmlFor={id} className="etiquette">{label}</label>}
      {children}
      {aide && !erreur && <p className="mt-1 text-xs text-nuit/50">{aide}</p>}
      {erreur && <p className="mt-1 text-xs font-medium text-red-700">{erreur}</p>}
    </div>
  );
}

export function Modal({ ouvert, titre, onFermer, children, large = false }) {
  useEffect(() => {
    if (!ouvert) return undefined;
    const f = (e) => e.key === 'Escape' && onFermer();
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [ouvert, onFermer]);
  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-nuit/50 p-0 sm:items-center sm:p-4" onMouseDown={onFermer}>
      <div role="dialog" aria-modal="true" aria-label={titre} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${large ? 'sm:max-w-2xl' : 'sm:max-w-md'}`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold">{titre}</h2>
          <button type="button" onClick={onFermer} className="-m-2 p-2 text-2xl leading-none text-nuit/50 hover:text-nuit" aria-label="Fermer">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, valeur, accent, aide }) {
  return (
    <div className={`carte p-4 ${accent ? 'border-red-200 bg-red-50' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-nuit/60">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-red-700' : ''}`}>{valeur}</p>
      {aide && <p className="mt-0.5 text-xs text-nuit/50">{aide}</p>}
    </div>
  );
}

export function EnTete({ titre, sousTitre, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{titre}</h1>
        {sousTitre && <p className="mt-1 text-sm text-nuit/60">{sousTitre}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Ligne({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-nuit/60">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
