import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation, getLocaleList, LocaleCode } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';

export default function LanguageSettingsScreen() {
  const { colors } = useTheme();
  const { showSuccess } = useToast();
  const { t, locale, setLocale, localeName } = useTranslation();
  const { width } = useWindowDimensions();
  const [changingTo, setChangingTo] = useState<string | null>(null);
  
  const isTablet = width >= 768;
  const locales = getLocaleList();

  const handleLocaleChange = async (code: LocaleCode) => {
    if (code === locale) return;
    
    setChangingTo(code);
    try {
      await setLocale(code);
      showSuccess(t('messages.success.settings_saved'));
    } catch (error) {
      console.error('Failed to change language:', error);
    } finally {
      setChangingTo(null);
    }
  };

  // Group locales by region
  const europeanLocales = locales.filter(l => ['en_US', 'es_ES', 'fr_FR', 'de_DE'].includes(l.code));
  const indianLocales = locales.filter(l => l.code.endsWith('_IN'));
  const middleEasternLocales = locales.filter(l => ['ar_SA', 'he_IL'].includes(l.code));
  const asianLocales = locales.filter(l => ['zh_CN', 'zh_SG', 'ja_JP', 'ko_KR'].includes(l.code));

  const renderLocaleItem = (item: typeof locales[0]) => {
    const isSelected = item.code === locale;
    
    return (
      <TouchableOpacity
        key={item.code}
        style={[
          styles.localeItem,
          { 
            backgroundColor: isSelected ? colors.primaryLight : colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
          }
        ]}
        onPress={() => handleLocaleChange(item.code)}
        disabled={changingTo !== null}
      >
        <View style={styles.localeInfo}>
          <Text style={[styles.localeName, { color: colors.text }]}>
            {item.nativeName}
          </Text>
          <Text style={[styles.localeEnglishName, { color: colors.textMuted }]}>
            {item.name}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
        )}
        {item.rtl && (
          <View style={[styles.rtlBadge, { backgroundColor: colors.gray200 }]}>
            <Text style={[styles.rtlText, { color: colors.textMuted }]}>RTL</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSection = (title: string, items: typeof locales) => {
    if (items.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          {title}
        </Text>
        <View style={styles.localesGrid}>
          {items.map(renderLocaleItem)}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title={t('pages.settings.language')} />
      
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentTablet,
        ]}
      >
        <View style={[styles.content, isTablet && { maxWidth: 600, alignSelf: 'center' }]}>
          {/* Current Language Info */}
          <View style={[styles.currentLang, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="language" size={24} color={colors.primary} />
            <View style={styles.currentLangInfo}>
              <Text style={[styles.currentLangLabel, { color: colors.textMuted }]}>
                Current Language
              </Text>
              <Text style={[styles.currentLangName, { color: colors.text }]}>
                {localeName}
              </Text>
            </View>
          </View>

          {/* Language Sections */}
          {renderSection('Americas & Europe', europeanLocales)}
          {renderSection('Indian Languages', indianLocales)}
          {renderSection('Middle East', middleEasternLocales)}
          {renderSection('East Asia', asianLocales)}

          {/* Note about translations */}
          <View style={[styles.note, { backgroundColor: colors.gray100 }]}>
            <Ionicons name="information-circle" size={20} color={colors.textMuted} />
            <Text style={[styles.noteText, { color: colors.textMuted }]}>
              Some translations may be incomplete. Help us improve by suggesting translations!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    padding: 24,
  },
  content: {
    width: '100%',
  },
  currentLang: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  currentLangInfo: {
    flex: 1,
  },
  currentLangLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  currentLangName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  localesGrid: {
    gap: 8,
  },
  localeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  localeInfo: {
    flex: 1,
  },
  localeName: {
    fontSize: 16,
    fontWeight: '600',
  },
  localeEnglishName: {
    fontSize: 13,
    marginTop: 2,
  },
  rtlBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rtlText: {
    fontSize: 10,
    fontWeight: '600',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    gap: 10,
    marginTop: 16,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
