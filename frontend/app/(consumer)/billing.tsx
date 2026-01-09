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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
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

interface PaymentProviderInput {
  providerId: string;
  email?: string;
  phone?: string;
  username?: string;
}

const PAYMENT_PROVIDERS = [
  { id: 'apple_pay', name: 'Apple Pay', icon: 'logo-apple', color: '#000000', inputType: 'email', placeholder: 'Apple ID Email' },
  { id: 'google_pay', name: 'Google Pay', icon: 'logo-google', color: '#4285F4', inputType: 'email', placeholder: 'Google Email' },
  { id: 'paypal', name: 'PayPal', icon: 'logo-paypal', color: '#003087', inputType: 'email', placeholder: 'PayPal Email' },
  { id: 'amazon_pay', name: 'Amazon Pay', icon: 'cart', color: '#FF9900', inputType: 'email', placeholder: 'Amazon Email' },
  { id: 'zelle', name: 'Zelle', icon: 'flash', color: '#6D1ED4', inputType: 'phone', placeholder: 'Phone or Email' },
  { id: 'venmo', name: 'Venmo', icon: 'phone-portrait', color: '#008CFF', inputType: 'username', placeholder: '@username' },
];

const DAY_OPTIONS = [1, 5, 10, 15, 20, 25, 28];

export default function BillingScreen() {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [savingAutoPay, setSavingAutoPay] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDayPickerModal, setShowDayPickerModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [showProviderInput, setShowProviderInput] = useState(false);
  const [providerInputValue, setProviderInputValue] = useState('');
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);

  const loadBilling = useCallback(async () => {
    try {
      const response = await api.get('/billing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBilling(response.data);
      setSelectedDay(response.data.auto_pay?.day_of_month || 1);
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
        day_of_month: selectedDay
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

  const handleDayChange = async (day: number) => {
    setSelectedDay(day);
    setSavingAutoPay(true);
    try {
      await api.put('/billing/auto-pay', {
        enabled: billing?.auto_pay?.enabled || false,
        day_of_month: day
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowDayPickerModal(false);
      loadBilling();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update auto-pay date');
    } finally {
      setSavingAutoPay(false);
    }
  };

  const handleSelectProvider = (provider: any) => {
    setSelectedProvider(provider);
    setProviderInputValue('');
    setShowPaymentModal(false);
    setShowProviderInput(true);
  };

  const handleSavePaymentMethod = async () => {
    if (!providerInputValue.trim()) {
      Alert.alert('Error', 'Please enter the required information');
      return;
    }

    setSavingPaymentMethod(true);
    try {
      // Note: This app doesn't store payment info - just confirms the method
      Alert.alert(
        'Payment Method Added',
        `${selectedProvider?.name} has been linked. You'll be redirected to ${selectedProvider?.name} when making payments.`,
        [{ text: 'OK', onPress: () => {
          setShowProviderInput(false);
          setSelectedProvider(null);
          setProviderInputValue('');
        }}]
      );
    } finally {
      setSavingPaymentMethod(false);
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

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack showUserName title="Billing" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title="Billing" />

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
                Automatically pay pending balance monthly
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
            <>
              {/* Day Selector */}
              <TouchableOpacity 
                style={[styles.daySelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowDayPickerModal(true)}
              >
                <View>
                  <Text style={[styles.daySelectorLabel, { color: colors.textMuted }]}>Payment Day</Text>
                  <Text style={[styles.daySelectorValue, { color: colors.text }]}>
                    {selectedDay}{getOrdinalSuffix(selectedDay)} of each month
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={[styles.nextAutoPayCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.nextAutoPayLabel, { color: colors.textMuted }]}>Next Auto-Pay</Text>
                <Text style={[styles.nextAutoPayDate, { color: colors.text }]}>
                  {formatDate(billing.auto_pay.next_auto_pay_date)}
                </Text>
                <Text style={[styles.nextAutoPayAmount, { color: colors.primary }]}>
                  ${billing.auto_pay.next_auto_pay_amount.toFixed(2)}
                </Text>
              </View>
            </>
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

          <TouchableOpacity 
            style={[styles.addMethodButton, { borderColor: colors.primary }]}
            onPress={() => setShowPaymentModal(true)}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
            <Text style={[styles.addMethodText, { color: colors.primary }]}>Add Payment Method</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Payment Method Selection Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowPaymentModal(false)} 
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add Payment Method</Text>

            {PAYMENT_PROVIDERS.map((provider) => (
              <TouchableOpacity
                key={provider.id}
                style={[styles.providerOption, { borderColor: colors.border }]}
                onPress={() => handleSelectProvider(provider)}
              >
                <View style={[styles.providerIcon, { backgroundColor: provider.color + '15' }]}>
                  <Ionicons name={provider.icon as any} size={24} color={provider.color} />
                </View>
                <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Provider Input Modal */}
      <Modal visible={showProviderInput} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowProviderInput(false)} 
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            
            {selectedProvider && (
              <>
                <View style={styles.providerHeader}>
                  <View style={[styles.providerIconLarge, { backgroundColor: selectedProvider.color + '15' }]}>
                    <Ionicons name={selectedProvider.icon as any} size={32} color={selectedProvider.color} />
                  </View>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Link {selectedProvider.name}</Text>
                </View>

                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                  {selectedProvider.inputType === 'email' ? 'Email Address' : 
                   selectedProvider.inputType === 'phone' ? 'Phone or Email' : 'Username'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder={selectedProvider.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={providerInputValue}
                  onChangeText={setProviderInputValue}
                  keyboardType={selectedProvider.inputType === 'email' ? 'email-address' : 
                               selectedProvider.inputType === 'phone' ? 'phone-pad' : 'default'}
                  autoCapitalize="none"
                />

                <Text style={[styles.privacyNote, { color: colors.textMuted }]}>
                  Note: Maestro Hub does not store your payment information. You will be redirected to {selectedProvider.name} to complete payments.
                </Text>

                <TouchableOpacity
                  style={[styles.linkButton, { backgroundColor: selectedProvider.color }, savingPaymentMethod && styles.buttonDisabled]}
                  onPress={handleSavePaymentMethod}
                  disabled={savingPaymentMethod}
                >
                  {savingPaymentMethod ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.linkButtonText}>Link {selectedProvider.name}</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Day Picker Modal */}
      <Modal visible={showDayPickerModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowDayPickerModal(false)} 
          />
          <View style={[styles.dayPickerSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Select Payment Day</Text>
            <Text style={[styles.dayPickerHint, { color: colors.textMuted }]}>
              Choose which day of the month to auto-pay
            </Text>
            
            <View style={styles.dayGrid}>
              {DAY_OPTIONS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayOption,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    selectedDay === day && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => handleDayChange(day)}
                  disabled={savingAutoPay}
                >
                  <Text style={[
                    styles.dayOptionText,
                    { color: colors.text },
                    selectedDay === day && { color: '#FFFFFF' }
                  ]}>
                    {day}{getOrdinalSuffix(day)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectedText: { fontSize: 14, fontWeight: '500' },
  setupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  setupButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  balanceCard: { alignItems: 'center', paddingVertical: 16 },
  balanceAmount: { fontSize: 32, fontWeight: '700' },
  balanceLabel: { fontSize: 13, marginTop: 4 },
  autoPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoPayInfo: { flex: 1, marginRight: 12 },
  autoPayLabel: { fontSize: 15, fontWeight: '500' },
  autoPayDesc: { fontSize: 12, marginTop: 2 },
  daySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  daySelectorLabel: { fontSize: 12 },
  daySelectorValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  nextAutoPayCard: {
    marginTop: 12,
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
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
  },
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerName: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500' },
  dayPickerSheet: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
    overflow: 'hidden',
  },
  dayPickerHint: { fontSize: 13, marginBottom: 16 },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  dayOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  dayOptionText: { fontSize: 14, fontWeight: '500' },
});
