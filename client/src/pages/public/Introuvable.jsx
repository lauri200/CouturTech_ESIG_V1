import { Link } from 'react-router-dom';

export default function Introuvable() {
  return (
    <div className="conteneur flex flex-col items-center py-24 text-center">
      <p className="font-titre text-6xl font-bold text-or">404</p>
      <h1 className="mt-4 text-2xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-nuit/70">Cette page n’existe pas ou a été déplacée.</p>
      <Link to="/" className="btn-primaire mt-6">Retour à l’accueil</Link>
    </div>
  );
}
