import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ROLES } from '../lib/format';
import { Champ, EnTete, Erreur, Modal } from '../components/ui';
import { useToast } from '../components/Toast';

export default function Profil() {
  const { user, setUser, deconnexion } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [f, setF] = useState({ prenom: user.prenom, nom: user.nom, telephone: user.telephone, quartier: user.quartier || '', adresse: user.adresse || '' });
  const [m, setM] = useState({ mot_de_passe_actuel: '', nouveau_mot_de_passe: '' });
  const [erreur, setErreur] = useState(null);
  const [suppr, setSuppr] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const enregistrer = async (e) => {
    e.preventDefault();
    try {
      setUser(await api('/auth/me', { method: 'PATCH', body: f }));
      setErreur(null);
      toast('Profil enregistré.');
    } catch (ex) { setErreur(ex); }
  };
  const changerMdp = async (e) => {
    e.preventDefault();
    try {
      setUser(await api('/auth/me', { method: 'PATCH', body: m }));
      setM({ mot_de_passe_actuel: '', nouveau_mot_de_passe: '' });
      setErreur(null);
      toast('Mot de passe modifié.');
    } catch (ex) { setErreur(ex); }
  };
  const supprimer = async () => {
    try {
      await api('/auth/me', { method: 'DELETE' });
      deconnexion();
      navigate('/');
    } catch (ex) { setErreur(ex); setSuppr(false); }
  };
  return (
    <div className="max-w-2xl">
      <EnTete titre="Mon profil" sousTitre={`${user.email} · ${ROLES[user.role]}`} />
      {user.doit_changer_mdp && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Votre mot de passe est provisoire : choisissez-en un nouveau ci-dessous.</p>}
      <Erreur erreur={erreur} />
      <form onSubmit={enregistrer} className="carte mt-4 space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ label="Prénom" id="p"><input id="p" className="champ" value={f.prenom} onChange={set('prenom')} /></Champ>
          <Champ label="Nom" id="n"><input id="n" className="champ" value={f.nom} onChange={set('nom')} /></Champ>
        </div>
        <Champ label="Téléphone" id="t" aide="+228 XX XX XX XX"><input id="t" className="champ" value={f.telephone} onChange={set('telephone')} /></Champ>
        {user.role === 'CLIENT' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ label="Quartier" id="q"><input id="q" className="champ" value={f.quartier} onChange={set('quartier')} /></Champ>
            <Champ label="Adresse" id="a"><input id="a" className="champ" value={f.adresse} onChange={set('adresse')} /></Champ>
          </div>
        )}
        <button type="submit" className="btn-primaire">ENREGISTRER</button>
      </form>
      <form onSubmit={changerMdp} className="carte mt-4 space-y-4 p-5">
        <h2 className="text-lg font-semibold">Mot de passe</h2>
        <Champ label="Mot de passe actuel" id="ma"><input id="ma" type="password" className="champ" value={m.mot_de_passe_actuel} onChange={(e) => setM({ ...m, mot_de_passe_actuel: e.target.value })} /></Champ>
        <Champ label="Nouveau mot de passe" id="mn" aide="8 caractères minimum"><input id="mn" type="password" className="champ" value={m.nouveau_mot_de_passe} onChange={(e) => setM({ ...m, nouveau_mot_de_passe: e.target.value })} /></Champ>
        <button type="submit" className="btn-contour">CHANGER LE MOT DE PASSE</button>
      </form>
      {user.role === 'CLIENT' && (
        <div className="mt-4 rounded-xl border border-red-200 p-5">
          <h2 className="text-lg font-semibold text-red-800">Supprimer mon compte</h2>
          <p className="mt-1 text-sm text-nuit/70">Possible uniquement sans commande en cours. Vos commandes passées seront anonymisées.</p>
          <button type="button" className="btn-danger mt-3" onClick={() => setSuppr(true)}>SUPPRIMER MON COMPTE</button>
        </div>
      )}
      <Modal ouvert={suppr} titre="Supprimer votre compte ?" onFermer={() => setSuppr(false)}>
        <p className="text-sm">Cette action est définitive.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-contour" onClick={() => setSuppr(false)}>Annuler</button>
          <button type="button" className="btn bg-red-700 text-white hover:bg-red-800" onClick={supprimer}>Supprimer</button>
        </div>
      </Modal>
    </div>
  );
}
