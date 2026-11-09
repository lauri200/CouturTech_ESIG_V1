import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { date, joursRestants, STATUTS } from '../../lib/format';
import { EnTete, Erreur, Retard, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

const COLONNES = ['EN_ATTENTE_COLLECTE', 'CONFIRMEE', 'TISSU_RECU', 'ATTRIBUEE', 'EN_CONFECTION', 'PRETE', 'EN_ESSAYAGE'];
const SUIVANT = { ATTRIBUEE: 'EN_CONFECTION', EN_CONFECTION: 'PRETE', PRETE: 'EN_ESSAYAGE' };

export default function Production() {
  const { data, erreur, recharger } = useApi(`/commandes?statut=${COLONNES.join(',')}`);
  const toast = useToast();
  const avancer = async (c) => {
    try {
      await api(`/commandes/${c.id}/statut`, { method: 'PATCH', body: { statut: SUIVANT[c.statut] } });
      toast(`${c.numero} → ${STATUTS[SUIVANT[c.statut]].libelle}`);
      recharger();
    } catch (e) { toast(e.message, 'erreur'); }
  };
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  if (!data) return <Spinner />;
  return (
    <>
      <EnTete titre="Production" sousTitre="Tableau Kanban de la confection" />
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {COLONNES.map((col) => {
          const items = data.filter((c) => c.statut === col);
          return (
            <section key={col} className="w-72 shrink-0 snap-start rounded-xl bg-nuit-50 p-3" aria-label={STATUTS[col].libelle}>
              <h2 className="mb-3 flex items-center justify-between font-sans text-sm font-bold uppercase tracking-wide">{STATUTS[col].libelle}<span className="rounded-full bg-white px-2 text-xs">{items.length}</span></h2>
              <ul className="space-y-2">
                {items.map((c) => {
                  const j = joursRestants(c.deadline);
                  return (
                    <li key={c.id} className={`carte p-3 ${c.en_retard ? 'border-red-300' : ''}`}>
                      <Link to={`/gerant/commandes/${c.id}`} className="flex gap-3">
                        <img src={c.modele_photo} alt="" className="h-16 w-12 rounded object-cover" />
                        <div className="min-w-0 text-sm">
                          <p className="font-semibold">{c.numero}</p>
                          <p className="truncate">{c.modele_nom} · {c.taille}</p>
                          <p className="truncate text-xs text-nuit/60">{c.client_prenom} {c.client_nom}</p>
                        </div>
                      </Link>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs">
                        <span className="text-nuit/60">{c.tailleur_nom || 'Non attribuée'}</span>
                        {c.deadline && (c.en_retard ? <Retard /> : <span className={j <= 1 ? 'font-bold text-terre' : ''}>{date(c.deadline)}</span>)}
                      </div>
                      {SUIVANT[c.statut] && <button type="button" onClick={() => avancer(c)} className="btn-contour mt-2 min-h-[36px] w-full py-1 text-xs">→ {STATUTS[SUIVANT[c.statut]].libelle}</button>}
                      {['CONFIRMEE', 'TISSU_RECU'].includes(c.statut) && <Link to={`/gerant/commandes/${c.id}`} className="btn-or mt-2 min-h-[36px] w-full py-1 text-xs">Attribuer</Link>}
                    </li>
                  );
                })}
                {items.length === 0 && <li className="py-4 text-center text-xs text-nuit/50">Vide</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
