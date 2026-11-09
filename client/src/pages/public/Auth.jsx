import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { ESPACES } from '../../lib/format';
import { Champ, Erreur } from '../../components/ui';

function Cadre({ titre, sousTitre, children }) {
  return (
    <div className="conteneur flex justify-center py-10 sm:py-16">
      <div className="carte w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{titre}</h1>
        {sousTitre && <p className="mt-1 text-sm text-nuit/60">{sousTitre}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

const COMPTES_DEMO = [
  ['Client', 'client@couturtech.tg'],
  ['Gérant', 'gerant@couturtech.tg'],
  ['Tailleur', 'tailleur@couturtech.tg'],
  ['Livreur', 'livreur@couturtech.tg'],
];

export function Connexion() {
  const { connexion } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [f, setF] = useState({ email: '', mot_de_passe: '' });
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const soumettre = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    try {
      const u = await connexion(f.email, f.mot_de_passe);
      navigate(state?.depuis && (u.role === 'CLIENT' || !state.depuis.startsWith('/client')) ? state.depuis : ESPACES[u.role], { replace: true });
    } catch (err) {
      setErreur(err);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre titre="Connexion" sousTitre={state?.message || 'Accédez à votre espace CouturTech.'}>
      <form onSubmit={soumettre} className="space-y-4" noValidate>
        <Erreur erreur={erreur} />
        <Champ label="E-mail" id="email"><input id="email" type="email" autoComplete="email" className="champ" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Champ>
        <Champ label="Mot de passe" id="mdp"><input id="mdp" type="password" autoComplete="current-password" className="champ" required value={f.mot_de_passe} onChange={(e) => setF({ ...f, mot_de_passe: e.target.value })} /></Champ>
        <div className="text-right"><Link to="/mot-de-passe-oublie" className="btn-lien">Mot de passe oublié ?</Link></div>
        <button type="submit" className="btn-primaire w-full" disabled={envoi}>{envoi ? 'Connexion…' : 'SE CONNECTER'}</button>
      </form>
      <p className="mt-6 text-center text-sm">Pas encore de compte ? <Link to="/inscription" state={state} className="btn-lien">Créer un compte</Link></p>
      <details className="mt-6 rounded-lg bg-nuit-50 p-3 text-xs">
        <summary className="cursor-pointer font-semibold">Comptes de démonstration</summary>
        <p className="mt-2 text-nuit/70">Mot de passe : <code>Demo2026!</code></p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {COMPTES_DEMO.map(([r, email]) => (
            <button key={email} type="button" className="btn-contour min-h-0 py-1.5 text-xs" onClick={() => setF({ email, mot_de_passe: 'Demo2026!' })}>{r}</button>
          ))}
        </div>
      </details>
    </Cadre>
  );
}

const TEL = /^\+228\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/;

export function Inscription() {
  const { inscription } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [f, setF] = useState({ prenom: '', nom: '', telephone: '+228 ', email: '', quartier: '', adresse: '', mot_de_passe: '', confirmation: '', consentement: false });
  const [err, setErr] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const valider = () => {
    const e = {};
    if (!f.prenom.trim()) e.prenom = 'Prénom obligatoire';
    if (!f.nom.trim()) e.nom = 'Nom obligatoire';
    if (!TEL.test(f.telephone.trim())) e.telephone = 'Format attendu : +228 XX XX XX XX';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'E-mail invalide';
    if (f.mot_de_passe.length < 8) e.mot_de_passe = '8 caractères minimum';
    if (f.confirmation !== f.mot_de_passe) e.confirmation = 'Les mots de passe ne correspondent pas';
    if (!f.consentement) e.consentement = 'Vous devez accepter la politique de confidentialité';
    setErr(e);
    return Object.keys(e).length === 0;
  };
  const soumettre = async (e) => {
    e.preventDefault();
    if (!valider()) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const { confirmation, ...data } = f;
      void confirmation;
      await inscription({ ...data, telephone: data.telephone.trim() });
      navigate(state?.depuis || '/modeles', { replace: true });
    } catch (ex) {
      setErreur(ex);
    } finally {
      setEnvoi(false);
    }
  };
  return (
    <Cadre titre="Créer un compte" sousTitre="Pour commander et suivre votre confection.">
      <form onSubmit={soumettre} className="space-y-4" noValidate>
        <Erreur erreur={erreur} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ label="Prénom" id="prenom" erreur={err.prenom}><input id="prenom" className="champ" autoComplete="given-name" value={f.prenom} onChange={set('prenom')} /></Champ>
          <Champ label="Nom" id="nom" erreur={err.nom}><input id="nom" className="champ" autoComplete="family-name" value={f.nom} onChange={set('nom')} /></Champ>
        </div>
        <Champ label="Téléphone" id="tel" erreur={err.telephone} aide="Pour les SMS de suivi"><input id="tel" type="tel" className="champ" autoComplete="tel" value={f.telephone} onChange={set('telephone')} /></Champ>
        <Champ label="E-mail" id="email" erreur={err.email}><input id="email" type="email" className="champ" autoComplete="email" value={f.email} onChange={set('email')} /></Champ>
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ label="Quartier (facultatif)" id="quartier"><input id="quartier" className="champ" value={f.quartier} onChange={set('quartier')} /></Champ>
          <Champ label="Adresse (facultatif)" id="adresse"><input id="adresse" className="champ" autoComplete="street-address" value={f.adresse} onChange={set('adresse')} /></Champ>
        </div>
        <Champ label="Mot de passe" id="mdp" erreur={err.mot_de_passe} aide="8 caractères minimum"><input id="mdp" type="password" className="champ" autoComplete="new-password" value={f.mot_de_passe} onChange={set('mot_de_passe')} /></Champ>
        <Champ label="Confirmer le mot de passe" id="mdp2" erreur={err.confirmation}><input id="mdp2" type="password" className="champ" autoComplete="new-password" value={f.confirmation} onChange={set('confirmation')} /></Champ>
        <Champ erreur={err.consentement}>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-or" checked={f.consentement} onChange={set('consentement')} />
            <span>J’accepte la <Link to="/confidentialite" className="btn-lien" target="_blank">politique de confidentialité</Link>.</span>
          </label>
        </Champ>
        <button type="submit" className="btn-or w-full" disabled={envoi}>{envoi ? 'Création…' : 'CRÉER MON COMPTE'}</button>
      </form>
      <p className="mt-6 text-center text-sm">Déjà inscrit(e) ? <Link to="/connexion" state={state} className="btn-lien">Se connecter</Link></p>
    </Cadre>
  );
}

export function MotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [erreur, setErreur] = useState(null);
  const soumettre = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setMsg(r.message);
    } catch (ex) { setErreur(ex); }
  };
  return (
    <Cadre titre="Mot de passe oublié" sousTitre="Recevez un lien de réinitialisation par e-mail.">
      {msg ? <p className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{msg}</p> : (
        <form onSubmit={soumettre} className="space-y-4">
          <Erreur erreur={erreur} />
          <Champ label="E-mail" id="email"><input id="email" type="email" required className="champ" value={email} onChange={(e) => setEmail(e.target.value)} /></Champ>
          <button type="submit" className="btn-primaire w-full">ENVOYER LE LIEN</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/connexion" className="btn-lien">← Retour à la connexion</Link></p>
    </Cadre>
  );
}

export function Reinitialiser() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [erreur, setErreur] = useState(null);
  const soumettre = async (e) => {
    e.preventDefault();
    if (mdp !== mdp2) return setErreur({ message: 'Les mots de passe ne correspondent pas.' });
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token: sp.get('token') || '', mot_de_passe: mdp } });
      navigate('/connexion', { state: { message: 'Mot de passe modifié. Connectez-vous.' } });
    } catch (ex) { setErreur(ex); }
    return undefined;
  };
  return (
    <Cadre titre="Nouveau mot de passe">
      <form onSubmit={soumettre} className="space-y-4">
        <Erreur erreur={erreur} />
        <Champ label="Nouveau mot de passe" id="m1" aide="8 caractères minimum"><input id="m1" type="password" className="champ" value={mdp} onChange={(e) => setMdp(e.target.value)} /></Champ>
        <Champ label="Confirmer" id="m2"><input id="m2" type="password" className="champ" value={mdp2} onChange={(e) => setMdp2(e.target.value)} /></Champ>
        <button type="submit" className="btn-primaire w-full">ENREGISTRER</button>
      </form>
    </Cadre>
  );
}
