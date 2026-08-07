import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { clearAccessToken } from '@/lib/tokenStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // There is no access token in memory on a fresh page load by design (see
  // tokenStore.js). Try a silent refresh using the httpOnly admin refresh
  // cookie; if that succeeds, load the admin profile to restore the session.
  const loadProfile = useCallback(async () => {
    try {
      const refreshed = await api.refreshToken();
      if (!refreshed) {
        setAdmin(null);
        return;
      }
      const response = await api.getProfile();
      setAdmin(response.data.admin);
    } catch (error) {
      clearAccessToken();
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const login = async (email, password) => {
    const response = await api.login(email, password); // api.login() already stores the access token in memory
    const { admin: adminData } = response.data;
    setAdmin(adminData);
    return adminData;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore logout errors
    }
    setAdmin(null);
  };

  const refreshProfile = async () => {
    try {
      const response = await api.getProfile();
      setAdmin(response.data.admin);
    } catch (e) {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
