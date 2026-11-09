import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, televerserImage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { aujourdhui, date, fcfa, TAILLES } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { Champ, Erreur, Ligne, Spinner } from '../../components/ui';
import { CarteTissu } from '../public/Tissus';

const ETAPES = ['Modèle', 'Taille', 'Tissu', 'Récapitulatif'];
const TEL = /^\+228\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}$/;

export default function Commander() {
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const modeles = useApi('/modeles?limit=100');
  const tissus = useApi('/tissus');
  const params = useApi('/parametres/public');
  const cle = useRef(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  const [etape, setEtape] = useState(sp.get('modele') ? (sp.get('taille') ? 2 : 1) : 0);
  const [modeleId, setModeleId] = useState(Number(sp.get('modele')) || null);
  const [taille, setTaille] = useState(sp.get('taille') || '');
  const [source, setSource] = useState('');
  const [tissu, setTissu] = useState(null);
  const [desc, setDesc] = useState('');
  const [photo, setPhoto] = useState(null);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [collecte, setCollecte] = useState({ adresse: user.adresse || '', quartier: user.quartier || '', repere: '', telephone: user.telephone || '', date_souhaitee: aujourdhui(1), creneau_souhaite: '' });
  const [err, setErr] = useState({});
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);

  const modele = useMemo(() => modeles.data?.items.find((m) => m.id === modeleId), [modeles.data, modeleId]);
  const metrage = modele && taille ? modele.metrages[taille] : null;
  const creneaux = (params.data?.CRENEAUX_COLLECTE || '').split(',').filter(Boolean);
  const frais = Number(params.data?.FRAIS_COLLECTE) || 0;
  const pctAcompte = Number(params.data?.ACOMPTE_POURCENT) || 0;
  const prixTissu = source === 'MAISON' && tissu && metrage ? Math.round(tissu.prix_metre * metrage) : 0;
  const total = (modele?.prix_confection || 0) + prixTissu + (source === 'CLIENT' ? frais : 0);
  const remise = modele ? (() => { const d = new Date(); d.setDate(d.getDate() + modele.delai_jours); return d.toISOString().slice(0, 10); })() : null;

  useEffect(() => { window.scrollTo({ top: 0 }); }, [etape]);

  if (modeles.chargement || tissus.chargement) return <Spinner />;

  const suivant = () => {
    const e = {};
    if (etape === 0 && !modele) e.modele = 'Choisissez un modèle.';
    if (etape === 1 && !taille) e.taille = 'Choisissez une taille.';
    if (etape === 2) {
      if (!source) e.source = 'Choisissez un tissu.';
      if (source === 'MAISON' && !tissu) e.source = 'Choisissez un tissu de la maison.';
      if (source === 'CLIENT') {
        if (!desc.trim()) e.desc = 'Décrivez votre tissu.';
        if (!collecte.adresse.trim()) e.adresse = 'Adresse obligatoire';
        if (!collecte.quartier.trim()) e.quartier = 'Quartier obligatoire';
        if (!TEL.test(collecte.telephone.trim())) e.telephone = 'Format attendu : +228 XX XX XX XX';
        if (!collecte.date_souhaitee || collecte.date_souhaitee < aujourdhui()) e.date = 'Date à partir d’aujourd’hui';
        if (!collecte.creneau_souhaite) e.creneau = 'Choisissez un créneau';
      }
    }
    setErr(e);
    if (Object.keys(e).length === 0) setEtape(etape + 1);
  };

  const ajouterPhoto = async (file) => {
    if (!file) return;
    setEnvoiPhoto(true);
    try {
      const r = await televerserImage(file);
      setPhoto(r.url);
      setErr((x) => ({ ...x, photo: undefined }));
    } catch (ex) {
      setErr((x) => ({ ...x, photo: ex.message }));
    } finally {
      setEnvoiPhoto(false);
    }
  };

  const valider = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const body = { modele_id: modele.id, taille, source_tissu: source };
      if (source === 'MAISON') body.tissu_id = tissu.id;
      else Object.assign(body, { description_tissu_client: desc, photo_tissu_client_url: photo, collecte: { ...collecte, telephone: collecte.telephone.trim() } });
      const cmd = await api('/commandes', { method: 'POST', body, headers: { 'Idempotency-Key': cle.current }, retries: 2 });
      navigate(`/client/commandes/${cmd.id}?confirmee=1`, { replace: true });
    } catch (ex) {
      setErreur(ex);
      setEnvoi(false);
    }
  };

  return (
    <div className="conteneur max-w-4xl py-8">
      <h1 className="titre-section">Nouvelle commande</h1>
      <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Étapes">
        {ETAPES.map((l, i) => (
          <li key={l}>
            <button type="button" disabled={i > etape} onClick={() => setEtape(i)} className="w-full text-left disabled:cursor-default">
              <span className={`block h-1.5 rounded-full ${i <= etape ? 'bg-or' : 'bg-nuit/10'}`} />
              <span className={`mt-2 block text-xs font-semibold sm:text-sm ${i === etape ? 'text-nuit' : 'text-nuit/50'}`}>{i + 1}. {l}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {etape === 0 && (
          <section>
            <h2 className="text-xl font-semibold">Choisissez votre modèle</h2>
            {err.modele && <p className="mt-2 text-sm text-red-700">{err.modele}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {modeles.data.items.map((m) => (
                <button key={m.id} type="button" onClick={() => { setModeleId(m.id); setTaille(''); }} aria-pressed={modeleId === m.id}
                  className={`carte overflow-hidden text-left transition ${modeleId === m.id ? 'ring-2 ring-or ring-offset-2' : 'hover:shadow-md'}`}>
                  <img src={m.photos[0]} alt="" className="aspect-[3/4] w-full object-cover" loading="lazy" />
                  <div className="p-3"><p className="font-semibold leading-tight">{m.nom}</p><p className="text-sm text-nuit/60">{fcfa(m.prix_confection)}</p></div>
                </button>
              ))}
            </div>
          </section>
        )}

        {etape === 1 && modele && (
          <section className="grid gap-6 sm:grid-cols-[180px_1fr]">
            <img src={modele.photos[0]} alt={modele.nom} className="aspect-[3/4] w-full max-w-[180px] rounded-xl object-cover" />
            <div>
              <h2 className="text-xl font-semibold">Votre taille pour « {modele.nom} »</h2>
              <p className="mt-1 text-sm text-nuit/60">Les ajustements fins sont faits sur place lors de l’essayage.</p>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {TAILLES.filter((t) => modele.metrages[t]).map((t) => (
                  <button key={t} type="button" onClick={() => setTaille(t)} aria-pressed={taille === t}
                    className={`min-h-[52px] rounded-lg border text-base font-semibold ${taille === t ? 'border-nuit bg-nuit text-white' : 'border-nuit/20 bg-white hover:border-nuit'}`}>
                    {t}<span className="block text-[11px] font-normal opacity-70">{modele.metrages[t]} m</span>
                  </button>
                ))}
              </div>
              {err.taille && <p className="mt-2 text-sm text-red-700">{err.taille}</p>}
            </div>
          </section>
        )}

        {etape === 2 && (
          <section>
            <h2 className="text-xl font-semibold">Votre tissu</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[['MAISON', 'Tissu de la maison', `Choisissez parmi nos tissus disponibles (${metrage} m nécessaires).`], ['CLIENT', 'J’apporte mon tissu', 'Un livreur vient le récupérer chez vous.']].map(([v, t, d]) => (
                <button key={v} type="button" onClick={() => setSource(v)} aria-pressed={source === v}
                  className={`carte p-4 text-left ${source === v ? 'ring-2 ring-or ring-offset-2' : 'hover:shadow-md'}`}>
                  <p className="font-semibold">{t}</p><p className="mt-1 text-sm text-nuit/60">{d}</p>
                </button>
              ))}
            </div>
            {err.source && <p className="mt-2 text-sm text-red-700">{err.source}</p>}
            {source === 'MAISON' && (
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {tissus.data.items.map((t) => <CarteTissu key={t.id} t={t} besoin={metrage} selectionne={tissu?.id === t.id} onChoisir={setTissu} />)}
              </div>
            )}
            {source === 'CLIENT' && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="carte space-y-4 p-4">
                  <h3 className="font-semibold">Votre tissu</h3>
                  <Champ label="Description" id="desc" erreur={err.desc} aide={`Type, couleur, longueur. Prévoir au moins ${metrage} m.`}>
                    <textarea id="desc" rows={3} className="champ" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex. : bazin blanc, 6 mètres" />
                  </Champ>
                  <Champ label="Photo (facultatif)" id="photo" erreur={err.photo} aide="JPG, PNG ou WEBP, 2 Mo maximum">
                    <input id="photo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm" onChange={(e) => ajouterPhoto(e.target.files[0])} />
                  </Champ>
                  {envoiPhoto && <p className="text-xs text-nuit/60">Envoi de la photo…</p>}
                  {photo && <img src={photo} alt="Votre tissu" className="h-28 w-28 rounded-lg object-cover" />}
                </div>
                <div className="carte space-y-4 p-4">
                  <h3 className="font-semibold">Collecte à domicile</h3>
                  <Champ label="Adresse" id="adr" erreur={err.adresse}><input id="adr" className="champ" value={collecte.adresse} onChange={(e) => setCollecte({ ...collecte, adresse: e.target.value })} /></Champ>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Champ label="Quartier" id="qr" erreur={err.quartier}><input id="qr" className="champ" value={collecte.quartier} onChange={(e) => setCollecte({ ...collecte, quartier: e.target.value })} /></Champ>
                    <Champ label="Téléphone" id="tl" erreur={err.telephone}><input id="tl" type="tel" className="champ" value={collecte.telephone} onChange={(e) => setCollecte({ ...collecte, telephone: e.target.value })} /></Champ>
                  </div>
                  <Champ label="Repère (facultatif)" id="rp"><input id="rp" className="champ" value={collecte.repere} placeholder="Ex. : portail bleu, face à la pharmacie" onChange={(e) => setCollecte({ ...collecte, repere: e.target.value })} /></Champ>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Champ label="Date souhaitée" id="dt" erreur={err.date}><input id="dt" type="date" min={aujourdhui()} className="champ" value={collecte.date_souhaitee} onChange={(e) => setCollecte({ ...collecte, date_souhaitee: e.target.value })} /></Champ>
                    <Champ label="Créneau" id="cr" erreur={err.creneau}>
                      <select id="cr" className="champ" value={collecte.creneau_souhaite} onChange={(e) => setCollecte({ ...collecte, creneau_souhaite: e.target.value })}>
                        <option value="">Choisir…</option>
                        {creneaux.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Champ>
                  </div>
                  {frais > 0 && <p className="text-xs text-nuit/60">Frais de collecte : {fcfa(frais)}</p>}
                </div>
              </div>
            )}
          </section>
        )}

        {etape === 3 && modele && (
          <section className="grid gap-6 md:grid-cols-[1fr_320px]">
            <div className="carte p-5">
              <h2 className="text-xl font-semibold">Récapitulatif</h2>
              <div className="mt-4 flex gap-4">
                <img src={modele.photos[0]} alt="" className="h-28 w-20 rounded-lg object-cover" />
                <div>
                  <p className="font-semibold">{modele.nom}</p>
                  <p className="text-sm text-nuit/60">Taille {taille} · {metrage} m</p>
                  <p className="text-sm text-nuit/60">{source === 'MAISON' ? `Tissu : ${tissu.nom}` : 'Votre tissu (collecte à domicile)'}</p>
                </div>
              </div>
              {source === 'CLIENT' && (
                <div className="mt-4 rounded-lg bg-nuit-50 p-3 text-sm">
                  <p className="font-semibold">Collecte</p>
                  <p>{collecte.adresse}, {collecte.quartier}{collecte.repere ? ` (${collecte.repere})` : ''}</p>
                  <p>{date(collecte.date_souhaitee)} · {collecte.creneau_souhaite} · {collecte.telephone}</p>
                </div>
              )}
              <p className="mt-4 text-sm text-nuit/70">Date de remise prévue : <strong>{date(remise)}</strong>{source === 'CLIENT' ? ' (sous réserve de la collecte de votre tissu)' : ''}.</p>
              <p className="mt-1 text-sm text-nuit/70">Vous recevrez un e-mail de confirmation. Paiement à l’atelier (espèces ou Mobile Money).</p>
            </div>
            <aside className="carte h-fit p-5">
              <dl>
                <Ligne label="Confection">{fcfa(modele.prix_confection)}</Ligne>
                <Ligne label="Tissu">{source === 'MAISON' ? fcfa(prixTissu) : 'Fourni'}</Ligne>
                {source === 'CLIENT' && frais > 0 && <Ligne label="Collecte">{fcfa(frais)}</Ligne>}
                <div className="mt-2 flex justify-between border-t border-nuit/10 pt-3 text-lg font-bold"><span>Total</span><span>{fcfa(total)}</span></div>
                {pctAcompte > 0 && <p className="mt-2 text-xs text-nuit/70">Acompte de {pctAcompte} % ({fcfa(Math.ceil((total * pctAcompte) / 100))}) à régler avant le début de la confection.</p>}
              </dl>
              <Erreur erreur={erreur} />
              <button type="button" onClick={valider} disabled={envoi} className="btn-or mt-4 w-full text-base">{envoi ? 'Validation…' : 'VALIDER MA COMMANDE'}</button>
            </aside>
          </section>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {etape > 0 ? <button type="button" className="btn-contour" onClick={() => setEtape(etape - 1)}>← Retour</button> : <Link to="/modeles" className="btn-contour">Annuler</Link>}
        {etape < 3 && <button type="button" className="btn-primaire" onClick={suivant}>Continuer →</button>}
      </div>
    </div>
  );
}
