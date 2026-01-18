import React, { createContext, useContext, useMemo } from 'react';

/**
 * App Configuration Context
 * Centralizes all branding, theme colors, and app settings
 * All values are driven by environment variables for easy customization
 */

export interface AppConfig {
  // Branding
  appName: string;
  tagline: string;
  logoLight: string;
  logoDark: string;
  
  // Theme Colors
  theme: {
    primary: string;
    primaryLight: string;
    success: string;
    successLight: string;
    error: string;
    errorLight: string;
    warning: string;
    warningLight: string;
  };
  
  // Contact Info
  supportEmail: string;
  adminEmail: string;
}

// Default values (used as fallback if env vars not set)
const DEFAULT_CONFIG: AppConfig = {
  appName: process.env.EXPO_PUBLIC_APP_NAME || 'Maestro Habitat',
  tagline: process.env.EXPO_PUBLIC_APP_TAGLINE || 'Find the coach. Master your learning.',
  logoLight: process.env.EXPO_PUBLIC_LOGO_LIGHT || '/assets/images/mh_logo_dark_trimmed.png',
  logoDark: process.env.EXPO_PUBLIC_LOGO_DARK || '/assets/images/mh_logo_light_trimmed.png',
  
  theme: {
    primary: process.env.EXPO_PUBLIC_THEME_PRIMARY || '#2563EB',
    primaryLight: process.env.EXPO_PUBLIC_THEME_PRIMARY_LIGHT || '#DBEAFE',
    success: process.env.EXPO_PUBLIC_THEME_SUCCESS || '#10B981',
    successLight: process.env.EXPO_PUBLIC_THEME_SUCCESS_LIGHT || '#D1FAE5',
    error: process.env.EXPO_PUBLIC_THEME_ERROR || '#EF4444',
    errorLight: process.env.EXPO_PUBLIC_THEME_ERROR_LIGHT || '#FEE2E2',
    warning: process.env.EXPO_PUBLIC_THEME_WARNING || '#F59E0B',
    warningLight: process.env.EXPO_PUBLIC_THEME_WARNING_LIGHT || '#FEF3C7',
  },
  
  supportEmail: 'support@maestrohabitat.com',
  adminEmail: 'admin@maestrohabitat.com',
};

const AppConfigContext = createContext<AppConfig>(DEFAULT_CONFIG);

export const useAppConfig = () => useContext(AppConfigContext);

export const AppConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const config = useMemo(() => DEFAULT_CONFIG, []);
  
  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
};

// Export individual getters for use outside of React components
export const getAppName = () => DEFAULT_CONFIG.appName;
export const getTagline = () => DEFAULT_CONFIG.tagline;
export const getLogoLight = () => DEFAULT_CONFIG.logoLight;
export const getLogoDark = () => DEFAULT_CONFIG.logoDark;
export const getThemeColors = () => DEFAULT_CONFIG.theme;
export const getSupportEmail = () => DEFAULT_CONFIG.supportEmail;
export const getAdminEmail = () => DEFAULT_CONFIG.adminEmail;

export default AppConfigProvider;
