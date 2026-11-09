import { useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ESPACES, ROLES } from '../lib/format';
import Cloche from './Cloche';
import { Spinner } from './ui';

export function Logo({ clair = false }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="CouturTech – accueil">
      <img src="/logo.svg" alt="" className="h-9 w-9" />
      <span className={`font-titre text-xl font-bold ${clair ? 'text-white' : 'text-nuit'}`}>Coutur<span className="text-or">Tech</span></span>
    </Link>
  );
}

const LIENS_PUBLICS = [
  ['/', 'Accueil'],
  ['/modeles', 'Modèles'],
  ['/tissus', 'Tissus'],
  ['/a-propos', 'À propos'],
];

function Header() {
  const { user, deconnexion } = useAuth();
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const lien = ({ isActive }) => `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'text-or-600' : 'text-nuit/80 hover:text-nuit'}`;
  const sortir = () => { deconnexion(); setMenu(false); navigate('/'); };
  return (
    <header className="sticky top-0 z-30 border-b border-nuit/10 bg-creme/95 backdrop-blur">
      <div className="conteneur flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {LIENS_PUBLICS.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'} className={lien}>{l}</NavLink>)}
          {user?.role === 'CLIENT' && <NavLink to="/client/commandes" className={lien}>Mes commandes</NavLink>}
        </nav>
        <div className="flex items-center gap-2">
          {user?.role === 'CLIENT' && <Cloche lienCommande={(id) => `/client/commandes/${id}`} />}
          {!user && <Link to="/connexion" className="btn-contour hidden sm:inline-flex">Se connecter</Link>}
          {!user && <Link to="/modeles" className="btn-or hidden sm:inline-flex">Commander</Link>}
          {user && user.role !== 'CLIENT' && <Link to={ESPACES[user.role]} className="btn-primaire hidden sm:inline-flex">Mon espace {ROLES[user.role].toLowerCase()}</Link>}
          {user?.role === 'CLIENT' && (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/client/profil" className="text-sm font-medium hover:text-or-600">{user.prenom}</Link>
              <button type="button" onClick={sortir} className="btn-lien">Déconnexion</button>
            </div>
          )}
          <button type="button" onClick={() => setMenu((m) => !m)} className="flex h-11 w-11 items-center justify-center rounded-lg md:hidden" aria-label="Menu" aria-expanded={menu}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">{menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
        </div>
      </div>
      {menu && (
        <nav className="border-t border-nuit/10 bg-creme md:hidden" aria-label="Navigation mobile">
          <div className="conteneur flex flex-col py-2" onClick={() => setMenu(false)}>
            {LIENS_PUBLICS.map(([to, l]) => <NavLink key={to} to={to} end={to === '/'} className={lien}>{l}</NavLink>)}
            {user?.role === 'CLIENT' && <NavLink to="/client/commandes" className={lien}>Mes commandes</NavLink>}
            {user?.role === 'CLIENT' && <NavLink to="/client/profil" className={lien}>Mon profil</NavLink>}
            {user && user.role !== 'CLIENT' && <NavLink to={ESPACES[user.role]} className={lien}>Mon espace</NavLink>}
            {!user && <NavLink to="/connexion" className={lien}>Se connecter</NavLink>}
            {!user && <NavLink to="/inscription" className={lien}>Créer un compte</NavLink>}
            {user && <button type="button" onClick={sortir} className="px-3 py-2 text-left text-sm font-medium text-terre">Déconnexion</button>}
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 bg-nuit text-white/80">
      <div className="conteneur grid gap-8 py-10 sm:grid-cols-3">
        <div>
          <Logo clair />
          <p className="mt-3 max-w-xs text-sm">La haute couture sur mesure, sans allers-retours.</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-white">Navigation</p>
          <ul className="space-y-1 text-sm">
            <li><Link to="/modeles" className="hover:text-or-400">Modèles</Link></li>
            <li><Link to="/tissus" className="hover:text-or-400">Tissus</Link></li>
            <li><Link to="/a-propos" className="hover:text-or-400">À propos</Link></li>
            <li><Link to="/confidentialite" className="hover:text-or-400">Confidentialité</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold text-white">Lomé, Togo</p>
          <p>Projet de licence professionnelle – ESIG, 2025-2026.</p>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/50">© {new Date().getFullYear()} CouturTech. Tous droits réservés.</p>
    </footer>
  );
}

export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main key={pathname} className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function Protege({ roles, children }) {
  const { user, chargement } = useAuth();
  const location = useLocation();
  if (chargement) return <Spinner />;
  if (!user) return <Navigate to="/connexion" replace state={{ depuis: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ESPACES[user.role]} replace />;
  return children;
}

const MENUS = {
  GERANT: [
    ['/gerant', 'Tableau de bord', 'M3 12l9-8 9 8M5 10v10h14V10'],
    ['/gerant/commandes', 'Commandes', 'M6 2h9l5 5v15H6zM14 2v6h6'],
    ['/gerant/production', 'Production', 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z'],
    ['/gerant/collectes', 'Collectes', 'M3 7h11v10H3zM14 10h4l3 3v4h-7M7 20a2 2 0 1 0 0-.01M17 20a2 2 0 1 0 0-.01'],
    ['/gerant/modeles', 'Modèles', 'M8 3l4 3 4-3 4 4-3 3v11H7V10L4 7z'],
    ['/gerant/tissus', 'Tissus et stock', 'M4 6h16M4 12h16M4 18h16'],
    ['/gerant/paiements', 'Paiements', 'M3 6h18v12H3zM3 10h18'],
    ['/gerant/clients', 'Clients', 'M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0'],
    ['/gerant/equipe', 'Équipe', 'M17 20a5 5 0 0 0-10 0M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 18a4 4 0 0 0-3-4M4 18a4 4 0 0 1 3-4'],
    ['/gerant/notifications', 'Journal des envois', 'M4 4h16v12H5l-1 4z'],
    ['/gerant/parametres', 'Paramètres', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19 12l2-1-2-4-2 1-2-2V4h-4v2L9 8 7 7 5 11l2 1v0l-2 1 2 4 2-1 2 2v2h4v-2l2-2 2 1 2-4z'],
  ],
  TAILLEUR: [
    ['/tailleur', 'Mes tâches', 'M9 11l3 3 8-8M4 4h10M4 12h4M4 20h16'],
    ['/tailleur/profil', 'Mon profil', 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21a8 8 0 0 1 16 0'],
  ],
  LIVREUR: [
    ['/livreur', 'Mes collectes', 'M3 7h11v10H3zM14 10h4l3 3v4h-7'],
    ['/livreur/profil', 'Mon profil', 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21a8 8 0 0 1 16 0'],
  ],
};

export function EspaceLayout({ role }) {
  const { user, deconnexion } = useAuth();
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const items = MENUS[role];
  const base = ESPACES[role];
  const lienCommande = role === 'GERANT' ? (id) => `/gerant/commandes/${id}` : role === 'TAILLEUR' ? (id) => `/tailleur/taches/${id}` : null;
  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Menu de l’espace">
      {items.map(([to, l, d]) => (
        <NavLink key={to} to={to} end={to === base} onClick={() => setMenu(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
          {l}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="flex min-h-screen bg-creme">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-nuit p-4 lg:flex">
        <div className="mb-6 px-2 pt-2"><Logo clair /></div>
        {nav}
        <div className="mt-auto border-t border-white/10 px-2 pt-4 text-sm text-white/70">
          <p className="font-semibold text-white">{user.prenom} {user.nom}</p>
          <p className="text-xs">{ROLES[user.role]}</p>
          <button type="button" className="mt-3 font-semibold text-or-400 hover:underline" onClick={() => { deconnexion(); navigate('/'); }}>Déconnexion</button>
        </div>
      </aside>
      {menu && (
        <div className="fixed inset-0 z-40 bg-nuit/50 lg:hidden" onClick={() => setMenu(false)}>
          <aside className="flex h-full w-72 flex-col bg-nuit p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 px-2 pt-2"><Logo clair /></div>
            {nav}
            <button type="button" className="mt-auto px-3 py-3 text-left text-sm font-semibold text-or-400" onClick={() => { deconnexion(); navigate('/'); }}>Déconnexion</button>
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-nuit/10 bg-creme/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg lg:hidden" onClick={() => setMenu(true)} aria-label="Ouvrir le menu">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <p className="text-sm font-semibold text-nuit/70">Espace {ROLES[role].toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden text-sm font-medium text-nuit/60 hover:text-nuit sm:block">Voir le site</Link>
            <Cloche lienCommande={lienCommande} />
          </div>
        </header>
        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
