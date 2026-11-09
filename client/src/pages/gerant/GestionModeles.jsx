import { useState } from 'react';
import { api, televerserImage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { fcfa, TAILLES } from '../../lib/format';
import { Champ, EnTete, Erreur, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

const VIDE = { reference: '', nom: '', categorie: '', description: '', prix_confection: '', delai_jours: '', mis_en_avant: false, actif: true, photos: [], metrages: {} };

export default function GestionModeles() {
  const { data, erreur, recharger } = useApi('/modeles?tous=1&limit=100');
  const toast = useToast();
  const [f, setF] = useState(null);
  const [err, setErr] = useState(null);
  const enregistrer = async () => {
    try {
      const body = { ...f, prix_confection: Number(f.prix_confection), delai_jours: Number(f.delai_jours), metrages: Object.fromEntries(Object.entries(f.metrages).filter(([, v]) => v !== '' && v !== null)) };
      await api(f.id ? `/modeles/${f.id}` : '/modeles', { method: f.id ? 'PUT' : 'POST', body });
      setF(null); toast('Modèle enregistré.'); recharger();
    } catch (e) { setErr(e); }
  };
  const photo = async (file) => {
    try { const r = await televerserImage(file); setF((x) => ({ ...x, photos: [...x.photos, r.url].slice(0, 4) })); } catch (e) { setErr(e); }
  };
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  return (
    <>
      <EnTete titre="Modèles" sousTitre="Catalogue proposé aux clients" actions={<button type="button" className="btn-or" onClick={() => { setErr(null); setF(VIDE); }}>+ NOUVEAU MODÈLE</button>} />
      {!data ? <Spinner /> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {data.items.map((m) => (
            <button key={m.id} type="button" onClick={() => { setErr(null); setF({ ...m }); }} className={`carte overflow-hidden text-left hover:shadow-md ${m.actif ? '' : 'opacity-50'}`}>
              <img src={m.photos[0]} alt="" className="aspect-[4/5] w-full object-cover" />
              <div className="p-3 text-sm">
                <p className="text-xs text-nuit/50">{m.reference} · {m.categorie}{m.mis_en_avant ? ' · À la une' : ''}{m.actif ? '' : ' · Inactif'}</p>
                <p className="font-semibold">{m.nom}</p><p>{fcfa(m.prix_confection)} · {m.delai_jours} j</p>
              </div>
            </button>
          ))}
        </div>
      )}
      <Modal ouvert={Boolean(f)} titre={f?.id ? 'Modifier le modèle' : 'Nouveau modèle'} onFermer={() => setF(null)} large>
        {f && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Champ label="Référence" id="rf"><input id="rf" className="champ" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Champ>
              <Champ label="Nom" id="nm"><input id="nm" className="champ" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Champ>
              <Champ label="Catégorie" id="ct"><input id="ct" className="champ" list="cats" value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })} /><datalist id="cats">{data?.categories.map((c) => <option key={c} value={c} />)}</datalist></Champ>
            </div>
            <Champ label="Description" id="ds"><textarea id="ds" rows={3} className="champ" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Champ>
            <div className="grid gap-4 sm:grid-cols-2">
              <Champ label="Prix de confection (FCFA)" id="px"><input id="px" type="number" min="0" className="champ" value={f.prix_confection} onChange={(e) => setF({ ...f, prix_confection: e.target.value })} /></Champ>
              <Champ label="Délai (jours)" id="dl"><input id="dl" type="number" min="1" className="champ" value={f.delai_jours} onChange={(e) => setF({ ...f, delai_jours: e.target.value })} /></Champ>
            </div>
            <div>
              <p className="etiquette">Métrage par taille (m) – laisser vide si taille non proposée</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {TAILLES.map((t) => <label key={t} className="text-xs font-semibold">{t}<input type="number" step="0.5" min="0" className="champ mt-1" value={f.metrages[t] ?? ''} onChange={(e) => setF({ ...f, metrages: { ...f.metrages, [t]: e.target.value === '' ? '' : Number(e.target.value) } })} /></label>)}
              </div>
            </div>
            <div>
              <p className="etiquette">Photos (1 à 4)</p>
              <div className="flex flex-wrap gap-2">
                {f.photos.map((p) => (
                  <div key={p} className="relative"><img src={p} alt="" className="h-24 w-20 rounded-lg object-cover" />
                    <button type="button" aria-label="Retirer" className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-red-700 text-xs text-white" onClick={() => setF({ ...f, photos: f.photos.filter((x) => x !== p) })}>×</button></div>
                ))}
                {f.photos.length < 4 && <label className="flex h-24 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-nuit/20 text-2xl text-nuit/40">+<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files[0] && photo(e.target.files[0])} /></label>}
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-or" checked={f.mis_en_avant} onChange={(e) => setF({ ...f, mis_en_avant: e.target.checked })} /> À la une</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-or" checked={f.actif} onChange={(e) => setF({ ...f, actif: e.target.checked })} /> Visible dans le catalogue</label>
            </div>
            <Erreur erreur={err} />
            <button type="button" className="btn-or w-full" onClick={enregistrer}>ENREGISTRER</button>
          </div>
        )}
      </Modal>
    </>
  );
}
