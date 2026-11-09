import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';
import { fcfa } from '../../lib/format';

const ETAPES = [
  ['1', 'Choisissez votre modèle', 'Parcourez le catalogue et ouvrez la fiche qui vous plaît.'],
  ['2', 'Sélectionnez votre taille', 'S, M, L, XL, 2XL ou 3XL : pas de prise de mesures préalable.'],
  ['3', 'Choisissez votre tissu', 'Un tissu de la maison, ou le vôtre : un livreur vient le chercher chez vous.'],
  ['4', 'Suivez la confection', 'Une deadline est fixée au tailleur. Vous êtes prévenu(e) par e-mail et SMS.'],
  ['5', 'Essayez et repartez', 'Venez essayer à l’atelier : les retouches sont faites sur place.'],
];

export function CarteModele({ m }) {
  return (
    <Link to={`/modeles/${m.id}`} className="group carte overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="aspect-[3/4] overflow-hidden bg-nuit-50">
        <img src={m.photos[0]} alt={m.nom} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      </div>
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-or-600">{m.categorie}</p>
        <h3 className="mt-1 font-titre text-lg font-semibold leading-tight">{m.nom}</h3>
        <p className="mt-2 text-sm text-nuit/70">Confection à partir de <span className="font-semibold text-nuit">{fcfa(m.prix_confection)}</span></p>
        <p className="text-xs text-nuit/50">Prête en {m.delai_jours} jours</p>
      </div>
    </Link>
  );
}

export default function Accueil() {
  const { data } = useApi('/modeles?mis_en_avant=1&limit=4');
  return (
    <>
      <section className="relative overflow-hidden bg-nuit text-white">
        <img src="/images/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-r from-nuit via-nuit/80 to-transparent" />
        <div className="conteneur relative py-20 sm:py-28 lg:py-36">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-or-400">Haute couture · Lomé</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">Votre tenue sur mesure, sans allers-retours.</h1>
          <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">Choisissez un modèle, votre taille et votre tissu. Nous récupérons votre tissu, l’atelier respecte une date fixée, et vous ne vous déplacez qu’une fois : pour l’essayage.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/modeles" className="btn-or px-6 text-base">Voir les modèles</Link>
            <Link to="/inscription" className="btn border border-white/40 px-6 text-base text-white hover:bg-white/10">Créer mon compte</Link>
          </div>
        </div>
      </section>

      <section className="conteneur py-16">
        <h2 className="titre-section text-center">Comment ça marche</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-nuit/70">Cinq étapes, un seul déplacement.</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {ETAPES.map(([n, t, d]) => (
            <li key={n} className="carte p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-or text-lg font-bold text-white">{n}</span>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-nuit/70">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-white py-16">
        <div className="conteneur">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="titre-section">Modèles à la une</h2>
              <p className="mt-1 text-nuit/70">Confectionnés par les artisans de la maison.</p>
            </div>
            <Link to="/modeles" className="btn-lien shrink-0">Tout le catalogue →</Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data?.items.map((m) => <CarteModele key={m.id} m={m} />)}
          </div>
        </div>
      </section>

      <section className="conteneur grid items-center gap-10 py-16 md:grid-cols-2">
        <img src="/images/collecte.webp" alt="Un livreur récupère le tissu d’une cliente à domicile" loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lg" />
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-or-600">Vous avez votre tissu ?</p>
          <h2 className="titre-section mt-2">On vient le chercher chez vous.</h2>
          <p className="mt-4 text-nuit/70">Indiquez votre adresse, un repère et un créneau. Un livreur récupère le tissu et le remet directement à l’atelier. Vous suivez chaque étape depuis votre espace.</p>
          <Link to="/modeles" className="btn-primaire mt-6">Commander avec mon tissu</Link>
        </div>
      </section>

      <section className="conteneur grid items-center gap-10 pb-4 md:grid-cols-2">
        <div className="md:order-2">
          <img src="/images/essayage.webp" alt="Essayage et retouches à l’atelier" loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lg" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-or-600">Une date tenue</p>
          <h2 className="titre-section mt-2">Prévenu(e) dès que c’est prêt.</h2>
          <p className="mt-4 text-nuit/70">Chaque commande a une deadline fixée au tailleur. Le jour où votre tenue est prête, vous recevez un e-mail et un SMS. Vous venez l’essayer, les retouches sont faites immédiatement, et vous repartez avec.</p>
          <Link to="/inscription" className="btn-or mt-6">Créer mon compte</Link>
        </div>
      </section>
    </>
  );
}
