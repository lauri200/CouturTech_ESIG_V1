import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { EspaceLayout, Protege, PublicLayout } from './components/Layouts';
import { Spinner } from './components/ui';
import Accueil from './pages/public/Accueil';
import Modeles from './pages/public/Modeles';
import FicheModele from './pages/public/FicheModele';
import Tissus from './pages/public/Tissus';
import APropos from './pages/public/APropos';
import { Connexion, Inscription, MotDePasseOublie, Reinitialiser } from './pages/public/Auth';
import Confidentialite from './pages/public/Confidentialite';
import Introuvable from './pages/public/Introuvable';
import Profil from './pages/Profil';

const Commander = lazy(() => import('./pages/client/Commander'));
const MesCommandes = lazy(() => import('./pages/client/MesCommandes'));
const SuiviCommande = lazy(() => import('./pages/client/SuiviCommande'));
const TableauDeBord = lazy(() => import('./pages/gerant/TableauDeBord'));
const GCommandes = lazy(() => import('./pages/gerant/Commandes'));
const GCommande = lazy(() => import('./pages/gerant/CommandeDetail'));
const Production = lazy(() => import('./pages/gerant/Production'));
const GCollectes = lazy(() => import('./pages/gerant/Collectes'));
const GModeles = lazy(() => import('./pages/gerant/GestionModeles'));
const GTissus = lazy(() => import('./pages/gerant/GestionTissus'));
const Paiements = lazy(() => import('./pages/gerant/Paiements'));
const Clients = lazy(() => import('./pages/gerant/Clients'));
const Equipe = lazy(() => import('./pages/gerant/Equipe'));
const Journal = lazy(() => import('./pages/gerant/Journal'));
const Parametres = lazy(() => import('./pages/gerant/Parametres'));
const Taches = lazy(() => import('./pages/tailleur/Taches'));
const Tache = lazy(() => import('./pages/tailleur/Tache'));
const LCollectes = lazy(() => import('./pages/livreur/MesCollectes'));
const LCollecte = lazy(() => import('./pages/livreur/Collecte'));

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Accueil />} />
          <Route path="modeles" element={<Modeles />} />
          <Route path="modeles/:id" element={<FicheModele />} />
          <Route path="tissus" element={<Tissus />} />
          <Route path="a-propos" element={<APropos />} />
          <Route path="connexion" element={<Connexion />} />
          <Route path="inscription" element={<Inscription />} />
          <Route path="mot-de-passe-oublie" element={<MotDePasseOublie />} />
          <Route path="reinitialiser-mot-de-passe" element={<Reinitialiser />} />
          <Route path="confidentialite" element={<Confidentialite />} />
          <Route path="client/commander" element={<Protege roles={['CLIENT']}><Commander /></Protege>} />
          <Route path="client/commandes" element={<Protege roles={['CLIENT']}><MesCommandes /></Protege>} />
          <Route path="client/commandes/:id" element={<Protege roles={['CLIENT']}><SuiviCommande /></Protege>} />
          <Route path="client/profil" element={<Protege roles={['CLIENT']}><div className="conteneur py-8"><Profil /></div></Protege>} />
          <Route path="*" element={<Introuvable />} />
        </Route>
        <Route path="gerant" element={<Protege roles={['GERANT']}><EspaceLayout role="GERANT" /></Protege>}>
          <Route index element={<TableauDeBord />} />
          <Route path="commandes" element={<GCommandes />} />
          <Route path="commandes/:id" element={<GCommande />} />
          <Route path="production" element={<Production />} />
          <Route path="collectes" element={<GCollectes />} />
          <Route path="modeles" element={<GModeles />} />
          <Route path="tissus" element={<GTissus />} />
          <Route path="paiements" element={<Paiements />} />
          <Route path="clients" element={<Clients />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="notifications" element={<Journal />} />
          <Route path="parametres" element={<Parametres />} />
        </Route>
        <Route path="tailleur" element={<Protege roles={['TAILLEUR']}><EspaceLayout role="TAILLEUR" /></Protege>}>
          <Route index element={<Taches />} />
          <Route path="taches/:id" element={<Tache />} />
          <Route path="profil" element={<Profil />} />
        </Route>
        <Route path="livreur" element={<Protege roles={['LIVREUR']}><EspaceLayout role="LIVREUR" /></Protege>}>
          <Route index element={<LCollectes />} />
          <Route path="collectes/:id" element={<LCollecte />} />
          <Route path="profil" element={<Profil />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
