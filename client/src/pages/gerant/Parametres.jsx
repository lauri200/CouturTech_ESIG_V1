import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { Champ, EnTete, Erreur, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

const CHAMPS = [
  ['NOM_MAISON', 'Nom de la maison'], ['ADRESSE_ATELIER', 'Adresse de l’atelier (essayage)'], ['HORAIRES_ATELIER', 'Horaires'],
  ['TELEPHONE_MAISON', 'Téléphone'], ['EMAIL_MAISON', 'E-mail'], ['D_ALERTE_HEURES', 'Alerte avant deadline (heures)'],
  ['FRAIS_COLLECTE', 'Frais de collecte (FCFA)'], ['ACOMPTE_POURCENT', 'Acompte minimum avant confection (%)'], ['CRENEAUX_COLLECTE', 'Créneaux de collecte (séparés par des virgules)'], ['MAX_TENTATIVES_NOTIF', 'Tentatives d’envoi max.'],
];

export default function Parametres() {
  const { data, erreur } = useApi('/parametres');
  const toast = useToast();
  const [f, setF] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { if (data) setF(data); }, [data]);
  if (erreur) return <Erreur erreur={erreur} />;
  if (!f) return <Spinner />;
  const enregistrer = async (e) => {
    e.preventDefault();
    try { setF(await api('/parametres', { method: 'PUT', body: f })); setErr(null); toast('Paramètres enregistrés.'); } catch (ex) { setErr(ex); }
  };
  return (
    <form onSubmit={enregistrer} className="max-w-2xl">
      <EnTete titre="Paramètres" sousTitre="Informations de CHIDE’S COUTURE utilisées dans les e-mails, SMS et PDF" />
      <div className="carte space-y-4 p-5">
        {CHAMPS.map(([k, l]) => <Champ key={k} label={l} id={k}><input id={k} className="champ" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Champ>)}
        <Erreur erreur={err} />
        <button type="submit" className="btn-or">ENREGISTRER</button>
      </div>
    </form>
  );
}
