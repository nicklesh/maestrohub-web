import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const lightTheme = {
  primary: '#2563EB',
  primaryDark: '#1E3A8A',
  primaryLight: '#DBEAFE',
  accent: '#D97706',
  success: '#15803D',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#B45309',
  warningLight: '#FEF3C7',
  background: '#F8FAFC',
  backgroundSecondary: '#F1F5F9',
  surface: '#FFFFFF',
  text: '#1A4582',
  textSecondary: '#1A4582',
  textMuted: '#475569',
  textInverse: '#FFFFFF',
  border: '#E2E8F0',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',
  white: '#FFFFFF',
};

const darkTheme = {
  primary: '#D4A72C',
  primaryDark: '#B8941F',
  primaryLight: '#2D3A4D',
  accent: '#D4A72C',
  success: '#22C55E',
  successLight: '#1E3B2E',
  error: '#EF4444',
  errorLight: '#3D1F1F',
  warning: '#FBBF24',
  warningLight: '#3D2F1F',
  background: '#0B1F3B',
  backgroundSecondary: '#142E54',
  surface: '#142E54',
  text: '#F6F7FB',
  textSecondary: '#E2E8F0',
  textMuted: '#CBD5E1',
  textInverse: '#0B1F3B',
  border: '#334155',
  gray100: '#1E293B',
  gray200: '#334155',
  gray300: '#475569',
  gray400: '#64748B',
  gray500: '#94A3B8',
  gray600: '#CBD5E1',
  gray700: '#E2E8F0',
  gray800: '#F1F5F9',
  gray900: '#F8FAFC',
  white: '#FFFFFF',
};

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const resetToDefault = useCallback(() => {
    setIsDark(false);
    setCurrentUserId(null);
  }, []);

  const loadUserTheme = useCallback((userId) => {
    if (currentUserId === userId) return;
    
    setCurrentUserId(userId);
    const stored = localStorage.getItem(`user_theme_${userId}`);
    
    if (stored === 'dark') {
      setIsDark(true);
    } else {
      setIsDark(false);
    }
  }, [currentUserId]);

  const toggleTheme = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    
    if (currentUserId) {
      localStorage.setItem(`user_theme_${currentUserId}`, newValue ? 'dark' : 'light');
    }
  };

  const colors = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, loadUserTheme, resetToDefault }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
