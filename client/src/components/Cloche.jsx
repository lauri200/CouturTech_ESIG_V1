import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { date } from '../lib/format';

export default function Cloche({ lienCommande }) {
  const [data, setData] = useState({ items: [], non_lues: 0 });
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let actif = true;
    const charger = () => api('/notifications').then((d) => actif && setData(d)).catch(() => {});
    charger();
    const t = setInterval(charger, 60000);
    return () => { actif = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    const f = (e) => ref.current && !ref.current.contains(e.target) && setOuvert(false);
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);

  const basculer = async () => {
    setOuvert((o) => !o);
    if (!ouvert && data.non_lues > 0) {
      await api('/notifications/lire', { method: 'PATCH' }).catch(() => {});
      setData((d) => ({ ...d, non_lues: 0 }));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={basculer} className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-nuit/5" aria-label={`Notifications (${data.non_lues} non lues)`}>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {data.non_lues > 0 && <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-terre px-1 text-[10px] font-bold text-white">{data.non_lues}</span>}
      </button>
      {ouvert && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-nuit/10 bg-white shadow-xl">
          <p className="border-b border-nuit/10 px-4 py-3 text-sm font-semibold">Notifications</p>
          <ul className="max-h-96 overflow-y-auto">
            {data.items.length === 0 && <li className="px-4 py-6 text-center text-sm text-nuit/60">Aucune notification.</li>}
            {data.items.map((n) => (
              <li key={n.id} className={`border-b border-nuit/5 px-4 py-3 text-sm ${n.lue ? '' : 'bg-or-50'}`}>
                {n.commande_id && lienCommande ? (
                  <Link to={lienCommande(n.commande_id)} onClick={() => setOuvert(false)} className="block hover:text-or-600">{n.contenu}</Link>
                ) : <p>{n.contenu}</p>}
                <p className="mt-1 text-xs text-nuit/50">{date(n.created_at, true)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
