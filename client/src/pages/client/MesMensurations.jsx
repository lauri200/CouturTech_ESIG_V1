import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { date } from '../../lib/format';
import { Champ, Erreur, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { TableMesures } from '../../components/Mensurations';

const CONSIGNES = [
  'Portez des vêtements près du corps (legging, t-shirt ajusté) ; cheveux attachés.',
  'Fond uni et bien éclairé, sans contre-jour.',
  'Téléphone à hauteur de taille, à environ 2,5 m ; le corps entier visible, de la tête aux pieds.',
  'Face : bras écartés du corps, pieds à largeur d’épaules. Profil droit : bras le long du corps.',
];

function compresser(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Image illisible.'));
    img.src = URL.createObjectURL(file);
  });
}

export default function MesMensurations() {
  const conf = useApi('/mensurations/config');
  const liste = useApi('/mensurations');
  const toast = useToast();
  const [valeurs, setValeurs] = useState({});
  const [scan, setScan] = useState({ age: '', genre: 'female', stature_cm: '', poids_kg: '', photo_face: null, photo_profil: null });
  const [err, setErr] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  if (!conf.data || !liste.data) return <Spinner />;
  const mesures = conf.data.mesures;

  const enregistrer = async () => {
    setErr(null);
    setEnvoi(true);
    const body = Object.fromEntries(Object.entries(valeurs).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(String(v).replace(',', '.'))]));
    try {
      await api('/mensurations', { method: 'POST', body: { valeurs: body } });
      setValeurs({});
      toast('Mensurations enregistrées.');
      liste.recharger();
    } catch (e) { setErr(e); } finally { setEnvoi(false); }
  };
  const photo = async (cle, file) => {
    if (!file) return;
    try { const url = await compresser(file); setScan((s) => ({ ...s, [cle]: url })); } catch (e) { setErr(e); }
  };
  const scanner = async () => {
    setErr(null);
    setEnvoi(true);
    try {
      await api('/mensurations/scan', { method: 'POST', body: scan });
      toast('Scan terminé : vos mensurations sont enregistrées.');
      setScan((s) => ({ ...s, photo_face: null, photo_profil: null }));
      liste.recharger();
    } catch (e) { setErr(e); } finally { setEnvoi(false); }
  };

  return (
    <div className="conteneur max-w-5xl py-8">
      <h1 className="titre-section">Mes mensurations</h1>
      <p className="mt-2 max-w-3xl text-nuit/70">Vos mesures en centimètres permettent au tailleur de couper la tenue à votre corps, au lieu d’une simple taille S, M ou L qui varie d’un pays et d’une marque à l’autre. Vous les choisissez au moment de commander.</p>

      <section className="mt-6 space-y-3">
        {liste.data.length === 0 && <p className="carte p-4 text-sm text-nuit/70">Aucune mensuration enregistrée pour l’instant.</p>}
        {liste.data.map((m) => (
          <article key={m.id} className="carte p-4">
            <p className="mb-2 text-sm font-semibold">{date(m.created_at, true)} · {m.source === 'SCAN' ? 'Scan par photos' : 'Saisie manuelle'}</p>
            <TableMesures valeurs={m.valeurs} />
          </article>
        ))}
      </section>

      <Erreur erreur={err} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="carte p-5">
          <h2 className="text-xl font-semibold">Saisir mes mesures</h2>
          <p className="mt-1 text-sm text-nuit/60">Mesurez-vous avec un mètre ruban, sans serrer, en sous-vêtements ou vêtements fins. Remplissez au moins une mesure.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {mesures.map((m) => (
              <Champ key={m.cle} label={`${m.libelle} (cm)`} id={`m-${m.cle}`}>
                <input id={`m-${m.cle}`} inputMode="decimal" className="champ" value={valeurs[m.cle] || ''} onChange={(e) => setValeurs({ ...valeurs, [m.cle]: e.target.value })} />
              </Champ>
            ))}
          </div>
          <button type="button" className="btn-or mt-4 w-full" disabled={envoi} onClick={enregistrer}>ENREGISTRER MES MESURES</button>
        </section>

        <section className="carte p-5">
          <h2 className="text-xl font-semibold">Scan par photos</h2>
          {!conf.data.scan_disponible ? (
            <p className="mt-2 rounded-lg bg-nuit-50 p-3 text-sm text-nuit/70">Bientôt disponible : deux photos prises avec votre téléphone suffiront à calculer vos mesures. En attendant, saisissez-les manuellement.</p>
          ) : (
            <>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-nuit/70">{CONSIGNES.map((c) => <li key={c}>{c}</li>)}</ul>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Champ label="Âge" id="s-age"><input id="s-age" inputMode="numeric" className="champ" value={scan.age} onChange={(e) => setScan({ ...scan, age: e.target.value })} /></Champ>
                <Champ label="Morphologie" id="s-genre"><select id="s-genre" className="champ" value={scan.genre} onChange={(e) => setScan({ ...scan, genre: e.target.value })}><option value="female">Femme</option><option value="male">Homme</option></select></Champ>
                <Champ label="Taille (cm)" id="s-st"><input id="s-st" inputMode="decimal" className="champ" value={scan.stature_cm} onChange={(e) => setScan({ ...scan, stature_cm: e.target.value })} /></Champ>
                <Champ label="Poids (kg)" id="s-pd"><input id="s-pd" inputMode="decimal" className="champ" value={scan.poids_kg} onChange={(e) => setScan({ ...scan, poids_kg: e.target.value })} /></Champ>
                {[['photo_face', 'Photo de face'], ['photo_profil', 'Photo de profil droit']].map(([cle, l]) => (
                  <div key={cle}>
                    <label htmlFor={cle} className="text-sm font-semibold">{l}</label>
                    <input id={cle} type="file" accept="image/*" capture="environment" className="mt-1 block w-full text-sm" onChange={(e) => photo(cle, e.target.files[0])} />
                    {scan[cle] && <img src={scan[cle]} alt="" className="mt-2 h-32 rounded-lg object-cover" />}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-nuit/60">Les photos sont envoyées au service de mesure pour le calcul, puis ne sont pas conservées par CouturTech. Vérifiez les résultats : vous pouvez toujours les corriger par une saisie manuelle.</p>
              <button type="button" className="btn-or mt-4 w-full" disabled={envoi || !scan.photo_face || !scan.photo_profil} onClick={scanner}>{envoi ? 'Analyse en cours…' : 'LANCER LE SCAN'}</button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
