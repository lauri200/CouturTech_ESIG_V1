import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { date, fcfa, STATUTS } from '../../lib/format';
import { Badge, EnTete, Erreur, Retard, Spinner, Stat } from '../../components/ui';

export default function TableauDeBord() {
  const { data: k, erreur, recharger } = useApi('/dashboard');
  const urgents = useApi('/commandes?statut=ATTRIBUEE,EN_CONFECTION');
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  if (!k) return <Spinner />;
  const ponct = k.ponctualite.total ? Math.round((k.ponctualite.a_l_heure / k.ponctualite.total) * 100) : null;
  const liste = (urgents.data || []).filter((c) => c.en_retard || (c.deadline && c.deadline <= new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10)));
  return (
    <>
      <EnTete titre="Tableau de bord" sousTitre="Vue d’ensemble de la confection" actions={<Link to="/gerant/commandes" className="btn-primaire">Toutes les commandes</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="En cours" valeur={k.en_cours} />
        <Stat label="En retard" valeur={k.en_retard} accent={k.en_retard > 0} />
        <Stat label="À attribuer" valeur={k.a_attribuer} />
        <Stat label="Collectes en attente" valeur={k.collectes_attente} />
        <Stat label="Prêtes / en essayage" valeur={k.pretes} />
        <Stat label="Encaissé ce mois" valeur={fcfa(k.encaisse_mois)} />
        <Stat label="Reste à encaisser" valeur={fcfa(k.reste_a_encaisser)} />
        <Stat label="Ponctualité" valeur={ponct === null ? '—' : `${ponct} %`} aide="Commandes prêtes à la deadline" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="carte p-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Deadlines proches et retards</h2>
          {liste.length === 0 ? <p className="mt-3 text-sm text-nuit/60">Aucune urgence.</p> : (
            <ul className="mt-3 divide-y divide-nuit/5">
              {liste.map((c) => (
                <li key={c.id}><Link to={`/gerant/commandes/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-or-600">
                  <span><strong>{c.numero}</strong> · {c.modele_nom} · {c.tailleur_nom}</span>
                  <span className="flex items-center gap-2">{c.en_retard && <Retard />}<span>{date(c.deadline)}</span></span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="carte p-4">
          <h2 className="text-lg font-semibold">Stock bas</h2>
          {k.stock_bas.length === 0 ? <p className="mt-3 text-sm text-nuit/60">Aucun tissu sous le seuil.</p> : (
            <ul className="mt-3 space-y-2 text-sm">
              {k.stock_bas.map((t) => <li key={t.id} className="flex justify-between"><span>{t.nom}</span><span className="font-semibold text-red-700">{t.stock_metres} m / {t.seuil_alerte} m</span></li>)}
            </ul>
          )}
          <Link to="/gerant/tissus" className="btn-lien mt-3 inline-block">Gérer le stock →</Link>
        </section>
        <section className="carte p-4">
          <h2 className="text-lg font-semibold">Charge des tailleurs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {k.charge_tailleurs.map((t) => <li key={t.id} className="flex justify-between"><span>{t.nom}</span><span>{t.n} tâche(s){t.retards ? <span className="ml-1 text-red-700">· {t.retards} en retard</span> : ''}</span></li>)}
          </ul>
        </section>
        <section className="carte p-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Commandes par statut</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.keys(STATUTS).map((s) => {
              const n = k.par_statut.find((x) => x.statut === s)?.n || 0;
              return <Link key={s} to={`/gerant/commandes?statut=${s}`} className="flex items-center gap-2 rounded-lg border border-nuit/10 px-3 py-2 text-sm hover:border-nuit/30"><Badge statut={s} /><strong>{n}</strong></Link>;
            })}
          </div>
        </section>
      </div>
    </>
  );
}
