import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../services/api';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'consumer' | 'tutor' | 'admin';
}

interface DeviceInfo {
  device_id: string;
  device_name?: string;
  platform?: string;
  model?: string;
  os_version?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const getDeviceInfo = async (): Promise<DeviceInfo> => {
  let deviceId = '';
  
  if (Platform.OS === 'web') {
    // For web, generate a unique ID and store it
    const storedId = localStorage.getItem('device_id');
    if (storedId) {
      deviceId = storedId;
    } else {
      deviceId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('device_id', deviceId);
    }
  } else {
    // For native, use Application.getIosIdForVendorAsync or Android ID
    try {
      if (Platform.OS === 'ios') {
        deviceId = await Application.getIosIdForVendorAsync() || `ios_${Date.now()}`;
      } else {
        deviceId = Application.androidId || `android_${Date.now()}`;
      }
    } catch {
      deviceId = `device_${Date.now()}`;
    }
  }
  
  return {
    device_id: deviceId,
    device_name: Device.deviceName || 'Unknown Device',
    platform: Platform.OS,
    model: Device.modelName || undefined,
    os_version: Device.osVersion || undefined,
  };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
    // Handle deep links for OAuth callback
    if (Platform.OS === 'web') {
      handleWebAuthCallback();
    }
  }, []);

  const handleWebAuthCallback = async () => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.replace('#', ''));
      const sessionId = params.get('session_id');
      
      if (sessionId) {
        try {
          const device = await getDeviceInfo();
          const response = await api.post('/auth/google/callback', {
            session_id: sessionId,
            device,
          });
          
          await saveAuth(response.data.token, response.data.role);
          // Clean URL
          window.history.replaceState(null, '', window.location.pathname);
        } catch (error) {
          console.error('Google auth callback failed:', error);
        }
      }
    }
  };

  const loadStoredAuth = async () => {
    try {
      let storedToken: string | null = null;
      
      if (Platform.OS === 'web') {
        storedToken = localStorage.getItem('auth_token');
      } else {
        storedToken = await SecureStore.getItemAsync('auth_token');
      }
      
      if (storedToken) {
        setToken(storedToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        
        // Fetch current user
        const response = await api.get('/auth/me');
        setUser(response.data);
      }
    } catch (error) {
      // Silent handling - old/invalid tokens are expected, just clear them
      console.log('Clearing expired auth session');
      // Clear invalid token
      await clearAuth();
    } finally {
      setLoading(false);
    }
  };

  const saveAuth = async (newToken: string, role: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem('auth_token', newToken);
    } else {
      await SecureStore.setItemAsync('auth_token', newToken);
    }
    
    setToken(newToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    
    // Fetch user data
    const response = await api.get('/auth/me');
    setUser(response.data);
  };

  const clearAuth = async () => {
    if (Platform.OS === 'web') {
      localStorage.removeItem('auth_token');
    } else {
      await SecureStore.deleteItemAsync('auth_token');
    }
    
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
  };

  const login = async (email: string, password: string) => {
    const device = await getDeviceInfo();
    const response = await api.post('/auth/login', { email, password, device });
    await saveAuth(response.data.token, response.data.role);
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    const device = await getDeviceInfo();
    const response = await api.post('/auth/register', { email, password, name, role, device });
    await saveAuth(response.data.token, response.data.role);
  };

  const loginWithGoogle = async () => {
    const redirectUrl = Platform.OS === 'web'
      ? `${window.location.origin}/`
      : Linking.createURL('/');
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const sessionId = url.hash?.split('session_id=')[1] || url.searchParams.get('session_id');
        
        if (sessionId) {
          const device = await getDeviceInfo();
          const response = await api.post('/auth/google/callback', {
            session_id: sessionId,
            device,
          });
          await saveAuth(response.data.token, response.data.role);
        }
      }
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
    }
    await clearAuth();
    
    // On web, force a full page reload to clear any cached state
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Clear any cached data
      sessionStorage.clear();
      // Redirect to login with a clean state
      window.location.href = '/';
    }
  };

  const updateRole = async (role: string) => {
    await api.put(`/auth/role?new_role=${role}`);
    if (user) {
      setUser({ ...user, role: role as User['role'] });
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
