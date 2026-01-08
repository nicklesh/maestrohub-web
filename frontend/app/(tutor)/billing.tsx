import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';

interface BillingSummary {
  trial_status: string;
  trial_days_remaining: number;
  pending_fees_cents: number;
  total_earnings: number;
  completed_lessons: number;
  fee_events: FeeEvent[];
}

interface FeeEvent {
  event_id: string;
  event_type: string;
  amount_cents: number;
  status: string;
  created_at: string;
}

export default function BillingScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<BillingSummary | null>(null);

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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Billing</Text>
          <Text style={styles.subtitle}>Scheduling, enrollment, and payments for tutors.</Text>
        </View>

        {/* Trial Status */}
        {summary?.trial_status === 'active' && (
          <View style={styles.trialCard}>
            <Ionicons name="gift" size={24} color={colors.success} />
            <View style={styles.trialInfo}>
              <Text style={styles.trialTitle}>Free Trial Active</Text>
              <Text style={styles.trialText}>
                {summary.trial_days_remaining} days remaining
              </Text>
            </View>
          </View>
        )}

        {/* Earnings Summary */}
        <View style={styles.earningsCard}>
          <Text style={styles.cardTitle}>Total Earnings</Text>
          <Text style={styles.earningsAmount}>${summary?.total_earnings || 0}</Text>
          <Text style={styles.earningsSubtext}>
            from {summary?.completed_lessons || 0} completed lessons
          </Text>
        </View>

        {/* Pending Fees */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Platform Fees</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Pending Fees</Text>
            <Text style={styles.feeValue}>
              ${((summary?.pending_fees_cents || 0) / 100).toFixed(2)}
            </Text>
          </View>
          <Text style={styles.feeNote}>
            Fees are automatically deducted from your payouts.
          </Text>
        </View>

        {/* Fee Events */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Fee Activity</Text>
          {summary?.fee_events?.length === 0 ? (
            <Text style={styles.emptyText}>No fee activity yet</Text>
          ) : (
            summary?.fee_events?.map((event) => (
              <View key={event.event_id} style={styles.eventItem}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventType}>{event.event_type}</Text>
                  <Text style={styles.eventStatus}>{event.status}</Text>
                </View>
                <Text style={styles.eventAmount}>
                  ${(event.amount_cents / 100).toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Payout Account</Text>
          </View>
          <TouchableOpacity style={styles.setupButton}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.setupButtonText}>Connect Stripe Account</Text>
          </TouchableOpacity>
          <Text style={styles.stripeNote}>
            Stripe Connect integration coming soon. Payouts will be processed automatically.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
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
  trialInfo: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
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
  earningsAmount: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 8,
  },
  earningsSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
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
  feeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
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
  eventInfo: {
    flex: 1,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
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
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
  },
  setupButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  stripeNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
});
