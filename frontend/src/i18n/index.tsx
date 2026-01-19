import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatLocalizedDate, toLocalizedNumber, formatLocalizedCurrency } from '@/src/utils/dateLocalization';

// Import locale files
import en_US from './locales/en_US.json';
import es_ES from './locales/es_ES.json';
import fr_FR from './locales/fr_FR.json';
import hi_IN from './locales/hi_IN.json';
import te_IN from './locales/te_IN.json';
import ta_IN from './locales/ta_IN.json';
import mr_IN from './locales/mr_IN.json';
import gu_IN from './locales/gu_IN.json';
import pa_IN from './locales/pa_IN.json';
import kn_IN from './locales/kn_IN.json';
import ml_IN from './locales/ml_IN.json';
import de_DE from './locales/de_DE.json';
import ar_SA from './locales/ar_SA.json';
import he_IL from './locales/he_IL.json';
import zh_CN from './locales/zh_CN.json';
import zh_SG from './locales/zh_SG.json';
import ja_JP from './locales/ja_JP.json';
import ko_KR from './locales/ko_KR.json';
import ru_RU from './locales/ru_RU.json';
import bn_IN from './locales/bn_IN.json';
import ur_PK from './locales/ur_PK.json';
import pt_BR from './locales/pt_BR.json';

// Supported locales with metadata
export const SUPPORTED_LOCALES = {
  'en_US': { name: 'English (US)', nativeName: 'English (US)', data: en_US, rtl: false },
  'es_ES': { name: 'Spanish (Spain)', nativeName: 'Español (España)', data: es_ES, rtl: false },
  'fr_FR': { name: 'French (France)', nativeName: 'Français (France)', data: fr_FR, rtl: false },
  'de_DE': { name: 'German (Germany)', nativeName: 'Deutsch (Deutschland)', data: de_DE, rtl: false },
  'pt_BR': { name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', data: pt_BR, rtl: false },
  'ru_RU': { name: 'Russian (Russia)', nativeName: 'Русский (Россия)', data: ru_RU, rtl: false },
  'hi_IN': { name: 'Hindi (India)', nativeName: 'हिन्दी (भारत)', data: hi_IN, rtl: false },
  'bn_IN': { name: 'Bengali (India)', nativeName: 'বাংলা (ভারত)', data: bn_IN, rtl: false },
  'te_IN': { name: 'Telugu (India)', nativeName: 'తెలుగు (భారతదేశం)', data: te_IN, rtl: false },
  'ta_IN': { name: 'Tamil (India)', nativeName: 'தமிழ் (இந்தியா)', data: ta_IN, rtl: false },
  'mr_IN': { name: 'Marathi (India)', nativeName: 'मराठी (भारत)', data: mr_IN, rtl: false },
  'gu_IN': { name: 'Gujarati (India)', nativeName: 'ગુજરાતી (ભારત)', data: gu_IN, rtl: false },
  'pa_IN': { name: 'Punjabi (India)', nativeName: 'ਪੰਜਾਬੀ (ਭਾਰਤ)', data: pa_IN, rtl: false },
  'kn_IN': { name: 'Kannada (India)', nativeName: 'ಕನ್ನಡ (ಭಾರತ)', data: kn_IN, rtl: false },
  'ml_IN': { name: 'Malayalam (India)', nativeName: 'മലയാളം (ഇന്ത്യ)', data: ml_IN, rtl: false },
  'ur_PK': { name: 'Urdu (Pakistan)', nativeName: 'اردو (پاکستان)', data: ur_PK, rtl: true },
  'ar_SA': { name: 'Arabic (Saudi Arabia)', nativeName: 'العربية (السعودية)', data: ar_SA, rtl: true },
  'he_IL': { name: 'Hebrew (Israel)', nativeName: 'עברית (ישראל)', data: he_IL, rtl: true },
  'zh_CN': { name: 'Chinese (Simplified)', nativeName: '简体中文 (中国)', data: zh_CN, rtl: false },
  'zh_SG': { name: 'Chinese (Singapore)', nativeName: '简体中文 (新加坡)', data: zh_SG, rtl: false },
  'ja_JP': { name: 'Japanese (Japan)', nativeName: '日本語 (日本)', data: ja_JP, rtl: false },
  'ko_KR': { name: 'Korean (South Korea)', nativeName: '한국어 (대한민국)', data: ko_KR, rtl: false },
} as const;

export type LocaleCode = keyof typeof SUPPORTED_LOCALES;
export type TranslationData = typeof en_US;

// Get list of locales for UI
export const getLocaleList = () => {
  return Object.entries(SUPPORTED_LOCALES).map(([code, info]) => ({
    code: code as LocaleCode,
    name: info.name,
    nativeName: info.nativeName,
    rtl: info.rtl,
  }));
};

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
      // Don't log warning for every missing key in non-English locales
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
  isRTL: boolean;
  localeName: string;
  formatDate: (date: Date | string, formatStr: string) => string;
  formatNumber: (num: number | string) => string;
  formatCurrency: (amount: number, currencySymbol?: string) => string;
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
  const [isRTL, setIsRTL] = useState(false);
  const [localeName, setLocaleName] = useState('English (US)');

  // Load saved locale on mount
  useEffect(() => {
    const loadLocale = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedLocale && savedLocale in SUPPORTED_LOCALES) {
          const localeCode = savedLocale as LocaleCode;
          const localeInfo = SUPPORTED_LOCALES[localeCode];
          setLocaleState(localeCode);
          setTranslations(localeInfo.data);
          setIsRTL(localeInfo.rtl);
          setLocaleName(localeInfo.nativeName);
          currentTranslations = localeInfo.data;
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
      const localeInfo = SUPPORTED_LOCALES[newLocale];
      setLocaleState(newLocale);
      setTranslations(localeInfo.data);
      setIsRTL(localeInfo.rtl);
      setLocaleName(localeInfo.nativeName);
      currentTranslations = localeInfo.data;
    } catch (error) {
      console.error('Failed to save locale:', error);
    }
  }, []);

  const translate = useCallback((key: string, params?: Record<string, string | number>): string => {
    const text = getNestedValue(translations, key);
    return interpolate(text, params);
  }, [translations]);

  // Localized date formatting
  const formatDate = useCallback((date: Date | string, formatStr: string): string => {
    return formatLocalizedDate(date, formatStr, locale);
  }, [locale]);

  // Localized number formatting
  const formatNumber = useCallback((num: number | string): string => {
    return toLocalizedNumber(num, locale);
  }, [locale]);

  // Localized currency formatting
  const formatCurrencyFn = useCallback((amount: number, currencySymbol = '$'): string => {
    return formatLocalizedCurrency(amount, locale, currencySymbol);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ 
      locale, 
      setLocale, 
      t: translate, 
      translations, 
      isRTL, 
      localeName,
      formatDate,
      formatNumber,
      formatCurrency: formatCurrencyFn,
    }}>
      {children}
    </I18nContext.Provider>
  );
};

export default I18nProvider;
