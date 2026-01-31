import React from 'react';
import { Languages, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';

const LANGUAGES = [
  { section: 'AMERICAS & EUROPE', items: [
    { code: 'en_US', name: 'English (US)', native: 'English (US)' },
    { code: 'es_ES', name: 'Spanish (Spain)', native: 'Español (España)' },
    { code: 'es_MX', name: 'Spanish (Mexico)', native: 'Español (México)' },
    { code: 'pt_BR', name: 'Portuguese (Brazil)', native: 'Português (Brasil)' },
    { code: 'fr_FR', name: 'French (France)', native: 'Français (France)' },
    { code: 'de_DE', name: 'German (Germany)', native: 'Deutsch (Deutschland)' },
    { code: 'it_IT', name: 'Italian (Italy)', native: 'Italiano (Italia)' },
    { code: 'nl_NL', name: 'Dutch (Netherlands)', native: 'Nederlands (Nederland)' },
    { code: 'pl_PL', name: 'Polish (Poland)', native: 'Polski (Polska)' },
    { code: 'ru_RU', name: 'Russian (Russia)', native: 'Русский (Россия)' },
  ]},
  { section: 'ASIAN LANGUAGES', items: [
    { code: 'zh_CN', name: 'Chinese (Simplified)', native: '中文（简体）' },
    { code: 'zh_TW', name: 'Chinese (Traditional)', native: '中文（繁體）' },
    { code: 'ja_JP', name: 'Japanese (Japan)', native: '日本語' },
    { code: 'ko_KR', name: 'Korean (Korea)', native: '한국어' },
    { code: 'vi_VN', name: 'Vietnamese (Vietnam)', native: 'Tiếng Việt' },
    { code: 'th_TH', name: 'Thai (Thailand)', native: 'ไทย' },
  ]},
  { section: 'INDIAN LANGUAGES', items: [
    { code: 'hi_IN', name: 'Hindi (India)', native: 'हिन्दी (भारत)' },
    { code: 'bn_IN', name: 'Bengali (India)', native: 'বাংলা (ভারত)' },
    { code: 'te_IN', name: 'Telugu (India)', native: 'తెలుగు (భారతదేశం)' },
    { code: 'ta_IN', name: 'Tamil (India)', native: 'தமிழ் (இந்தியா)' },
    { code: 'mr_IN', name: 'Marathi (India)', native: 'मराठी (भारत)' },
    { code: 'gu_IN', name: 'Gujarati (India)', native: 'ગુજરાતી (ભારત)' },
  ]},
];

export default function LanguagePage() {
  const { colors } = useTheme();
  const { t, locale, changeLocale } = useTranslation();

  const handleLanguageSelect = (code) => {
    changeLocale(code);
  };

  const currentLanguage = LANGUAGES.flatMap(s => s.items).find(l => l.code === locale)?.native || 'English (US)';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('pages.settings.language') || 'Language'} showUserName={true} />

      <div style={{ padding: '76px 16px 100px', maxWidth: '500px', margin: '0 auto' }}>
        {/* Current Language Card */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Languages size={24} color={colors.primary} />
          <div>
            <span style={{ color: colors.textMuted, fontSize: '14px' }}>
              {t('pages.settings.current_language') || 'Current Language'}:
            </span>
            <p style={{ color: colors.text, fontWeight: 600 }}>
              {currentLanguage}
            </p>
          </div>
        </div>

        {/* Language Sections */}
        {LANGUAGES.map((section) => (
          <div key={section.section} style={{ marginBottom: '24px' }}>
            <h3 style={{
              color: colors.textMuted,
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.5px',
              marginBottom: '8px',
              paddingLeft: '8px'
            }}>
              {section.section}
            </h3>
            <div style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              overflow: 'hidden'
            }}>
              {section.items.map((lang, idx) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageSelect(lang.code)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    backgroundColor: locale === lang.code ? colors.primaryLight : 'transparent',
                    borderBottom: idx < section.items.length - 1 ? `1px solid ${colors.border}` : 'none'
                  }}
                  data-testid={`language-${lang.code}`}
                >
                  <span style={{ color: locale === lang.code ? colors.primary : colors.text }}>
                    {lang.native}
                  </span>
                  {locale === lang.code && <Check size={20} color={colors.primary} />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
