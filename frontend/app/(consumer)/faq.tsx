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
  // Getting Started
  {
    category: 'Getting Started',
    question: 'How do I create an account?',
    answer: 'To create an account, tap "Sign Up" on the login screen. You can register using your email address or sign in with Google. Choose whether you want to join as a Parent/Student (to find coaches) or as a Coach/Tutor (to offer your services).'
  },
  {
    category: 'Getting Started',
    question: 'How do I find the right coach for me?',
    answer: 'Use the search feature to browse coaches by category, subject, or name. You can filter by availability, price range, and modality (online/in-person). Each coach profile includes their bio, ratings, reviews, and areas of expertise.'
  },
  {
    category: 'Getting Started',
    question: 'Is my personal information secure?',
    answer: 'Yes! We take data security seriously. Your personal information is encrypted and stored securely. We never share your data with third parties without your consent. Review our Privacy Policy for more details.'
  },
  // Booking & Sessions
  {
    category: 'Booking & Sessions',
    question: 'How do I book a session?',
    answer: 'Find a coach you like, view their profile, and tap "Book Session". Select an available time slot from their calendar, confirm the session duration and type, then proceed to payment. You\'ll receive a confirmation once the booking is complete.'
  },
  {
    category: 'Booking & Sessions',
    question: 'Can I reschedule or cancel a session?',
    answer: 'Yes, you can reschedule or cancel sessions from the "My Bookings" section. Please note that cancellation policies vary by coach - check the coach\'s profile for their specific policy. Generally, cancellations made 24+ hours in advance are fully refundable.'
  },
  {
    category: 'Booking & Sessions',
    question: 'What happens if a coach cancels?',
    answer: 'If a coach cancels a session, you\'ll be automatically notified and receive a full refund. You can then rebook with the same coach or find another one. Coaches who cancel frequently may have their accounts reviewed.'
  },
  // Payments & Billing
  {
    category: 'Payments & Billing',
    question: 'What payment methods are accepted?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and debit cards. In some regions, we also support Apple Pay and Google Pay. All payments are processed securely through our payment provider.'
  },
  {
    category: 'Payments & Billing',
    question: 'When am I charged for a session?',
    answer: 'You\'re charged when you book a session. The payment is held securely and released to the coach after the session is completed. If you cancel within the allowed timeframe, you\'ll receive a full refund.'
  },
  {
    category: 'Payments & Billing',
    question: 'How do I view my payment history?',
    answer: 'Go to Account > Reports to view your complete payment history, download invoices, and see upcoming charges. You can filter by date range and export reports as PDF.'
  },
  // For Coaches
  {
    category: 'For Coaches',
    question: 'How do I become a coach on Maestro Habitat?',
    answer: 'From your Parent account, go to Account > "Become a Coach" to start the onboarding process. You\'ll need to create a new account with a different email address, complete your profile, set your availability and pricing, and submit for review.'
  },
  {
    category: 'For Coaches',
    question: 'How do I set my availability?',
    answer: 'Go to the Calendar tab in your coach dashboard. You can set recurring weekly availability (e.g., Mon-Fri 9am-5pm) and block off specific dates for vacations or time off. Your availability updates in real-time for clients.'
  },
  {
    category: 'For Coaches',
    question: 'When and how do I get paid?',
    answer: 'Payments are processed weekly for all completed sessions. Set up your payout method in Account > Billing. You can choose direct deposit to your bank account. Payment processing typically takes 2-3 business days.'
  },
  // Technical Support
  {
    category: 'Technical Support',
    question: 'The app isn\'t working properly. What should I do?',
    answer: 'Try these steps: 1) Close and reopen the app, 2) Check your internet connection, 3) Update to the latest version from the App Store, 4) Log out and log back in. If issues persist, contact us through Account > Contact Us.'
  },
  {
    category: 'Technical Support',
    question: 'How do I update my profile information?',
    answer: 'Go to Account > Edit Profile to update your name, email, profile picture, and other details. For coaches, additional profile settings are available in the Settings tab of your coach dashboard.'
  },
  {
    category: 'Technical Support',
    question: 'How do I contact support?',
    answer: 'You can reach our support team through Account > Contact Us. Fill out the form with your question and we\'ll respond within 24-48 hours. For urgent issues, please include "URGENT" in the subject line.'
  },
];

export default function FAQScreen() {
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
            <Text style={[styles.title, { color: colors.text }]}>Frequently Asked Questions</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Find answers to common questions about Maestro Habitat
            </Text>
          </View>

          {categories.map((category, catIndex) => (
            <View key={catIndex} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Ionicons
                  name={
                    category === 'Getting Started' ? 'rocket-outline' :
                    category === 'Booking & Sessions' ? 'calendar-outline' :
                    category === 'Payments & Billing' ? 'card-outline' :
                    category === 'For Coaches' ? 'school-outline' :
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
              Can't find the answer you're looking for? Please contact our support team.
            </Text>
            <TouchableOpacity style={[styles.contactButton, { backgroundColor: colors.primary }]}>
              <Ionicons name="mail-outline" size={20} color="#FFFFFF" />
              <Text style={styles.contactButtonText}>Contact Support</Text>
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
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
});
