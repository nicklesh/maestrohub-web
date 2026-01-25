import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;

  const {
    subscription,
    plans,
    freeTier,
    trialDays,
    loading,
    isPremium,
    isTrialActive,
    trialDaysRemaining,
    subscribe,
    cancelSubscription,
    reactivateSubscription,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<string>('yearly');
  const [processing, setProcessing] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('stripe');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const paymentMethods = [
    { id: 'stripe', name: 'Credit Card', icon: 'card-outline' },
    { id: 'google_pay', name: 'Google Pay', icon: 'logo-google' },
    { id: 'apple_pay', name: 'Apple Pay', icon: 'logo-apple' },
    { id: 'venmo', name: 'Venmo', icon: 'wallet-outline' },
    { id: 'zelle', name: 'Zelle', icon: 'cash-outline' },
  ];

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    setProcessing(true);
    try {
      const success = await subscribe(selectedPlan, selectedPaymentMethod);
      if (success) {
        Alert.alert(
          t('subscription.success_title'),
          t('subscription.success_message'),
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(t('subscription.error_title'), t('subscription.error_message'));
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    setShowCancelConfirm(true);
  };

  const performCancel = async () => {
    setShowCancelConfirm(false);
    setProcessing(true);
    try {
      const success = await cancelSubscription();
      if (success) {
        if (Platform.OS === 'web') {
          window.alert(t('subscription.cancelled_message'));
        } else {
          Alert.alert(t('subscription.cancelled_title'), t('subscription.cancelled_message'));
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert('Failed to cancel subscription');
        } else {
          Alert.alert(t('subscription.error_title'), 'Failed to cancel subscription');
        }
      }
    } catch (error) {
      console.error('Cancel error:', error);
      if (Platform.OS === 'web') {
        window.alert('An error occurred');
      } else {
        Alert.alert(t('subscription.error_title'), 'An error occurred');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setProcessing(true);
    try {
      const success = await reactivateSubscription();
      if (success) {
        Alert.alert(t('subscription.reactivated_title'), t('subscription.reactivated_message'));
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title={t('subscription.title')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const monthlyPlan = plans.find(p => p.interval === 'month');
  const yearlyPlan = plans.find(p => p.interval === 'year');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title={t('subscription.title')} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined
        ]}
      >
        {/* Current Status */}
        {subscription && (
          <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.statusHeader}>
              <Ionicons 
                name={isPremium ? 'star' : 'person'} 
                size={24} 
                color={isPremium ? colors.warning : colors.textMuted} 
              />
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                {isPremium 
                  ? (isTrialActive ? t('subscription.trial_active') : t('subscription.premium_active'))
                  : t('subscription.free_plan')}
              </Text>
            </View>
            
            {isTrialActive && trialDaysRemaining !== null && (
              <Text style={[styles.statusSubtext, { color: colors.warning }]}>
                {t('subscription.trial_days_remaining', { days: trialDaysRemaining })}
              </Text>
            )}
            
            {subscription.current_period_end && !isTrialActive && isPremium && (
              <Text style={[styles.statusSubtext, { color: colors.textMuted }]}>
                {subscription.cancel_at_period_end
                  ? t('subscription.cancels_on', { date: new Date(subscription.current_period_end).toLocaleDateString() })
                  : t('subscription.renews_on', { date: new Date(subscription.current_period_end).toLocaleDateString() })}
              </Text>
            )}
            
            {subscription.cancel_at_period_end && (
              <TouchableOpacity
                style={[styles.reactivateButton, { backgroundColor: colors.primary }]}
                onPress={handleReactivate}
                disabled={processing}
              >
                <Text style={styles.reactivateButtonText}>{t('subscription.reactivate')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Plan Selection (only for non-premium or trial users) */}
        {(!isPremium || isTrialActive) && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('subscription.choose_plan')}
            </Text>

            {/* Yearly Plan */}
            {yearlyPlan && (
              <TouchableOpacity
                style={[
                  styles.planCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: selectedPlan === 'yearly' ? colors.primary : colors.border,
                    borderWidth: selectedPlan === 'yearly' ? 2 : 1,
                  }
                ]}
                onPress={() => setSelectedPlan('yearly')}
              >
                <View style={[styles.bestValueBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.bestValueText}>{t('subscription.best_value')}</Text>
                </View>
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, { color: colors.text }]}>{yearlyPlan.name}</Text>
                  <View style={styles.radioOuter}>
                    {selectedPlan === 'yearly' && (
                      <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                </View>
                <Text style={[styles.planPrice, { color: colors.text }]}>{yearlyPlan.price_display}</Text>
                {yearlyPlan.savings && (
                  <Text style={[styles.savings, { color: colors.success }]}>{yearlyPlan.savings}</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Monthly Plan */}
            {monthlyPlan && (
              <TouchableOpacity
                style={[
                  styles.planCard,
                  { 
                    backgroundColor: colors.surface, 
                    borderColor: selectedPlan === 'monthly' ? colors.primary : colors.border,
                    borderWidth: selectedPlan === 'monthly' ? 2 : 1,
                  }
                ]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, { color: colors.text }]}>{monthlyPlan.name}</Text>
                  <View style={styles.radioOuter}>
                    {selectedPlan === 'monthly' && (
                      <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                    )}
                  </View>
                </View>
                <Text style={[styles.planPrice, { color: colors.text }]}>{monthlyPlan.price_display}</Text>
              </TouchableOpacity>
            )}

            {/* Payment Method Selection */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
              {t('subscription.payment_method')}
            </Text>
            
            <View style={styles.paymentMethods}>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.paymentMethod,
                    { 
                      backgroundColor: colors.surface, 
                      borderColor: selectedPaymentMethod === method.id ? colors.primary : colors.border,
                      borderWidth: selectedPaymentMethod === method.id ? 2 : 1,
                    }
                  ]}
                  onPress={() => setSelectedPaymentMethod(method.id)}
                >
                  <Ionicons name={method.icon as any} size={20} color={colors.text} />
                  <Text style={[styles.paymentMethodText, { color: colors.text }]}>{method.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subscribe Button */}
            <TouchableOpacity
              style={[styles.subscribeButton, { backgroundColor: colors.primary, opacity: processing ? 0.7 : 1 }]}
              onPress={handleSubscribe}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.subscribeButtonText}>
                  {t('subscription.subscribe_now')}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* Features List */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
          {t('subscription.premium_features')}
        </Text>

        <View style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            { icon: 'infinite', text: t('subscription.feature_unlimited_bookings') },
            { icon: 'people', text: t('subscription.feature_all_coaches') },
            { icon: 'videocam', text: t('subscription.feature_video_recordings') },
            { icon: 'bar-chart', text: t('subscription.feature_reports') },
            { icon: 'receipt', text: t('subscription.feature_billing') },
            { icon: 'notifications', text: t('subscription.feature_notifications') },
            { icon: 'alarm', text: t('subscription.feature_reminders') },
            { icon: 'star', text: t('subscription.feature_reviews') },
            { icon: 'ban', text: t('subscription.feature_ad_free') },
          ].map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons name={feature.icon as any} size={20} color={colors.primary} />
              <Text style={[styles.featureText, { color: colors.text }]}>{feature.text}</Text>
            </View>
          ))}
        </View>

        {/* Cancel Subscription (for active subscribers) */}
        {isPremium && !isTrialActive && !subscription?.cancel_at_period_end && (
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.error }]}
            onPress={handleCancel}
            disabled={processing}
          >
            <Text style={[styles.cancelButtonText, { color: colors.error }]}>
              {t('subscription.cancel_subscription')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Free Tier Info */}
        {freeTier && (
          <View style={[styles.freeTierInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.freeTierTitle, { color: colors.text }]}>
              {t('subscription.free_tier_info')}
            </Text>
            <Text style={[styles.freeTierText, { color: colors.textMuted }]}>
              • {t('subscription.free_bookings_limit', { count: freeTier.bookings_per_month })}
            </Text>
            <Text style={[styles.freeTierText, { color: colors.textMuted }]}>
              • {t('subscription.free_coaches_limit', { count: freeTier.coaches_visible })}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Cancel Confirmation Modal */}
      <Modal visible={showCancelConfirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>
              {t('subscription.cancel_confirm_title')}
            </Text>
            <Text style={[styles.confirmMessage, { color: colors.textMuted }]}>
              {t('subscription.cancel_confirm_message')}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setShowCancelConfirm(false)}
              >
                <Text style={[styles.confirmButtonText, { color: colors.text }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.error }]}
                onPress={performCancel}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.confirmButtonText, { color: '#fff' }]}>
                    {t('subscription.cancel_subscription')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  statusCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusSubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  reactivateButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reactivateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  planCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
  },
  bestValueText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  savings: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 8,
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '500',
  },
  subscribeButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  featuresCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    flex: 1,
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  freeTierInfo: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 24,
    marginBottom: 32,
  },
  freeTierTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  freeTierText: {
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  confirmModal: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
