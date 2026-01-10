import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Light Theme (Current - Default)
export const lightTheme = {
  primary: '#2563EB',
  primaryDark: '#1E3A8A',
  primaryLight: '#DBEAFE',
  accent: '#F59E0B',
  success: '#16A34A',
  successLight: '#DCFCE7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
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
  cardPrimary: '#2563EB',
  cardSuccess: '#10b981',
  cardWarning: '#f59e0b',
  cardInfo: '#6366f1',
  white: '#FFFFFF',
};

// Dark Theme (Premium Academy Palette)
export const darkTheme = {
  primary: '#D4A72C', // Gold accent
  primaryDark: '#B8941F',
  primaryLight: '#2D3A4D',
  accent: '#D4A72C', // Gold
  success: '#16A34A',
  successLight: '#1E3B2E',
  error: '#DC2626',
  errorLight: '#3D1F1F',
  warning: '#F59E0B',
  background: '#0B1F3B', // Navy
  surface: '#142E54', // Lighter navy
  text: '#F6F7FB',
  textMuted: '#94A3B8',
  textInverse: '#0B1F3B',
  border: '#334155', // Slate
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
  cardSuccess: '#16A34A',
  cardWarning: '#f59e0b',
  cardInfo: '#6366f1',
  white: '#FFFFFF',
};

export type ThemeColors = typeof lightTheme;

interface ThemeContextType {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  loadUserTheme: (userId: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: lightTheme,
  toggleTheme: () => {},
  loadUserTheme: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_KEY_PREFIX = 'theme_preference_';
const GLOBAL_THEME_KEY = 'theme_preference';

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load global theme preference on mount (for logged-out state)
  useEffect(() => {
    loadGlobalTheme();
  }, []);

  const loadGlobalTheme = async () => {
    try {
      const stored = await AsyncStorage.getItem(GLOBAL_THEME_KEY);
      if (stored === 'dark') {
        setIsDark(true);
      }
    } catch (error) {
      console.error('Failed to load global theme:', error);
    }
  };

  // Load user-specific theme when user logs in
  const loadUserTheme = useCallback(async (userId: string) => {
    try {
      setCurrentUserId(userId);
      const userThemeKey = `${THEME_KEY_PREFIX}${userId}`;
      const stored = await AsyncStorage.getItem(userThemeKey);
      
      if (stored !== null) {
        // User has a saved preference
        setIsDark(stored === 'dark');
      }
      // If no user preference, keep current theme (from global or default)
    } catch (error) {
      console.error('Failed to load user theme:', error);
    }
  }, []);

  const toggleTheme = async () => {
    const newValue = !isDark;
    setIsDark(newValue);
    
    try {
      // Always save globally for logged-out state
      await AsyncStorage.setItem(GLOBAL_THEME_KEY, newValue ? 'dark' : 'light');
      
      // If user is logged in, also save per-user
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
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme, loadUserTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeContext;
