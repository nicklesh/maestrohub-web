import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import { useMarket } from '@/src/context/MarketContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface PaymentProvider {
  id: string;
  name: string;
  icon: string;
}

interface LinkedProvider {
  provider_id: string;
  display_name: string;
  is_default: boolean;
  linked_at: string;
}

interface BillingInfo {
  pending_balance: number;
  pending_payments: any[];
  auto_pay: {
    enabled: boolean;
    day_of_month: number;
    next_auto_pay_date: string | null;
    next_auto_pay_amount: number;
  };
}

// Provider icons mapping
const PROVIDER_ICONS: Record<string, { icon: string; color: string }> = {
  paypal: { icon: 'logo-paypal', color: '#003087' },
  google_pay: { icon: 'logo-google', color: '#4285F4' },
  apple_pay: { icon: 'logo-apple', color: '#000000' },
  venmo: { icon: 'phone-portrait', color: '#008CFF' },
  zelle: { icon: 'flash', color: '#6D1ED4' },
  phonepe: { icon: 'wallet', color: '#5F259F' },
  paytm: { icon: 'wallet', color: '#00BAF2' },
  amazon_pay: { icon: 'cart', color: '#FF9900' },
};

const DAY_OPTIONS = [1, 5, 10, 15, 20, 25, 28];

export default function BillingScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  const { market } = useMarket();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [availableProviders, setAvailableProviders] = useState<PaymentProvider[]>([]);
  const [linkedProviders, setLinkedProviders] = useState<LinkedProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingAutoPay, setSavingAutoPay] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showDayPickerModal, setShowDayPickerModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [billingRes, providersRes] = await Promise.all([
        api.get('/billing', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/payment-providers', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      
      setBilling(billingRes.data);
      setAvailableProviders(providersRes.data.available_providers || []);
      setLinkedProviders(providersRes.data.linked_providers || []);
      setSelectedDay(billingRes.data.auto_pay?.day_of_month || 1);
    } catch (error) {
      console.error('Failed to load billing:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleAutoPay = async (enabled: boolean) => {
    setSavingAutoPay(true);
    try {
      await api.put('/billing/auto-pay', {
        enabled,
        day_of_month: selectedDay
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadData();
    } catch (error: any) {
      showInfo(error.response?.data?.detail || 'Failed to update auto-pay', 'Error');
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
      loadData();
    } catch (error: any) {
      showInfo(error.response?.data?.detail || 'Failed to update auto-pay date', 'Error');
    } finally {
      setSavingAutoPay(false);
    }
  };

  const handleLinkProvider = async (providerId: string) => {
    setLinkingProvider(providerId);
    try {
      const isFirst = linkedProviders.length === 0;
      await api.post('/payment-providers', {
        provider_id: providerId,
        is_default: isFirst
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showSuccess('Payment method linked successfully!');
      setShowProviderModal(false);
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to link payment method');
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleUnlinkProvider = async (providerId: string, displayName: string) => {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to remove ${displayName}?`)
      : true;
    
    if (confirmed) {
      try {
        await api.delete(`/payment-providers/${providerId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showSuccess('Payment method removed');
        loadData();
      } catch (error: any) {
        showError(error.response?.data?.detail || 'Failed to remove payment method');
      }
    }
  };

  const handleSetDefault = async (providerId: string) => {
    try {
      await api.put(`/payment-providers/${providerId}/default`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadData();
    } catch (error: any) {
      showInfo(error.response?.data?.detail || 'Failed to set default', 'Error');
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

  const getProviderIcon = (providerId: string) => {
    return PROVIDER_ICONS[providerId] || { icon: 'card', color: colors.primary };
  };

  // Get providers that are not yet linked
  const unlinkedProviders = availableProviders.filter(
    p => !linkedProviders.some(lp => lp.provider_id === p.id)
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack showUserName title={t('pages.billing.title')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title={t('pages.billing.title')} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {/* Pending Balance */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="wallet" size={24} color={colors.warning} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.billing.pending_balance')}</Text>
          </View>

          <View style={styles.balanceCard}>
            <Text style={[styles.balanceAmount, { color: billing?.pending_balance ? colors.warning : colors.success }]}>
              {market?.currency_symbol || '$'}{(billing?.pending_balance || 0).toFixed(2)}
            </Text>
            <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>
              {billing?.pending_balance ? t('pages.billing.due_for_sessions') : t('pages.billing.no_pending_payments')}
            </Text>
          </View>
        </View>

        {/* Linked Payment Methods */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="card" size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.billing.payment_methods')}</Text>
          </View>

          {linkedProviders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('pages.billing.no_payment_methods')}
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                {t('pages.billing.add_payment_method_desc')}
              </Text>
            </View>
          ) : (
            <View style={styles.providersList}>
              {linkedProviders.map((provider) => {
                const iconInfo = getProviderIcon(provider.provider_id);
                return (
                  <View 
                    key={provider.provider_id} 
                    style={[styles.linkedProviderCard, { borderColor: provider.is_default ? colors.primary : colors.border }]}
                  >
                    <View style={[styles.providerIconContainer, { backgroundColor: iconInfo.color + '15' }]}>
                      <Ionicons name={iconInfo.icon as any} size={24} color={iconInfo.color} />
                    </View>
                    <View style={styles.providerInfo}>
                      <Text style={[styles.providerName, { color: colors.text }]}>{provider.display_name}</Text>
                      {provider.is_default && (
                        <View style={[styles.defaultBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>{t('pages.billing.default')}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.providerActions}>
                      {!provider.is_default && (
                        <TouchableOpacity 
                          style={[styles.actionButton, { backgroundColor: colors.background }]}
                          onPress={() => handleSetDefault(provider.provider_id)}
                        >
                          <Text style={[styles.actionButtonText, { color: colors.primary }]}>{t('pages.billing.set_default')}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={() => handleUnlinkProvider(provider.provider_id, provider.display_name)}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {unlinkedProviders.length > 0 && (
            <TouchableOpacity 
              style={[styles.addMethodButton, { borderColor: colors.primary }]}
              onPress={() => setShowProviderModal(true)}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={[styles.addMethodText, { color: colors.primary }]}>{t('pages.billing.add_payment_method')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Auto-Pay Settings */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="repeat" size={24} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.billing.auto_pay')}</Text>
          </View>

          <View style={styles.autoPayRow}>
            <View style={styles.autoPayInfo}>
              <Text style={[styles.autoPayLabel, { color: colors.text }]}>{t('pages.billing.enable_auto_pay')}</Text>
              <Text style={[styles.autoPayDesc, { color: colors.textMuted }]}>
                {t('pages.billing.auto_pay_desc')}
              </Text>
            </View>
            <Switch
              value={billing?.auto_pay?.enabled || false}
              onValueChange={handleToggleAutoPay}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={savingAutoPay || linkedProviders.length === 0}
            />
          </View>

          {linkedProviders.length === 0 && (
            <Text style={[styles.warningText, { color: colors.warning }]}>
              {t('pages.billing.add_payment_to_enable')}
            </Text>
          )}

          {billing?.auto_pay?.enabled && (
            <>
              <TouchableOpacity 
                style={[styles.daySelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowDayPickerModal(true)}
              >
                <View>
                  <Text style={[styles.daySelectorLabel, { color: colors.textMuted }]}>{t('pages.billing.payment_day')}</Text>
                  <Text style={[styles.daySelectorValue, { color: colors.text }]}>
                    {selectedDay}{getOrdinalSuffix(selectedDay)} {t('pages.billing.of_each_month')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={[styles.nextAutoPayCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.nextAutoPayLabel, { color: colors.textMuted }]}>{t('pages.billing.next_auto_pay')}</Text>
                <Text style={[styles.nextAutoPayDate, { color: colors.text }]}>
                  {formatDate(billing.auto_pay.next_auto_pay_date)}
                </Text>
                <Text style={[styles.nextAutoPayAmount, { color: colors.primary }]}>
                  {market?.currency_symbol || '$'}{billing.auto_pay.next_auto_pay_amount.toFixed(2)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Payment Security Note */}
        <View style={[styles.securityNote, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <Text style={[styles.securityNoteText, { color: colors.primary }]}>
            {t('pages.billing.security_note')}
          </Text>
        </View>
      </ScrollView>

      {/* Add Payment Method Modal */}
      <Modal visible={showProviderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowProviderModal(false)} 
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('pages.billing.add_payment_method')}</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
              {t('pages.billing.select_provider', { market: market?.currency === 'INR' ? 'India' : 'US' })}
            </Text>

            {unlinkedProviders.map((provider) => {
              const iconInfo = getProviderIcon(provider.id);
              const isLinking = linkingProvider === provider.id;
              return (
                <TouchableOpacity
                  key={provider.id}
                  style={[styles.providerOption, { borderColor: colors.border }]}
                  onPress={() => handleLinkProvider(provider.id)}
                  disabled={isLinking}
                >
                  <View style={[styles.providerIconContainer, { backgroundColor: iconInfo.color + '15' }]}>
                    <Ionicons name={iconInfo.icon as any} size={24} color={iconInfo.color} />
                  </View>
                  <Text style={[styles.providerOptionName, { color: colors.text }]}>{provider.name}</Text>
                  {isLinking ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="add-circle" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            {unlinkedProviders.length === 0 && (
              <Text style={[styles.allLinkedText, { color: colors.textMuted }]}>
                {t('pages.billing.all_methods_linked')}
              </Text>
            )}
          </View>
        </View>
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
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('pages.billing.select_payment_day')}</Text>
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
  scrollContent: { padding: 16, paddingBottom: 32 },
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
  balanceCard: { alignItems: 'center', paddingVertical: 16 },
  balanceAmount: { fontSize: 32, fontWeight: '700' },
  balanceLabel: { fontSize: 13, marginTop: 4 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: { fontSize: 16, fontWeight: '500', marginTop: 12 },
  emptySubtext: { fontSize: 13, marginTop: 4 },
  providersList: { gap: 12 },
  linkedProviderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  providerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: { fontSize: 15, fontWeight: '600' },
  defaultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  defaultBadgeText: { fontSize: 11, fontWeight: '600' },
  providerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: { fontSize: 12, fontWeight: '600' },
  removeButton: {
    padding: 8,
  },
  addMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  addMethodText: { fontSize: 15, fontWeight: '600' },
  autoPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  autoPayInfo: { flex: 1, marginRight: 12 },
  autoPayLabel: { fontSize: 15, fontWeight: '500' },
  autoPayDesc: { fontSize: 12, marginTop: 2 },
  warningText: { fontSize: 12, marginTop: 8 },
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
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  securityNoteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, marginBottom: 16 },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  providerOptionName: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500' },
  allLinkedText: { textAlign: 'center', fontSize: 14, paddingVertical: 20 },
  dayPickerSheet: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
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
