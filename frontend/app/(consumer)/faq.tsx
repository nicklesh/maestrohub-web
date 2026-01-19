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
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export default function FAQScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 800 : isTablet ? 680 : undefined;
  
  const styles = getStyles(colors);

  // FAQ data using translations
  const faqData: FAQItem[] = [
    // Getting Started
    {
      category: t('pages.faq.getting_started'),
      question: t('pages.faq.questions.how_create_account'),
      answer: t('pages.faq.answers.how_create_account')
    },
    {
      category: t('pages.faq.getting_started'),
      question: t('pages.faq.questions.how_find_coach'),
      answer: t('pages.faq.answers.how_find_coach')
    },
    {
      category: t('pages.faq.getting_started'),
      question: t('pages.faq.questions.is_info_secure'),
      answer: t('pages.faq.answers.is_info_secure')
    },
    // Booking & Sessions
    {
      category: t('pages.faq.booking_sessions'),
      question: t('pages.faq.questions.how_book_session'),
      answer: t('pages.faq.answers.how_book_session')
    },
    {
      category: t('pages.faq.booking_sessions'),
      question: t('pages.faq.questions.can_reschedule'),
      answer: t('pages.faq.answers.can_reschedule')
    },
    {
      category: t('pages.faq.booking_sessions'),
      question: t('pages.faq.questions.coach_cancels'),
      answer: t('pages.faq.answers.coach_cancels')
    },
    // Payments & Billing
    {
      category: t('pages.faq.payments_billing'),
      question: t('pages.faq.questions.payment_methods'),
      answer: t('pages.faq.answers.payment_methods')
    },
    {
      category: t('pages.faq.payments_billing'),
      question: t('pages.faq.questions.when_charged'),
      answer: t('pages.faq.answers.when_charged')
    },
    {
      category: t('pages.faq.payments_billing'),
      question: t('pages.faq.questions.view_payment_history'),
      answer: t('pages.faq.answers.view_payment_history')
    },
    // For Coaches
    {
      category: t('pages.faq.for_coaches'),
      question: t('pages.faq.questions.become_coach'),
      answer: t('pages.faq.answers.become_coach')
    },
    {
      category: t('pages.faq.for_coaches'),
      question: t('pages.faq.questions.set_availability'),
      answer: t('pages.faq.answers.set_availability')
    },
    {
      category: t('pages.faq.for_coaches'),
      question: t('pages.faq.questions.when_get_paid'),
      answer: t('pages.faq.answers.when_get_paid')
    },
    // Technical Support
    {
      category: t('pages.faq.technical_support'),
      question: t('pages.faq.questions.app_not_working'),
      answer: t('pages.faq.answers.app_not_working')
    },
    {
      category: t('pages.faq.technical_support'),
      question: t('pages.faq.questions.update_profile'),
      answer: t('pages.faq.answers.update_profile')
    },
    {
      category: t('pages.faq.technical_support'),
      question: t('pages.faq.questions.contact_support'),
      answer: t('pages.faq.answers.contact_support')
    },
  ];

  const categories = [...new Set(faqData.map(item => item.category))];

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const getCategoryIcon = (category: string): string => {
    if (category === t('pages.faq.getting_started')) return 'rocket-outline';
    if (category === t('pages.faq.booking_sessions')) return 'calendar-outline';
    if (category === t('pages.faq.payments_billing')) return 'card-outline';
    if (category === t('pages.faq.for_coaches')) return 'school-outline';
    if (category === t('pages.faq.technical_support')) return 'settings-outline';
    return 'help-circle-outline';
  };

  const renderFAQItem = (item: FAQItem, index: number) => {
    const isExpanded = expandedIndex === index;
    
    return (
      <TouchableOpacity
        key={index}
        style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
        onPress={() => toggleExpand(index)}
        activeOpacity={0.7}
      >
        <View style={styles.questionRow}>
          <Text style={[styles.question, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
            {item.question}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.primary}
          />
        </View>
        {isExpanded && (
          <Text style={[styles.answer, { color: colors.textMuted }]}>
            {item.answer}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t('navigation.help_center')} showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{t('pages.faq.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('pages.faq.subtitle')}
            </Text>
          </View>

          {categories.map((category, catIndex) => (
            <View key={catIndex} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Ionicons
                  name={getCategoryIcon(category) as any}
                  size={24}
                  color={colors.primary}
                />
                <Text style={[styles.categoryTitle, { color: colors.text }]}>{category}</Text>
              </View>
              {faqData
                .filter(item => item.category === category)
                .map((item, index) => renderFAQItem(item, faqData.indexOf(item)))
              }
            </View>
          ))}

          {/* Still have questions section */}
          <View style={[styles.contactSection, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.primary} />
            <Text style={[styles.contactTitle, { color: colors.text }]}>
              {t('pages.faq.still_have_questions')}
            </Text>
            <Text style={[styles.contactSubtitle, { color: colors.textMuted }]}>
              {t('pages.faq.contact_support')}
            </Text>
            <TouchableOpacity style={[styles.contactButton, { backgroundColor: colors.primary }]}>
              <Text style={styles.contactButtonText}>{t('pages.faq.contact_us')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  faqItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  faqItemExpanded: {
    borderColor: colors.primary,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  answer: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactSection: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  contactSubtitle: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  contactButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
