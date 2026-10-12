import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearToken, getToken, setToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setReady(true);
        return;
      }
      try {
        const me = await api('/auth/me');
        setUser(me.user);
        setRole(me.role);
      } catch {
        clearToken();
        setUser(null);
        setRole(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = useCallback((payload) => {
    setToken(payload.token);
    setUser(payload.user);
    setRole(payload.role);
    return payload;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setRole(null);
  }, []);

  const refresh = useCallback(async () => {
    const me = await api('/auth/me');
    setUser(me.user);
    setRole(me.role);
    return me;
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, ready, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
