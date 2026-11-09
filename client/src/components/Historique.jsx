import { STATUTS, date } from '../lib/format';

export default function Historique({ items = [], afficherAuteur = true }) {
  return (
    <ol className="relative space-y-4 border-l-2 border-or-100 pl-5">
      {items.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-or" />
          <p className="text-sm font-semibold">
            {h.ancien_statut === h.nouveau_statut ? 'Date modifiée' : STATUTS[h.nouveau_statut]?.libelle || h.nouveau_statut}
          </p>
          <p className="text-xs text-nuit/60">{date(h.created_at, true)}{afficherAuteur && h.auteur ? ` · ${h.auteur}` : ''}</p>
          {h.motif && <p className="mt-0.5 text-xs text-nuit/70">{h.motif}</p>}
        </li>
      ))}
    </ol>
  );
}
