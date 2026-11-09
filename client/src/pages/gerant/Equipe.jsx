import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { ROLES } from '../../lib/format';
import { Champ, EnTete, Erreur, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function Equipe() {
  const { data, erreur, recharger } = useApi('/utilisateurs');
  const toast = useToast();
  const [f, setF] = useState(null);
  const [cree, setCree] = useState(null);
  const [err, setErr] = useState(null);
  const creer = async () => {
    try { const r = await api('/utilisateurs', { method: 'POST', body: f }); setF(null); setCree(r); recharger(); } catch (e) { setErr(e); }
  };
  const basculer = async (u) => {
    try { await api(`/utilisateurs/${u.id}`, { method: 'PATCH', body: { actif: !u.actif } }); toast(u.actif ? 'Compte désactivé.' : 'Compte réactivé.'); recharger(); } catch (e) { toast(e.message, 'erreur'); }
  };
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  return (
    <>
      <EnTete titre="Équipe" sousTitre="Gérants, tailleurs et livreurs" actions={<button type="button" className="btn-or" onClick={() => { setErr(null); setF({ prenom: '', nom: '', email: '', telephone: '+228 ', role: 'TAILLEUR' }); }}>+ AJOUTER UN MEMBRE</button>} />
      {!data ? <Spinner /> : (
        <div className="carte overflow-x-auto">
          <table className="tableau">
            <thead><tr><th>Nom</th><th>Rôle</th><th>Contact</th><th>En cours</th><th>Statut</th><th /></tr></thead>
            <tbody>{data.map((u) => (
              <tr key={u.id} className={u.actif ? '' : 'opacity-50'}>
                <td className="font-medium">{u.prenom} {u.nom}</td><td>{ROLES[u.role]}</td>
                <td>{u.telephone}<p className="text-xs text-nuit/50">{u.email}</p></td>
                <td>{u.role === 'TAILLEUR' ? `${u.taches_en_cours} tâche(s)` : u.role === 'LIVREUR' ? `${u.collectes_en_cours} collecte(s)` : '—'}</td>
                <td>{u.actif ? 'Actif' : 'Inactif'}</td>
                <td className="text-right"><button type="button" className="btn-lien" onClick={() => basculer(u)}>{u.actif ? 'Désactiver' : 'Réactiver'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <Modal ouvert={Boolean(f)} titre="Nouveau membre" onFermer={() => setF(null)}>
        {f && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Prénom" id="p"><input id="p" className="champ" value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} /></Champ>
              <Champ label="Nom" id="n"><input id="n" className="champ" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Champ>
            </div>
            <Champ label="E-mail" id="e"><input id="e" type="email" className="champ" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Champ>
            <Champ label="Téléphone" id="t"><input id="t" className="champ" value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} /></Champ>
            <Champ label="Rôle" id="r"><select id="r" className="champ" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="TAILLEUR">Tailleur</option><option value="LIVREUR">Livreur</option><option value="GERANT">Gérant</option></select></Champ>
            <Erreur erreur={err} />
            <button type="button" className="btn-or w-full" onClick={creer}>CRÉER LE COMPTE</button>
          </div>
        )}
      </Modal>
      <Modal ouvert={Boolean(cree)} titre="Compte créé" onFermer={() => setCree(null)}>
        <p className="text-sm">Communiquez ces identifiants à {cree?.prenom}. Le mot de passe devra être changé à la première connexion.</p>
        <dl className="mt-3 rounded-lg bg-nuit-50 p-3 text-sm"><p>E-mail : <strong>{cree?.email}</strong></p><p>Mot de passe provisoire : <code className="font-bold">{cree?.mot_de_passe_provisoire}</code></p></dl>
      </Modal>
    </>
  );
}
