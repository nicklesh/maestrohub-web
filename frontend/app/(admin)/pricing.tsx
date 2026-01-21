import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useAuth } from '@/src/context/AuthContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface PricingPolicy {
  policy_id: string;
  market_id: string;
  market_name?: string;
  trial_days: number;
  trial_free_until_first_booking: boolean;
  nsf_amount_cents: number;
  provider_fee_percent: number;
  consumer_fee_percent: number;
  pro_subscription_price_cents: number | null;
  isActive?: boolean;
}

// Market names mapping
const MARKET_NAMES: Record<string, string> = {
  'US_USD': 'United States (USD)',
  'CA_CAD': 'Canada (CAD)',
  'GB_GBP': 'United Kingdom (GBP)',
  'AU_AUD': 'Australia (AUD)',
  'DE_EUR': 'Germany (EUR)',
  'FR_EUR': 'France (EUR)',
  'IN_INR': 'India (INR)',
  'SG_SGD': 'Singapore (SGD)',
  'AE_AED': 'UAE (AED)',
};

export default function AdminPricingScreen() {
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const { token } = useAuth();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [policies, setPolicies] = useState<PricingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PricingPolicy | null>(null);
  const [saving, setSaving] = useState(false);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 800 : isTablet ? 640 : undefined;

  const styles = getStyles(colors);

  const loadPolicies = async () => {
    try {
      const response = await api.get('/pricing-policies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const policiesData = response.data?.policies || [];
      
      // Add market names to policies
      const enrichedPolicies = policiesData.map((policy: PricingPolicy) => ({
        ...policy,
        market_name: MARKET_NAMES[policy.market_id] || policy.market_id,
        isActive: true, // All policies from DB are active
      }));
      
      setPolicies(enrichedPolicies);
    } catch (error) {
      console.error('Failed to load pricing policies:', error);
      showError(t('pages.admin.pricing_page.load_failed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadPolicies();
  };

  const startEditing = (policy: PricingPolicy) => {
    setEditingId(policy.policy_id);
    setEditForm({ ...policy });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const savePolicy = async () => {
    if (!editForm) return;
    
    setSaving(true);
    try {
      await api.post(`/admin/pricing-policies/${editForm.market_id}`, {
        trial_days: editForm.trial_days,
        trial_free_until_first_booking: editForm.trial_free_until_first_booking,
        nsf_amount_cents: editForm.nsf_amount_cents,
        provider_fee_percent: editForm.provider_fee_percent,
        consumer_fee_percent: editForm.consumer_fee_percent,
        pro_subscription_price_cents: editForm.pro_subscription_price_cents,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showSuccess(t('pages.admin.pricing_page.policy_updated'));
      setEditingId(null);
      setEditForm(null);
      loadPolicies();
    } catch (error: any) {
      showError(error.response?.data?.detail || t('pages.admin.pricing_page.save_failed'));
    } finally {
      setSaving(false);
    }
  };
    setEditForm(null);
  };

  const renderPolicyCard = (policy: PricingPolicy) => {
    const isEditing = editingId === policy.policy_id;
    
    return (
      <View key={policy.policy_id} style={[styles.policyCard, { backgroundColor: colors.surface }]}>
        <View style={styles.policyHeader}>
          <View style={styles.policyTitleRow}>
            <Text style={[styles.policyName, { color: colors.text }]}>
              {policy.market_name || policy.market_id}
            </Text>
            {policy.isActive && (
              <View style={[styles.activeBadge, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.activeBadgeText, { color: colors.success }]}>
                  {t('pages.admin.pricing_page.active')}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: colors.primary + '15' }]}
            onPress={() => isEditing ? cancelEditing() : startEditing(policy)}
          >
            <Ionicons 
              name={isEditing ? 'close' : 'pencil'} 
              size={18} 
              color={colors.primary} 
            />
          </TouchableOpacity>
        </View>

        {isEditing && editForm ? (
          <View style={styles.editForm}>
            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                {t('pages.admin.pricing_page.trial_days')}
              </Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={String(editForm.trial_days)}
                onChangeText={(text) => setEditForm({ ...editForm, trial_days: parseInt(text) || 0 })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                {t('pages.admin.pricing_page.provider_fee_percent')}
              </Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={String(editForm.provider_fee_percent)}
                onChangeText={(text) => setEditForm({ ...editForm, provider_fee_percent: parseFloat(text) || 0 })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                {t('pages.admin.pricing_page.consumer_fee_percent')}
              </Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={String(editForm.consumer_fee_percent)}
                onChangeText={(text) => setEditForm({ ...editForm, consumer_fee_percent: parseFloat(text) || 0 })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: colors.text }]}>
                {t('pages.admin.pricing_page.nsf_amount')} (cents)
              </Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                value={String(editForm.nsf_amount_cents)}
                onChangeText={(text) => setEditForm({ ...editForm, nsf_amount_cents: parseInt(text) || 0 })}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={cancelEditing}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  {t('buttons.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={savePolicy}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('buttons.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.policyDetails}>
            <View style={styles.policyRow}>
              <Text style={[styles.policyLabel, { color: colors.textMuted }]}>
                {t('pages.admin.pricing_page.trial_days')}
              </Text>
              <Text style={[styles.policyValue, { color: colors.text }]}>
                {policy.trial_days} {t('pages.admin.pricing_page.days')}
              </Text>
            </View>
            <View style={styles.policyRow}>
              <Text style={[styles.policyLabel, { color: colors.textMuted }]}>
                {t('pages.admin.pricing_page.provider_fee')}
              </Text>
              <Text style={[styles.policyValue, { color: colors.text }]}>
                {policy.provider_fee_percent}%
              </Text>
            </View>
            <View style={styles.policyRow}>
              <Text style={[styles.policyLabel, { color: colors.textMuted }]}>
                {t('pages.admin.pricing_page.consumer_fee')}
              </Text>
              <Text style={[styles.policyValue, { color: colors.text }]}>
                {policy.consumer_fee_percent}%
              </Text>
            </View>
            <View style={styles.policyRow}>
              <Text style={[styles.policyLabel, { color: colors.textMuted }]}>
                {t('pages.admin.pricing_page.nsf_fee')}
              </Text>
              <Text style={[styles.policyValue, { color: colors.text }]}>
                ${(policy.nsf_amount_cents / 100).toFixed(2)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={t('pages.admin.pricing_page.title')} showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={t('pages.admin.pricing_page.title')} showBack />
      <ScrollView
        contentContainerStyle={[styles.content, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('pages.admin.pricing_page.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('pages.admin.pricing_page.subtitle')}
          </Text>
        </View>

        {policies.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t('pages.admin.pricing_page.no_policies')}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('pages.admin.pricing_page.no_policies_description')}
            </Text>
          </View>
        ) : (
          policies.map(policy => renderPolicyCard(policy))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
  };

  const addNewPolicy = () => {
    const newPolicy: PricingPolicy = {
      id: Date.now().toString(),
      name: '',
      description: '',
      platformFeePercent: 15,
      minPrice: 15,
      maxPrice: 200,
      isActive: false,
      hasHistory: false,
    };
    setPolicies([...policies, newPolicy]);
    startEditing(newPolicy);
  };

  const renderPolicyCard = (policy: PricingPolicy) => {
    const isEditing = editingId === policy.id;
    const form = isEditing && editForm ? editForm : policy;

    return (
      <View key={policy.id} style={[styles.policyCard, isTablet && styles.policyCardTablet]}>
        <View style={styles.policyHeader}>
          <View style={styles.policyInfo}>
            {isEditing ? (
              <>
                <TextInput
                  style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
                  value={form.name}
                  onChangeText={(val) => setEditForm({ ...form, name: val })}
                  placeholder="Policy Name"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.descInput, { color: colors.textMuted, borderColor: colors.border }]}
                  value={form.description}
                  onChangeText={(val) => setEditForm({ ...form, description: val })}
                  placeholder="Description"
                  placeholderTextColor={colors.textMuted}
                  multiline
                />
              </>
            ) : (
              <>
                <Text style={[styles.policyName, isDesktop && styles.policyNameDesktop]}>{policy.name || 'Unnamed Policy'}</Text>
                <Text style={styles.policyDescription}>{policy.description || 'No description'}</Text>
              </>
            )}
          </View>
          <TouchableOpacity
            style={[styles.statusToggle, policy.isActive && styles.statusToggleActive]}
            onPress={() => !isEditing && togglePolicy(policy.id)}
            disabled={isEditing}
          >
            <Text style={[styles.statusToggleText, policy.isActive && styles.statusToggleTextActive]}>
              {policy.isActive ? t('pages.admin.markets_page.active') : t('pages.admin.markets_page.inactive')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.policyDetails}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t('pages.admin.pricing.platform_fee')}</Text>
            {isEditing ? (
              <View style={styles.feeInput}>
                <TextInput
                  style={[styles.feeInputField, { color: colors.text, borderColor: colors.border }]}
                  value={form.platformFeePercent.toString()}
                  onChangeText={(val) => {
                    const num = parseFloat(val) || 0;
                    setEditForm({ ...form, platformFeePercent: Math.min(100, Math.max(0, num)) });
                  }}
                  keyboardType="numeric"
                />
                <Text style={styles.feePercent}>%</Text>
              </View>
            ) : (
              <Text style={styles.detailValue}>{policy.platformFeePercent}%</Text>
            )}
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t('pages.admin.pricing.min_price')}</Text>
            {isEditing ? (
              <View style={styles.feeInput}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={[styles.priceInputField, { color: colors.text, borderColor: colors.border }]}
                  value={form.minPrice.toString()}
                  onChangeText={(val) => {
                    const num = parseFloat(val) || 0;
                    setEditForm({ ...form, minPrice: Math.max(0, num) });
                  }}
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <Text style={styles.detailValue}>${policy.minPrice}</Text>
            )}
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>{t('pages.admin.pricing.max_price')}</Text>
            {isEditing ? (
              <View style={styles.feeInput}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={[styles.priceInputField, { color: colors.text, borderColor: colors.border }]}
                  value={form.maxPrice.toString()}
                  onChangeText={(val) => {
                    const num = parseFloat(val) || 0;
                    setEditForm({ ...form, maxPrice: num });
                  }}
                  keyboardType="numeric"
                />
              </View>
            ) : (
              <Text style={styles.detailValue}>${policy.maxPrice}</Text>
            )}
          </View>
        </View>

        <View style={styles.actionButtons}>
          {isEditing ? (
            <>
              <TouchableOpacity style={styles.saveButton} onPress={savePolicy}>
                <Ionicons name="checkmark" size={16} color={colors.white} />
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEditing}>
                <Ionicons name="close" size={16} color={colors.error} />
                <Text style={[styles.cancelButtonText, { color: colors.error }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.editButton} onPress={() => startEditing(policy)}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
                <Text style={styles.editButtonText}>{t('common.edit')}</Text>
              </TouchableOpacity>
              {!policy.hasHistory && (
                <TouchableOpacity style={styles.deleteButton} onPress={() => deletePolicy(policy)}>
                  <Ionicons name="trash" size={16} color={colors.error} />
                  <Text style={[styles.deleteButtonText, { color: colors.error }]}>{t('common.delete')}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {policy.hasHistory && !isEditing && (
          <Text style={styles.historyNote}>* {t('pages.admin.pricing.history_note')}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title={t('pages.admin.pricing.title')} />
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>{t('pages.admin.pricing.title')}</Text>
            <Text style={styles.subtitle}>{t('pages.admin.pricing.subtitle')}</Text>
          </View>

          {/* Summary Card */}
          <View style={[styles.summaryCard, isTablet && styles.summaryCardTablet]}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{policies.find(p => p.isActive)?.platformFeePercent || 0}%</Text>
              <Text style={styles.summaryLabel}>{t('pages.admin.pricing.default_fee')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>${MIN_PRICE_FLOOR}+</Text>
              <Text style={styles.summaryLabel}>{t('pages.admin.pricing.min_price')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{policies.filter(p => p.isActive).length}</Text>
              <Text style={styles.summaryLabel}>{t('pages.admin.pricing.active_policies')}</Text>
            </View>
          </View>

          {/* Policies List */}
          {policies.map(renderPolicyCard)}

          {/* Add Policy Button */}
          <TouchableOpacity 
            style={[styles.addButton, isTablet && styles.addButtonTablet]}
            onPress={addNewPolicy}
          >
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.addButtonText}>{t('pages.admin.pricing.add_policy')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Max Price Warning Modal */}
      <Modal
        visible={showMaxWarning}
        transparent
        animationType="fade"
        onRequestClose={handleMaxWarningCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Ionicons name="warning" size={48} color={colors.warning} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('pages.admin.pricing.max_warning_title')}
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textMuted }]}>
              {t('pages.admin.pricing.max_warning_message', { amount: pendingMaxValue, standard: INDUSTRY_MAX })}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={handleMaxWarningCancel}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: colors.warning }]}
                onPress={handleMaxWarningConfirm}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>
                  {t('common.ok')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Ionicons name="trash" size={48} color={colors.error} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('pages.admin.pricing.delete_policy')}
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textMuted }]}>
              {t('pages.admin.pricing.delete_confirm_message', { name: policyToDelete?.name || '' })}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={cancelDelete}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton, { backgroundColor: colors.error }]}
                onPress={confirmDelete}
              >
                <Text style={[styles.modalButtonText, { color: colors.white }]}>
                  {t('common.delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  scrollContentTablet: { padding: 32 },
  contentWrapper: { flex: 1 },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  titleDesktop: { fontSize: 28 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  summaryCardTablet: { padding: 24 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: colors.primary },
  summaryLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  policyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  policyCardTablet: { padding: 20 },
  policyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  policyInfo: { flex: 1, marginRight: 12 },
  policyName: { fontSize: 16, fontWeight: '600', color: colors.text },
  policyNameDesktop: { fontSize: 18 },
  policyDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  nameInput: {
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  descInput: {
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    minHeight: 60,
  },
  statusToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.gray200,
  },
  statusToggleActive: { backgroundColor: colors.successLight },
  statusToggleText: { fontSize: 12, fontWeight: '500', color: colors.gray600 },
  statusToggleTextActive: { color: colors.success },
  policyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailItem: { alignItems: 'center' },
  detailLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  feeInput: { flexDirection: 'row', alignItems: 'center' },
  feeInputField: {
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    width: 50,
    textAlign: 'center',
  },
  priceInputField: {
    fontSize: 16,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 6,
    padding: 6,
    width: 70,
    textAlign: 'center',
  },
  feePercent: { fontSize: 14, color: colors.textMuted, marginLeft: 4 },
  dollarSign: { fontSize: 14, color: colors.textMuted, marginRight: 4 },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editButtonText: { fontSize: 14, color: colors.primary, marginLeft: 4 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deleteButtonText: { fontSize: 14, marginLeft: 4 },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonText: { fontSize: 14, color: colors.white, marginLeft: 4 },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelButtonText: { fontSize: 14, marginLeft: 4 },
  historyNote: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    marginTop: 8,
  },
  addButtonTablet: { padding: 20 },
  addButtonText: { fontSize: 14, color: colors.primary, marginLeft: 8, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    borderWidth: 1,
  },
  modalConfirmButton: {},
  modalButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
