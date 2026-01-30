import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const getDeviceInfo = () => {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('device_id', deviceId);
  }
  
  return {
    device_id: deviceId,
    device_name: navigator.userAgent.substring(0, 50),
    platform: 'web',
    model: navigator.platform,
    os_version: navigator.appVersion?.substring(0, 50),
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
    handleWebAuthCallback();
  }, []);

  const handleWebAuthCallback = async () => {
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    
    let sessionId = searchParams.get('session_id');
    if (!sessionId && hash) {
      const hashParams = new URLSearchParams(hash.replace('#', ''));
      sessionId = hashParams.get('session_id');
    }
    
    if (sessionId) {
      try {
        setLoading(true);
        const device = getDeviceInfo();
        const response = await api.post('/auth/google/callback', {
          session_id: sessionId,
          device,
        });
        
        await saveAuth(response.data.token, response.data.role);
        window.history.replaceState(null, '', '/');
        window.location.href = '/';
      } catch (error) {
        console.error('Google auth callback failed:', error);
        window.history.replaceState(null, '', window.location.pathname);
      } finally {
        setLoading(false);
      }
    }
  };

  const loadStoredAuth = async () => {
    try {
      const storedToken = localStorage.getItem('auth_token');
      
      if (storedToken) {
        setToken(storedToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        
        const response = await api.get('/auth/me');
        setUser(response.data);
      }
    } catch (error) {
      console.log('Clearing expired auth session');
      await clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const saveAuth = async (newToken, role) => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    const response = await api.get('/auth/me');
    setUser(response.data);
  };

  const clearAuth = async () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  const login = async (email, password) => {
    const device = getDeviceInfo();
    const response = await api.post('/auth/login', { email, password, device });
    await saveAuth(response.data.token, response.data.role);
    return response.data;
  };

  const register = async (email, password, name, role) => {
    const device = getDeviceInfo();
    const response = await api.post('/auth/register', { email, password, name, role, device });
    return response.data;
  };

  const loginWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    window.location.href = authUrl;
  };

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
    }
    await clearAuth();
    sessionStorage.clear();
    window.location.href = '/login';
  }, []);

  const updateRole = async (role) => {
    await api.put(`/auth/role?new_role=${role}`);
    if (user) {
      setUser({ ...user, role });
    }
  };

  const refreshUser = async () => {
    const response = await api.get('/auth/me');
    setUser(response.data);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        loginWithGoogle,
        logout,
        updateRole,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
