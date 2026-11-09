import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [chargement, setChargement] = useState(Boolean(getToken()));

  const deconnexion = useCallback(() => { setToken(null); setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(deconnexion);
    if (!getToken()) return;
    api('/auth/me').then(setUser).catch(deconnexion).finally(() => setChargement(false));
  }, [deconnexion]);

  const connexion = useCallback(async (email, mot_de_passe) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, mot_de_passe } });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const inscription = useCallback(async (data) => {
    const r = await api('/auth/register', { method: 'POST', body: data });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const value = useMemo(() => ({ user, setUser, chargement, connexion, inscription, deconnexion }), [user, chargement, connexion, inscription, deconnexion]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
