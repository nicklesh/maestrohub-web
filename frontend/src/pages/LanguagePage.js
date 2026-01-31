import React from 'react';
import { ArrowLeft, Languages, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';

const LANGUAGES = [
  { section: 'AMERICAS & EUROPE', items: [
    { code: 'en_US', name: 'English (US)', native: 'English (US)' },
    { code: 'es_ES', name: 'Spanish (Spain)', native: 'Español (España)' },
    { code: 'fr_FR', name: 'French (France)', native: 'Français (France)' },
    { code: 'de_DE', name: 'German (Germany)', native: 'Deutsch (Deutschland)' },
  ]},
  { section: 'INDIAN LANGUAGES', items: [
    { code: 'hi_IN', name: 'Hindi (India)', native: 'हिन्दी (भारत)' },
    { code: 'bn_IN', name: 'Bengali (India)', native: 'বাংলা (ভারত)' },
    { code: 'te_IN', name: 'Telugu (India)', native: 'తెలుగు' },
  ]},
];

export default function LanguagePage() {
  const { colors } = useTheme();
  const { t, locale, changeLocale } = useTranslation();
  const navigate = useNavigate();

  const handleLanguageSelect = (code) => {
    changeLocale(code);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: '16px' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        paddingTop: '8px'
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', padding: '8px' }}>
          <ArrowLeft size={24} color={colors.text} />
        </button>
        <h1 style={{ color: colors.text, fontSize: '20px', fontWeight: 600 }}>
          {t('pages.settings.language')}
        </h1>
      </header>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
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
              {LANGUAGES.flatMap(s => s.items).find(l => l.code === locale)?.native || 'English (US)'}
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
                    padding: '16px',
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
