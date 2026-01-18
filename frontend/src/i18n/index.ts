import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import locale files
import en_US from './locales/en_US.json';

// Supported locales
export const SUPPORTED_LOCALES = {
  'en_US': { name: 'English (US)', data: en_US },
  // Future locales:
  // 'en_UK': { name: 'English (UK)', data: en_UK },
  // 'es_ES': { name: 'Spanish (Spain)', data: es_ES },
  // 'es_MX': { name: 'Spanish (Mexico)', data: es_MX },
  // 'hi_IN': { name: 'Hindi (India)', data: hi_IN },
} as const;

export type LocaleCode = keyof typeof SUPPORTED_LOCALES;
export type TranslationData = typeof en_US;

const DEFAULT_LOCALE: LocaleCode = 'en_US';
const STORAGE_KEY = '@maestro_locale';

// Helper to get nested value from object using dot notation
const getNestedValue = (obj: any, path: string): string => {
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      console.warn(`Translation key not found: ${path}`);
      return path; // Return the key if not found
    }
  }
  
  return typeof value === 'string' ? value : path;
};

// Helper to replace placeholders like {name} with values
const interpolate = (text: string, params?: Record<string, string | number>): string => {
  if (!params) return text;
  
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key]?.toString() ?? match;
  });
};

interface I18nContextType {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  translations: TranslationData;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};

// Standalone translation function for use outside React components
let currentTranslations: TranslationData = en_US;

export const t = (key: string, params?: Record<string, string | number>): string => {
  const text = getNestedValue(currentTranslations, key);
  return interpolate(text, params);
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [translations, setTranslations] = useState<TranslationData>(en_US);

  // Load saved locale on mount
  useEffect(() => {
    const loadLocale = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedLocale && savedLocale in SUPPORTED_LOCALES) {
          const localeCode = savedLocale as LocaleCode;
          setLocaleState(localeCode);
          const data = SUPPORTED_LOCALES[localeCode].data;
          setTranslations(data);
          currentTranslations = data;
        }
      } catch (error) {
        console.error('Failed to load locale:', error);
      }
    };
    loadLocale();
  }, []);

  const setLocale = useCallback(async (newLocale: LocaleCode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLocale);
      setLocaleState(newLocale);
      const data = SUPPORTED_LOCALES[newLocale].data;
      setTranslations(data);
      currentTranslations = data;
    } catch (error) {
      console.error('Failed to save locale:', error);
    }
  }, []);

  const translate = useCallback((key: string, params?: Record<string, string | number>): string => {
    const text = getNestedValue(translations, key);
    return interpolate(text, params);
  }, [translations]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: translate, translations }}>
      {children}
    </I18nContext.Provider>
  );
};

export default I18nProvider;
