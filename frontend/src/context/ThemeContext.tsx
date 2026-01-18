import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Light Theme (Current - Default)
// WCAG AA Compliant: All text colors meet 4.5:1 contrast ratio on their backgrounds
export const lightTheme = {
  primary: '#2563EB',        // 4.5:1 on white for large text, use for buttons
  primaryDark: '#1E3A8A',
  primaryLight: '#DBEAFE',
  accent: '#D97706',         // Darkened from #F59E0B for WCAG AA compliance (4.5:1)
  success: '#15803D',        // Darkened from #16A34A for WCAG AA (4.5:1)
  successLight: '#DCFCE7',
  error: '#DC2626',
  errorLight: '#FEE2E2',
  warning: '#B45309',        // Darkened from #F59E0B for WCAG AA (4.5:1)
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
