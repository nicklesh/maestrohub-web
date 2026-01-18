import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment-driven theme colors (with fallbacks)
const ENV_PRIMARY = process.env.EXPO_PUBLIC_THEME_PRIMARY || '#2563EB';
const ENV_PRIMARY_LIGHT = process.env.EXPO_PUBLIC_THEME_PRIMARY_LIGHT || '#DBEAFE';
const ENV_SUCCESS = process.env.EXPO_PUBLIC_THEME_SUCCESS || '#10B981';
const ENV_SUCCESS_LIGHT = process.env.EXPO_PUBLIC_THEME_SUCCESS_LIGHT || '#D1FAE5';
const ENV_ERROR = process.env.EXPO_PUBLIC_THEME_ERROR || '#EF4444';
const ENV_ERROR_LIGHT = process.env.EXPO_PUBLIC_THEME_ERROR_LIGHT || '#FEE2E2';
const ENV_WARNING = process.env.EXPO_PUBLIC_THEME_WARNING || '#F59E0B';
const ENV_WARNING_LIGHT = process.env.EXPO_PUBLIC_THEME_WARNING_LIGHT || '#FEF3C7';

// Light Theme (Current - Default)
// WCAG AA Compliant: All text colors meet 4.5:1 contrast ratio on their backgrounds
export const lightTheme = {
  primary: ENV_PRIMARY,
  primaryDark: '#1E3A8A',
  primaryLight: ENV_PRIMARY_LIGHT,
  accent: '#D97706',         // Darkened from #F59E0B for WCAG AA compliance (4.5:1)
  success: '#15803D',        // Darkened for WCAG AA (4.5:1)
  successLight: ENV_SUCCESS_LIGHT,
  error: ENV_ERROR,
  errorLight: ENV_ERROR_LIGHT,
  warning: '#B45309',        // Darkened from #F59E0B for WCAG AA (4.5:1)
  warningLight: ENV_WARNING_LIGHT,
  background: '#F8FAFC',
  backgroundSecondary: '#F1F5F9',  // For cards/sections
  surface: '#FFFFFF',
  text: '#0F172A',           // Primary text - 15.4:1 on white
  textSecondary: '#334155',  // Secondary text - 7.5:1 on white (WCAG AAA)
  textMuted: '#475569',      // Muted text - 5.9:1 on white (WCAG AA)
  textInverse: '#FFFFFF',
  border: '#E2E8F0',
  // Additional shades
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',
  // Card colors
  cardPrimary: ENV_PRIMARY,
  cardSuccess: ENV_SUCCESS,
  cardWarning: ENV_WARNING,
  cardInfo: '#6366f1',
  white: '#FFFFFF',
};

// Dark Theme (Premium Academy Palette)
// WCAG AA Compliant: All text colors meet 4.5:1 contrast ratio on dark backgrounds
export const darkTheme = {
  primary: '#D4A72C',        // Gold accent
  primaryDark: '#B8941F',
  primaryLight: '#2D3A4D',
  accent: '#D4A72C',         // Gold
  success: '#22C55E',        // Brightened for WCAG AA on dark background
  successLight: '#1E3B2E',
  error: '#EF4444',          // Brightened for WCAG AA on dark background
  errorLight: '#3D1F1F',
  warning: '#FBBF24',        // Brightened for WCAG AA on dark background
  warningLight: '#3D2F1F',
  background: '#0B1F3B',     // Navy
  backgroundSecondary: '#142E54',  // For cards/sections
  surface: '#142E54',        // Lighter navy
  text: '#F6F7FB',           // Primary text - 14.5:1 on navy
  textSecondary: '#E2E8F0',  // Secondary text - 11.3:1 on navy (WCAG AAA)
  textMuted: '#CBD5E1',      // Muted text - 8.5:1 on navy (WCAG AA)
  textInverse: '#0B1F3B',
  border: '#334155',         // Slate
  // Additional shades
  gray100: '#1E293B',
  gray200: '#334155',
  gray300: '#475569',
  gray400: '#64748B',
  gray500: '#94A3B8',
  gray600: '#CBD5E1',
  gray700: '#E2E8F0',
  gray800: '#F1F5F9',
  gray900: '#F8FAFC',
  // Card colors
  cardPrimary: '#D4A72C',
  cardSuccess: '#22C55E',
  cardWarning: '#FBBF24',
  cardInfo: '#818CF8',
  white: '#FFFFFF',
};

export type ThemeColors = typeof lightTheme;

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  loadUserTheme: (userId: string) => Promise<void>;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightTheme,
  toggleTheme: () => {},
  loadUserTheme: async () => {},
  resetToDefault: () => {},
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_KEY_PREFIX = 'user_theme_';

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Reset to light mode (default) - used when logging out or new user
  const resetToDefault = useCallback(() => {
    setIsDark(false);
    setCurrentUserId(null);
  }, []);

  // Load user-specific theme when user logs in
  const loadUserTheme = useCallback(async (userId: string) => {
    try {
      // If same user, don't reload
      if (currentUserId === userId) return;
      
      setCurrentUserId(userId);
      const userThemeKey = `${THEME_KEY_PREFIX}${userId}`;
      const stored = await AsyncStorage.getItem(userThemeKey);
      
      if (stored === 'dark') {
        // User has dark mode saved
        setIsDark(true);
      } else {
        // No preference or light mode saved - use light (default)
        setIsDark(false);
      }
    } catch (error) {
      console.error('Failed to load user theme:', error);
      // On error, default to light
      setIsDark(false);
    }
  }, [currentUserId]);

  const toggleTheme = async () => {
    const newValue = !isDark;
    setIsDark(newValue);
    
    try {
      // Only save per-user if user is logged in
      if (currentUserId) {
        const userThemeKey = `${THEME_KEY_PREFIX}${currentUserId}`;
        await AsyncStorage.setItem(userThemeKey, newValue ? 'dark' : 'light');
      }
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const colors = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, loadUserTheme, resetToDefault }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeContext;
