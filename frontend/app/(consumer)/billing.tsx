import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface BillingInfo {
  stripe_connected: boolean;
  stripe_customer_id: string | null;
  pending_balance: number;
  pending_payments: any[];
  auto_pay: {
    enabled: boolean;
    day_of_month: number;
    next_auto_pay_date: string | null;
    next_auto_pay_amount: number;
  };
  payment_methods: any[];
}

export default function BillingScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [savingAutoPay, setSavingAutoPay] = useState(false);

  const loadBilling = useCallback(async () => {
    try {
      const response = await api.get('/billing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBilling(response.data);
    } catch (error) {
      console.error('Failed to load billing:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const handleSetupStripe = async () => {
    setSettingUp(true);
    try {
      const response = await api.post('/billing/setup-stripe', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.already_setup) {
        Alert.alert('Info', 'Stripe account is already connected');
      } else {
        Alert.alert('Success', 'Stripe billing setup complete!');
      }
      loadBilling();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to setup Stripe');
    } finally {
      setSettingUp(false);
    }
  };

  const handleToggleAutoPay = async (enabled: boolean) => {
    setSavingAutoPay(true);
    try {
      await api.put('/billing/auto-pay', {
        enabled,
        day_of_month: billing?.auto_pay?.day_of_month || 1
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadBilling();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update auto-pay');
    } finally {
      setSavingAutoPay(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title="Billing" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title="Billing" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBilling(); }} />
        }
      >
        {/* Stripe Connection Status */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card" size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Setup</Text>
          </View>

          {billing?.stripe_connected ? (
            <View style={styles.connectedRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={[styles.connectedText, { color: colors.success }]}>Stripe Connected</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.setupButton, { backgroundColor: colors.primary }, settingUp && styles.buttonDisabled]}
              onPress={handleSetupStripe}
              disabled={settingUp}
            >
              {settingUp ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="link" size={20} color="#FFFFFF" />
                  <Text style={styles.setupButtonText}>Connect Stripe Account</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Pending Balance */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet" size={24} color={colors.warning} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pending Balance</Text>
          </View>

          <View style={styles.balanceCard}>
            <Text style={[styles.balanceAmount, { color: billing?.pending_balance ? colors.warning : colors.success }]}>
              ${(billing?.pending_balance || 0).toFixed(2)}
            </Text>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
              {billing?.pending_balance ? 'Due for upcoming sessions' : 'No pending payments'}
            </Text>
          </View>

          {billing?.pending_payments && billing.pending_payments.length > 0 && (
            <View style={styles.pendingList}>
              {billing.pending_payments.slice(0, 3).map((payment, index) => (
                <View key={index} style={[styles.pendingItem, { borderTopColor: colors.border }]}>
                  <Text style={[styles.pendingText, { color: colors.text }]}>
                    ${payment.amount?.toFixed(2)}
                  </Text>
                  <Text style={[styles.pendingDate, { color: colors.textMuted }]}>
                    Due: {formatDate(payment.due_date)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Auto-Pay Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="repeat" size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Auto-Pay</Text>
          </View>

          <View style={styles.autoPayRow}>
            <View style={styles.autoPayInfo}>
              <Text style={[styles.autoPayLabel, { color: colors.text }]}>Enable Auto-Pay</Text>
              <Text style={[styles.autoPayDesc, { color: colors.textMuted }]}>
                Automatically pay pending balance on the 1st of each month
              </Text>
            </View>
            <Switch
              value={billing?.auto_pay?.enabled || false}
              onValueChange={handleToggleAutoPay}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={savingAutoPay}
            />
          </View>

          {billing?.auto_pay?.enabled && (
            <View style={[styles.nextAutoPayCard, { backgroundColor: colors.background }]}>
              <Text style={[styles.nextAutoPayLabel, { color: colors.textMuted }]}>Next Auto-Pay</Text>
              <Text style={[styles.nextAutoPayDate, { color: colors.text }]}>
                {formatDate(billing.auto_pay.next_auto_pay_date)}
              </Text>
              <Text style={[styles.nextAutoPayAmount, { color: colors.primary }]}>
                ${billing.auto_pay.next_auto_pay_amount.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Payment Methods */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card-outline" size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Payment Methods</Text>
          </View>

          {billing?.payment_methods && billing.payment_methods.length > 0 ? (
            billing.payment_methods.map((method, index) => (
              <View key={index} style={styles.paymentMethodItem}>
                <Ionicons name="card" size={20} color={colors.text} />
                <Text style={[styles.paymentMethodText, { color: colors.text }]}>
                  •••• {method.last4}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.noMethodsText, { color: colors.textMuted }]}>
              No payment methods added yet
            </Text>
          )}

          <TouchableOpacity style={[styles.addMethodButton, { borderColor: colors.primary }]}>
            <Ionicons name="add" size={20} color={colors.primary} />
            <Text style={[styles.addMethodText, { color: colors.primary }]}>Add Payment Method</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  balanceCard: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
  },
  balanceLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  pendingList: {
    marginTop: 12,
  },
  pendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  pendingText: { fontSize: 14, fontWeight: '500' },
  pendingDate: { fontSize: 13 },
  autoPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoPayInfo: { flex: 1, marginRight: 12 },
  autoPayLabel: { fontSize: 15, fontWeight: '500' },
  autoPayDesc: { fontSize: 12, marginTop: 2 },
  nextAutoPayCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextAutoPayLabel: { fontSize: 12 },
  nextAutoPayDate: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  nextAutoPayAmount: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  paymentMethodText: { fontSize: 14 },
  noMethodsText: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  addMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addMethodText: { fontSize: 14, fontWeight: '500' },
});
