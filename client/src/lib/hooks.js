import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export function useApi(path, deps = []) {
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);
  const recharger = useCallback(async () => {
    if (!path) return;
    setChargement(true);
    try {
      setData(await api(path));
      setErreur(null);
    } catch (e) {
      setErreur(e);
    } finally {
      setChargement(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { recharger(); }, [recharger]);
  return { data, setData, erreur, chargement, recharger };
}
