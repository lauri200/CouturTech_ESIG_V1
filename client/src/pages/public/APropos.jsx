import { Link } from 'react-router-dom';
import { useApi } from '../../lib/hooks';

export default function APropos() {
  const { data: p } = useApi('/parametres/public');
  return (
    <>
      <section className="conteneur grid items-center gap-10 py-12 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-or-600">À propos</p>
          <h1 className="titre-section mt-2">De la gestion de commandes à la gestion de confection.</h1>
          <p className="mt-4 text-nuit/80">À Lomé, commander une tenue chez le tailleur demande souvent plusieurs déplacements : choisir, déposer le tissu, revenir pour un essayage, revenir encore parce que ce n’est pas prêt. Les retards et les malentendus entre client, gérant et tailleur viennent surtout d’un suivi tenu à la main.</p>
          <p className="mt-3 text-nuit/80">CouturTech organise toute la confection : commande en ligne, collecte du tissu à domicile, attribution au tailleur avec une deadline, alerte avant l’échéance, notification quand la tenue est prête, essayage et retouches sur place.</p>
        </div>
        <img src="/images/about.webp" alt="Atelier de couture à Lomé" loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lg" />
      </section>
      <section className="bg-white py-12">
        <div className="conteneur grid gap-4 sm:grid-cols-3">
          {[
            ['Pour le client', 'Un seul déplacement : l’essayage. Tout le reste se fait en ligne.'],
            ['Pour le gérant', 'Toutes les commandes, le stock et les paiements au même endroit.'],
            ['Pour le tailleur', 'Des tâches claires, une deadline visible, plus de clients servis.'],
          ].map(([t, d]) => (
            <div key={t} className="carte p-6"><h2 className="text-xl font-semibold">{t}</h2><p className="mt-2 text-sm text-nuit/70">{d}</p></div>
          ))}
        </div>
      </section>
      <section className="conteneur py-12">
        <h2 className="titre-section">L’atelier</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="carte p-5"><dt className="text-xs uppercase text-nuit/60">Maison</dt><dd className="mt-1 font-semibold">{p?.NOM_MAISON || '…'}</dd></div>
          <div className="carte p-5"><dt className="text-xs uppercase text-nuit/60">Adresse</dt><dd className="mt-1 font-semibold">{p?.ADRESSE_ATELIER || '…'}</dd></div>
          <div className="carte p-5"><dt className="text-xs uppercase text-nuit/60">Horaires</dt><dd className="mt-1 font-semibold">{p?.HORAIRES_ATELIER || '…'}</dd></div>
          <div className="carte p-5"><dt className="text-xs uppercase text-nuit/60">Téléphone</dt><dd className="mt-1 font-semibold">{p?.TELEPHONE_MAISON || '…'}</dd></div>
          <div className="carte p-5"><dt className="text-xs uppercase text-nuit/60">E-mail</dt><dd className="mt-1 font-semibold">{p?.EMAIL_MAISON || '…'}</dd></div>
        </dl>
        <p className="mt-6 text-sm text-nuit/60">Projet réalisé dans le cadre d’une licence professionnelle à l’ESIG (École Supérieure d’Informatique et de Gestion), Lomé, 2025-2026.</p>
        <Link to="/modeles" className="btn-or mt-6">Découvrir les modèles</Link>
      </section>
    </>
  );
}
