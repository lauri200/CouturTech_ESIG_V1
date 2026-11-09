import { useState } from 'react';
import { api, televerserImage } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { date, fcfa } from '../../lib/format';
import { Champ, EnTete, Erreur, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

const VIDE = { nom: '', type: '', couleur: '', photo_url: '', prix_metre: '', stock_metres: '', seuil_alerte: '', actif: true };

export default function GestionTissus() {
  const { data, erreur, recharger } = useApi('/tissus?tous=1');
  const toast = useToast();
  const [f, setF] = useState(null);
  const [mv, setMv] = useState(null);
  const [hist, setHist] = useState(null);
  const [err, setErr] = useState(null);
  const enregistrer = async () => {
    try {
      const body = { ...f, prix_metre: Number(f.prix_metre), seuil_alerte: Number(f.seuil_alerte), stock_metres: Number(f.stock_metres) || 0 };
      await api(f.id ? `/tissus/${f.id}` : '/tissus', { method: f.id ? 'PUT' : 'POST', body });
      setF(null); toast('Tissu enregistré.'); recharger();
    } catch (e) { setErr(e); }
  };
  const mouvement = async () => {
    try {
      await api(`/tissus/${mv.tissu.id}/mouvements`, { method: 'POST', body: { type: mv.type, metres: Number(mv.metres), motif: mv.motif } });
      setMv(null); toast('Stock mis à jour.'); recharger();
    } catch (e) { setErr(e); }
  };
  const voirHist = async (t) => setHist({ t, items: await api(`/tissus/${t.id}/mouvements`) });
  if (erreur) return <Erreur erreur={erreur} onRetry={recharger} />;
  return (
    <>
      <EnTete titre="Tissus et stock" sousTitre="Le stock est déduit automatiquement à chaque commande" actions={<button type="button" className="btn-or" onClick={() => { setErr(null); setF(VIDE); }}>+ NOUVEAU TISSU</button>} />
      {!data ? <Spinner /> : (
        <div className="carte overflow-x-auto">
          <table className="tableau">
            <thead><tr><th>Tissu</th><th>Type</th><th>Prix / m</th><th>Stock</th><th>Seuil</th><th /></tr></thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id} className={t.actif ? '' : 'opacity-50'}>
                  <td><div className="flex items-center gap-3">{t.photo_url && <img src={t.photo_url} alt="" className="h-10 w-10 rounded object-cover" />}<span className="font-medium">{t.nom}</span></div></td>
                  <td>{t.type}</td><td className="whitespace-nowrap">{fcfa(t.prix_metre)}</td>
                  <td className={`whitespace-nowrap font-semibold ${t.stock_bas ? 'text-red-700' : ''}`}>{t.stock_metres} m{t.stock_bas && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs">STOCK BAS</span>}</td>
                  <td>{t.seuil_alerte} m</td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" className="btn-lien mr-3" onClick={() => { setErr(null); setMv({ tissu: t, type: 'ENTREE', metres: '', motif: 'Réception fournisseur' }); }}>Stock</button>
                    <button type="button" className="btn-lien mr-3" onClick={() => voirHist(t)}>Historique</button>
                    <button type="button" className="btn-lien" onClick={() => { setErr(null); setF({ ...t, photo_url: t.photo_url || '' }); }}>Modifier</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal ouvert={Boolean(f)} titre={f?.id ? 'Modifier le tissu' : 'Nouveau tissu'} onFermer={() => setF(null)}>
        {f && (
          <div className="space-y-4">
            <Champ label="Nom" id="n"><input id="n" className="champ" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Champ>
            <div className="grid grid-cols-2 gap-4">
              <Champ label="Type" id="ty"><input id="ty" className="champ" list="types" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} /><datalist id="types">{data?.types.map((x) => <option key={x} value={x} />)}</datalist></Champ>
              <Champ label="Couleur" id="co"><input id="co" className="champ" value={f.couleur} onChange={(e) => setF({ ...f, couleur: e.target.value })} /></Champ>
              <Champ label="Prix / m (FCFA)" id="pm"><input id="pm" type="number" min="0" className="champ" value={f.prix_metre} onChange={(e) => setF({ ...f, prix_metre: e.target.value })} /></Champ>
              <Champ label="Seuil d’alerte (m)" id="sa"><input id="sa" type="number" min="0" className="champ" value={f.seuil_alerte} onChange={(e) => setF({ ...f, seuil_alerte: e.target.value })} /></Champ>
              {!f.id && <Champ label="Stock initial (m)" id="si"><input id="si" type="number" min="0" className="champ" value={f.stock_metres} onChange={(e) => setF({ ...f, stock_metres: e.target.value })} /></Champ>}
            </div>
            <Champ label="Photo" id="ph">
              <div className="flex items-center gap-3">{f.photo_url && <img src={f.photo_url} alt="" className="h-14 w-14 rounded object-cover" />}
                <input id="ph" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={async (e) => { try { const r = await televerserImage(e.target.files[0]); setF((x) => ({ ...x, photo_url: r.url })); } catch (ex) { setErr(ex); } }} /></div>
            </Champ>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-or" checked={f.actif} onChange={(e) => setF({ ...f, actif: e.target.checked })} /> Proposé aux clients</label>
            <Erreur erreur={err} />
            <button type="button" className="btn-or w-full" onClick={enregistrer}>ENREGISTRER</button>
          </div>
        )}
      </Modal>
      <Modal ouvert={Boolean(mv)} titre={`Stock : ${mv?.tissu.nom || ''}`} onFermer={() => setMv(null)}>
        {mv && (
          <div className="space-y-4">
            <p className="text-sm">Stock actuel : <strong>{mv.tissu.stock_metres} m</strong></p>
            <Champ label="Type" id="tm"><select id="tm" className="champ" value={mv.type} onChange={(e) => setMv({ ...mv, type: e.target.value })}><option value="ENTREE">Entrée (réception)</option><option value="AJUSTEMENT">Ajustement (+/−)</option></select></Champ>
            <Champ label="Mètres" id="me" aide={mv.type === 'AJUSTEMENT' ? 'Négatif pour retirer' : ''}><input id="me" type="number" step="0.5" className="champ" value={mv.metres} onChange={(e) => setMv({ ...mv, metres: e.target.value })} /></Champ>
            <Champ label="Motif" id="mo"><input id="mo" className="champ" value={mv.motif} onChange={(e) => setMv({ ...mv, motif: e.target.value })} /></Champ>
            <Erreur erreur={err} />
            <button type="button" className="btn-or w-full" onClick={mouvement}>ENREGISTRER</button>
          </div>
        )}
      </Modal>
      <Modal ouvert={Boolean(hist)} titre={`Mouvements : ${hist?.t.nom || ''}`} onFermer={() => setHist(null)} large>
        <div className="overflow-x-auto"><table className="tableau"><thead><tr><th>Date</th><th>Type</th><th>Mètres</th><th>Motif</th></tr></thead>
          <tbody>{hist?.items.map((m) => <tr key={m.id}><td className="whitespace-nowrap">{date(m.created_at, true)}</td><td>{m.type}</td><td className={m.metres < 0 ? 'text-red-700' : 'text-emerald-700'}>{m.metres > 0 ? '+' : ''}{m.metres}</td><td>{m.motif}</td></tr>)}</tbody></table></div>
      </Modal>
    </>
  );
}
