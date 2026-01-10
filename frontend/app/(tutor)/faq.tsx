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
import AppHeader from '@/src/components/AppHeader';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqData: FAQItem[] = [
  // Getting Started as a Tutor
  {
    category: 'Getting Started',
    question: 'How do I set up my tutor profile?',
    answer: 'Go to Settings > Complete Profile. Fill in your bio, select your teaching categories and subjects, set your levels, choose your modality (online/in-person), and set your hourly rate. Your profile will be reviewed by our team before going live.'
  },
  {
    category: 'Getting Started',
    question: 'How long does profile approval take?',
    answer: 'Most profiles are reviewed within 24-48 hours. You\'ll receive a notification once your profile is approved. If we need additional information, we\'ll reach out via email.'
  },
  {
    category: 'Getting Started',
    question: 'Can I update my profile after it\'s approved?',
    answer: 'Yes! You can update your bio, subjects, levels, and pricing at any time from the Settings page. Changes take effect immediately.'
  },
  // Managing Availability
  {
    category: 'Managing Availability',
    question: 'How do I set my availability?',
    answer: 'Go to the Calendar tab and tap on any date to add time slots. You can set recurring weekly availability or block specific dates for vacations. Students will only see times you\'ve marked as available.'
  },
  {
    category: 'Managing Availability',
    question: 'How do I block time off for vacation?',
    answer: 'In the Calendar tab, tap "Add Vacation" and select your start and end dates. All bookings during this period will be automatically blocked. Remember to plan ahead - you can\'t block dates that already have confirmed bookings.'
  },
  {
    category: 'Managing Availability',
    question: 'What happens if I need to cancel a session?',
    answer: 'Go to the Bookings tab, find the session, and tap "Cancel". Students will be notified automatically. Note: Frequent cancellations may affect your profile rating and visibility in search results.'
  },
  // Bookings & Sessions
  {
    category: 'Bookings & Sessions',
    question: 'How do I view my upcoming sessions?',
    answer: 'Your Dashboard shows upcoming sessions at a glance. For a complete list, go to the Bookings tab where you can filter by status (upcoming, completed, canceled).'
  },
  {
    category: 'Bookings & Sessions',
    question: 'How do I conduct an online session?',
    answer: 'For online sessions, you\'ll receive a video call link 30 minutes before the scheduled time. Make sure you have a stable internet connection and a quiet environment. You can also use your own preferred video platform by sharing the link with the student.'
  },
  {
    category: 'Bookings & Sessions',
    question: 'What if a student doesn\'t show up?',
    answer: 'Wait 15 minutes, then mark the session as a no-show in the Bookings tab. You\'ll still receive payment according to your no-show policy. The student will be notified and charged.'
  },
  // Payments & Earnings
  {
    category: 'Payments & Earnings',
    question: 'When do I get paid?',
    answer: 'Payments are processed weekly on Fridays for all completed sessions from the previous week. Funds typically arrive in your bank account within 2-3 business days after processing.'
  },
  {
    category: 'Payments & Earnings',
    question: 'How do I view my earnings?',
    answer: 'Go to the Reports tab to see your earnings summary, including total earnings, completed sessions, and payment history. You can also download PDF reports for your records.'
  },
  {
    category: 'Payments & Earnings',
    question: 'What fees does Maestro Hub charge?',
    answer: 'Maestro Hub charges a 15% service fee on each completed session. This covers payment processing, platform maintenance, customer support, and marketing to bring you students.'
  },
  // Account & Support
  {
    category: 'Account & Support',
    question: 'How do I change my payout information?',
    answer: 'Go to Settings > Billing to update your bank account or payment details. Changes take effect on the next payment cycle.'
  },
  {
    category: 'Account & Support',
    question: 'How do I contact support?',
    answer: 'Tap the Contact Us option in Settings or email us at support@maestrohub.com. We aim to respond within 24 hours. For urgent issues, please include "URGENT" in your message.'
  },
  {
    category: 'Account & Support',
    question: 'How do I deactivate my tutor account?',
    answer: 'Contact support to request account deactivation. You\'ll need to complete all pending sessions and have no outstanding earnings before deactivation. You can reactivate at any time by contacting support.'
  },
];

export default function TutorFAQScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 800 : isTablet ? 680 : undefined;
  
  const styles = getStyles(colors);

  const categories = [...new Set(faqData.map(item => item.category))];

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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
      <AppHeader title="Help Center" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Tutor FAQ</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Find answers to common questions about tutoring on Maestro Hub
            </Text>
          </View>

          {categories.map((category, catIndex) => (
            <View key={catIndex} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Ionicons
                  name={
                    category === 'Getting Started' ? 'rocket-outline' :
                    category === 'Managing Availability' ? 'calendar-outline' :
                    category === 'Bookings & Sessions' ? 'book-outline' :
                    category === 'Payments & Earnings' ? 'cash-outline' :
                    'help-circle-outline'
                  }
                  size={24}
                  color={colors.primary}
                />
                <Text style={[styles.categoryTitle, { color: colors.text }]}>{category}</Text>
              </View>
              {faqData
                .filter(item => item.category === category)
                .map((item, index) => {
                  const globalIndex = faqData.findIndex(
                    f => f.question === item.question && f.category === item.category
                  );
                  return renderFAQItem(item, globalIndex);
                })}
            </View>
          ))}

          <View style={styles.contactSection}>
            <Text style={[styles.contactTitle, { color: colors.text }]}>
              Still have questions?
            </Text>
            <Text style={[styles.contactText, { color: colors.textMuted }]}>
              Can't find the answer you're looking for? Our support team is here to help.
            </Text>
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
    paddingBottom: 40,
  },
  contentWrapper: {
    width: '100%',
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 4,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  question: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  answer: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  contactSection: {
    alignItems: 'center',
    padding: 24,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
