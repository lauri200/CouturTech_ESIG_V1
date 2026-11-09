import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { fcfa, TAILLES, MENSURATIONS } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { Erreur, Spinner } from '../../components/ui';

export default function FicheModele() {
  const { id } = useParams();
  const { data: m, erreur, chargement } = useApi(`/modeles/${id}`);
  const [photo, setPhoto] = useState(0);
  const [taille, setTaille] = useState('');
  const [guide, setGuide] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  if (chargement) return <Spinner />;
  if (erreur) return <div className="conteneur py-10"><Erreur erreur={erreur} /><Link to="/modeles" className="btn-lien mt-4 inline-block">← Retour aux modèles</Link></div>;
  const tailles = TAILLES.filter((t) => m.metrages[t]);
  const commander = () => {
    const cible = `/client/commander?modele=${m.id}${taille ? `&taille=${taille}` : ''}`;
    if (!user) navigate('/connexion', { state: { depuis: cible, message: 'Connectez-vous pour commander.' } });
    else navigate(cible);
  };
  return (
    <div className="conteneur py-8">
      <Link to="/modeles" className="btn-lien">← Tous les modèles</Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-nuit-50">
            <img src={m.photos[photo]} alt={m.nom} className="h-full w-full object-cover" />
          </div>
          {m.photos.length > 1 && (
            <div className="mt-3 flex gap-2">
              {m.photos.map((p, i) => (
                <button key={p} type="button" onClick={() => setPhoto(i)} className={`h-20 w-16 overflow-hidden rounded-lg border-2 ${i === photo ? 'border-or' : 'border-transparent'}`} aria-label={`Photo ${i + 1}`}>
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-or-600">{m.categorie} · Réf. {m.reference}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{m.nom}</h1>
          <p className="mt-4 text-nuit/80">{m.description}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4">
            <div className="carte p-4"><dt className="text-xs uppercase text-nuit/60">Confection</dt><dd className="mt-1 text-xl font-bold">{fcfa(m.prix_confection)}</dd></div>
            <div className="carte p-4"><dt className="text-xs uppercase text-nuit/60">Délai</dt><dd className="mt-1 text-xl font-bold">{m.delai_jours} jours</dd></div>
          </dl>
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <p className="etiquette mb-0">Votre taille</p>
              <button type="button" className="btn-lien" onClick={() => setGuide((g) => !g)}>{guide ? 'Masquer' : 'Guide des tailles'}</button>
            </div>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {tailles.map((t) => (
                <button key={t} type="button" onClick={() => setTaille(t)} aria-pressed={taille === t}
                  className={`min-h-[44px] rounded-lg border text-sm font-semibold ${taille === t ? 'border-nuit bg-nuit text-white' : 'border-nuit/20 bg-white hover:border-nuit'}`}>{t}</button>
              ))}
            </div>
            {guide && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-nuit/10 bg-white">
                <table className="tableau">
                  <thead><tr><th>Taille</th>{tailles.map((t) => <th key={t}>{t}</th>)}</tr></thead>
                  <tbody>
                    <tr><td>Métrage de tissu</td>{tailles.map((t) => <td key={t}>{m.metrages[t]} m</td>)}</tr>
                    {['Tour de poitrine', 'Tour de taille', 'Tour de hanches'].map((l, i) => <tr key={l}><td>{l} (cm)</td>{tailles.map((t) => <td key={t} className="whitespace-nowrap">{MENSURATIONS[t]?.[i]}</td>)}</tr>)}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-nuit/60">Mensurations indicatives. Les ajustements fins sont faits lors de l’essayage, sur place.</p>
              </div>
            )}
          </div>
          <button type="button" onClick={commander} className="btn-or mt-6 w-full text-base">Commander ce modèle</button>
          <p className="mt-2 text-center text-xs text-nuit/60">Tissu de la maison ou le vôtre : vous choisissez à l’étape suivante.</p>
        </div>
      </div>
    </div>
  );
}
