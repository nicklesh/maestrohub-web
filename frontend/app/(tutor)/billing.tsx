import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { useMarket } from '@/src/context/MarketContext';

interface BillingSummary {
  trial_status: string;
  trial_days_remaining: number;
  pending_fees_cents: number;
  total_earnings: number;
  completed_lessons: number;
  fee_events: FeeEvent[];
  currency?: string;
  currency_symbol?: string;
}

interface FeeEvent {
  event_id: string;
  event_type: string;
  amount_cents: number;
  status: string;
  created_at: string;
}

export default function BillingScreen() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { market } = useMarket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<BillingSummary | null>(null);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 720 : isTablet ? 600 : undefined;

  const currencySymbol = market?.currency_symbol || summary?.currency_symbol || '$';

  useEffect(() => {
    loadBilling();
  }, []);

  const loadBilling = async () => {
    try {
      const response = await api.get('/billing/summary');
      setSummary(response.data);
    } catch (error) {
      console.error('Failed to load billing:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBilling();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Billing</Text>
            <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>Scheduling, enrollment, and payments for tutors.</Text>
          </View>

          {/* Trial Status */}
          {summary?.trial_status === 'active' && (
            <View style={[styles.trialCard, isTablet && styles.trialCardTablet]}>
              <Ionicons name="gift" size={isTablet ? 28 : 24} color={colors.success} />
              <View style={styles.trialInfo}>
                <Text style={[styles.trialTitle, isDesktop && styles.trialTitleDesktop]}>Free Trial Active</Text>
                <Text style={styles.trialText}>
                  {summary.trial_days_remaining} days remaining
                </Text>
              </View>
            </View>
          )}

          {/* Earnings Summary */}
          <View style={[styles.earningsCard, isTablet && styles.earningsCardTablet]}>
            <Text style={styles.cardTitle}>Total Earnings</Text>
            <Text style={[styles.earningsAmount, isDesktop && styles.earningsAmountDesktop]}>{summary?.currency_symbol || '$'}{summary?.total_earnings || 0}</Text>
            <Text style={[styles.earningsSubtext, isDesktop && styles.earningsSubtextDesktop]}>
              from {summary?.completed_lessons || 0} completed lessons
            </Text>
          </View>

          {/* Pending Fees */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitleText, { marginBottom: 0 }]}>Platform Fees</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, isDesktop && styles.feeLabelDesktop]}>Pending Fees</Text>
              <Text style={[styles.feeValue, isDesktop && styles.feeValueDesktop]}>
                {summary?.currency_symbol || '$'}{((summary?.pending_fees_cents || 0) / 100).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.feeNote}>
              Fees are automatically deducted from your payouts.
            </Text>
          </View>

          {/* Fee Events */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <Text style={[styles.cardTitleText, isDesktop && styles.cardTitleDesktop]}>Recent Fee Activity</Text>
            {summary?.fee_events?.length === 0 ? (
              <Text style={styles.emptyText}>No fee activity yet</Text>
            ) : (
              summary?.fee_events?.map((event) => (
                <View key={event.event_id} style={[styles.eventItem, isTablet && styles.eventItemTablet]}>
                  <View style={styles.eventInfo}>
                    <Text style={[styles.eventType, isDesktop && styles.eventTypeDesktop]}>{event.event_type}</Text>
                    <Text style={styles.eventStatus}>{event.status}</Text>
                  </View>
                  <Text style={[styles.eventAmount, isDesktop && styles.eventAmountDesktop]}>
                    {summary?.currency_symbol || '$'}{(event.amount_cents / 100).toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Payment Methods */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitleText, { marginBottom: 0 }]}>Payout Account</Text>
            </View>
            <TouchableOpacity style={[styles.setupButton, isTablet && styles.setupButtonTablet]}>
              <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.setupButtonText, isTablet && styles.setupButtonTextTablet]}>Connect Stripe Account</Text>
            </TouchableOpacity>
            <Text style={styles.stripeNote}>
              Stripe Connect integration coming soon. Payouts will be processed automatically.
            </Text>
          </View>

          {/* Sponsorship Promo Banner */}
          <TouchableOpacity 
            style={[styles.sponsorPromo, isTablet && styles.sponsorPromoTablet]}
            onPress={() => router.push('/(tutor)/sponsorship')}
            activeOpacity={0.85}
          >
            <View style={styles.sponsorPromoInner}>
              <View style={styles.sponsorPromoHeader}>
                <View style={styles.sponsorPromoIconWrap}>
                  <Ionicons name="star" size={24} color="#FFD700" />
                </View>
                <View style={styles.sponsorPromoTextWrap}>
                  <Text style={[styles.sponsorPromoTitle, isTablet && styles.sponsorPromoTitleTablet]}>
                    Want More Bookings?
                  </Text>
                  <Text style={styles.sponsorPromoSubtitle}>
                    Get featured at the top of search results
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.8)" />
              </View>
              <View style={styles.sponsorPromoBenefits}>
                <View style={styles.sponsorBenefit}>
                  <Ionicons name="trending-up" size={16} color="#FFD700" />
                  <Text style={styles.sponsorBenefitText}>3x more visibility</Text>
                </View>
                <View style={styles.sponsorBenefit}>
                  <Ionicons name="eye" size={16} color="#FFD700" />
                  <Text style={styles.sponsorBenefitText}>Top search placement</Text>
                </View>
                <View style={styles.sponsorBenefit}>
                  <Ionicons name="pricetag" size={16} color="#FFD700" />
                  <Text style={styles.sponsorBenefitText}>Just $15/week</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  scrollContentTablet: {
    padding: 32,
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
    color: colors.text,
  },
  titleDesktop: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  subtitleDesktop: {
    fontSize: 16,
  },
  trialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  trialCardTablet: {
    borderRadius: 20,
    padding: 20,
  },
  trialInfo: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
  },
  trialTitleDesktop: {
    fontSize: 18,
  },
  trialText: {
    fontSize: 14,
    color: colors.success,
  },
  earningsCard: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  earningsCardTablet: {
    borderRadius: 20,
    padding: 32,
  },
  cardTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  earningsAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 8,
  },
  earningsAmountDesktop: {
    fontSize: 48,
  },
  earningsSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  earningsSubtextDesktop: {
    fontSize: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTablet: {
    borderRadius: 20,
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  cardTitleDesktop: {
    fontSize: 18,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feeLabel: {
    fontSize: 14,
    color: colors.text,
  },
  feeLabelDesktop: {
    fontSize: 16,
  },
  feeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  feeValueDesktop: {
    fontSize: 18,
  },
  feeNote: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  eventItemTablet: {
    paddingVertical: 16,
  },
  eventInfo: {
    flex: 1,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  eventTypeDesktop: {
    fontSize: 16,
  },
  eventStatus: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  eventAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  eventAmountDesktop: {
    fontSize: 16,
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
  },
  setupButtonTablet: {
    padding: 18,
    borderRadius: 14,
  },
  setupButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  setupButtonTextTablet: {
    fontSize: 17,
  },
  stripeNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  // Sponsorship Promo Styles
  sponsorPromo: {
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sponsorPromoTablet: {
    borderRadius: 20,
  },
  sponsorPromoInner: {
    backgroundColor: colors.primary,
    padding: 16,
  },
  sponsorPromoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sponsorPromoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sponsorPromoTextWrap: {
    flex: 1,
  },
  sponsorPromoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sponsorPromoTitleTablet: {
    fontSize: 18,
  },
  sponsorPromoSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  sponsorPromoBenefits: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  sponsorBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sponsorBenefitText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
  },
});
