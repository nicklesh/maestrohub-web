import React, { createContext, useContext, useState } from 'react';
import enUS from './locales/en_US.json';

const translations = {
  en_US: enUS,
};

const I18nContext = createContext(null);

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
};

export const I18nProvider = ({ children }) => {
  const [locale, setLocale] = useState('en_US');

  const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = translations[locale];
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k];
      } else {
        return key;
      }
    }
    
    if (typeof value !== 'string') {
      return key;
    }
    
    // Replace {{param}} with actual values
    Object.keys(params).forEach((param) => {
      value = value.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
      value = value.replace(new RegExp(`{${param}}`, 'g'), params[param]);
    });
    
    return value;
  };

  const changeLocale = (newLocale) => {
    if (translations[newLocale]) {
      setLocale(newLocale);
      localStorage.setItem('locale', newLocale);
    }
  };

  // Format number based on locale
  const formatNumber = (num) => {
    if (num === null || num === undefined) return '';
    return new Intl.NumberFormat(locale.replace('_', '-')).format(num);
  };

  return (
    <I18nContext.Provider value={{ t, locale, changeLocale, formatNumber }}>
      {children}
    </I18nContext.Provider>
  );
};

export default I18nContext;
