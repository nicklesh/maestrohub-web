import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/src/context/ThemeContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { useTranslation } from '@/src/i18n';

interface PremiumFeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * A component that gates premium features for free users.
 * Shows children for premium users, shows a locked state or upgrade prompt for free users.
 */
export const PremiumFeatureGate: React.FC<PremiumFeatureGateProps> = ({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}) => {
  const { hasFeature, isPremium, isTrialActive } = useSubscription();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const hasAccess = hasFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  // If fallback provided, show that
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default locked state with upgrade prompt
  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={32} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('subscription.premium_feature')}
      </Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>
        {t('subscription.upgrade_to_unlock')}
      </Text>
      <TouchableOpacity
        style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/subscription')}
      >
        <Text style={styles.upgradeButtonText}>
          {t('subscription.upgrade_now')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * A wrapper that shows a disabled overlay for free users
 */
interface DisabledOverlayProps {
  feature: string;
  children: React.ReactNode;
  message?: string;
}

export const DisabledOverlay: React.FC<DisabledOverlayProps> = ({
  feature,
  children,
  message,
}) => {
  const { hasFeature } = useSubscription();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const hasAccess = hasFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <View style={styles.overlayContainer}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Ionicons name="lock-closed" size={24} color="#fff" />
        <Text style={styles.overlayText}>
          {message || t('subscription.premium_only')}
        </Text>
        <TouchableOpacity
          style={[styles.overlayButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/subscription')}
        >
          <Text style={styles.overlayButtonText}>
            {t('subscription.upgrade')}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.disabledContent} pointerEvents="none">
        {children}
      </View>
    </View>
  );
};

/**
 * Trial banner component showing days remaining
 */
export const TrialBanner: React.FC = () => {
  const { isTrialActive, trialDaysRemaining, isPremium } = useSubscription();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  // Don't show for paying customers or non-trial users
  if (isPremium && !isTrialActive) return null;
  if (!isTrialActive) return null;

  const isExpiringSoon = (trialDaysRemaining || 0) <= 3;

  return (
    <TouchableOpacity
      style={[
        styles.trialBanner,
        {
          backgroundColor: isExpiringSoon ? colors.error : colors.primary,
        },
      ]}
      onPress={() => router.push('/subscription')}
    >
      <Ionicons name="star" size={18} color="#fff" />
      <Text style={styles.trialBannerText}>
        {isExpiringSoon
          ? t('subscription.trial_expiring_soon', { days: trialDaysRemaining })
          : t('subscription.trial_days_remaining', { days: trialDaysRemaining })}
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#fff" />
    </TouchableOpacity>
  );
};

/**
 * Booking limit warning component
 */
export const BookingLimitWarning: React.FC = () => {
  const { isPremium, canBook, bookingsRemaining } = useSubscription();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  // Don't show for premium users
  if (isPremium) return null;

  // Show warning if running low
  if (bookingsRemaining !== null && bookingsRemaining <= 5 && bookingsRemaining > 0) {
    return (
      <TouchableOpacity
        style={[styles.warningBanner, { backgroundColor: colors.warning }]}
        onPress={() => router.push('/subscription')}
      >
        <Ionicons name="warning" size={18} color="#fff" />
        <Text style={styles.warningBannerText}>
          {t('subscription.bookings_remaining', { count: bookingsRemaining })}
        </Text>
      </TouchableOpacity>
    );
  }

  // Show error if no bookings left
  if (!canBook) {
    return (
      <TouchableOpacity
        style={[styles.warningBanner, { backgroundColor: colors.error }]}
        onPress={() => router.push('/subscription')}
      >
        <Ionicons name="close-circle" size={18} color="#fff" />
        <Text style={styles.warningBannerText}>
          {t('subscription.no_bookings_left')}
        </Text>
        <Text style={styles.upgradeLink}>
          {t('subscription.upgrade')}
        </Text>
      </TouchableOpacity>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    margin: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  upgradeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlayContainer: {
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  overlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
  },
  overlayButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  overlayButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledContent: {
    opacity: 0.3,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  trialBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  warningBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  upgradeLink: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default PremiumFeatureGate;
