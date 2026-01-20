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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';

interface PricingPolicy {
  id: string;
  name: string;
  description: string;
  platformFeePercent: number;
  minPrice: number;
  maxPrice: number;
  isActive: boolean;
  hasHistory?: boolean; // If associated with users historically
}

const DEFAULT_POLICIES: PricingPolicy[] = [
  {
    id: '1',
    name: 'Standard Commission',
    description: 'Default platform fee for all bookings',
    platformFeePercent: 15,
    minPrice: 20,
    maxPrice: 500,
    isActive: true,
    hasHistory: true,
  },
  {
    id: '2',
    name: 'Premium Coaches',
    description: 'Reduced fee for top-rated tutors',
    platformFeePercent: 10,
    minPrice: 50,
    maxPrice: 1000,
    isActive: true,
    hasHistory: true,
  },
  {
    id: '3',
    name: 'Promotional Rate',
    description: 'Special promotional pricing',
    platformFeePercent: 5,
    minPrice: 15,
    maxPrice: 200,
    isActive: false,
    hasHistory: false,
  },
];

export default function AdminPricingScreen() {
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo, showWarning } = useToast();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [policies, setPolicies] = useState<PricingPolicy[]>(DEFAULT_POLICIES);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PricingPolicy | null>(null);
  const [showMaxWarning, setShowMaxWarning] = useState(false);
  const [pendingMaxValue, setPendingMaxValue] = useState<number>(0);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 800 : isTablet ? 640 : undefined;

  const styles = getStyles(colors);

  const MIN_PRICE_FLOOR = 15; // $15 minimum
  const MIN_FEE_PERCENT = 5; // 5% minimum
  const INDUSTRY_MAX = 250; // Industry standard max

  const calculateMinPrice = (feePercent: number): number => {
    // Min is lowest of $15 or 5% calculation
    const feeBasedMin = feePercent > 0 ? Math.ceil(MIN_PRICE_FLOOR / (feePercent / 100)) : MIN_PRICE_FLOOR;
    return Math.min(MIN_PRICE_FLOOR, feeBasedMin);
  };

  const startEditing = (policy: PricingPolicy) => {
    setEditingId(policy.id);
    setEditForm({ ...policy });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const savePolicy = () => {
    if (!editForm) return;

    // Validate minimum price
    const calculatedMin = calculateMinPrice(editForm.platformFeePercent);
    if (editForm.minPrice < calculatedMin) {
      showError(t('pages.admin.pricing.min_price_error', { amount: calculatedMin }));
      return;
    }

    // Validate max >= min
    if (editForm.maxPrice < editForm.minPrice) {
      showError(t('pages.admin.pricing.max_less_than_min'));
      return;
    }

    // Check max price warning
    if (editForm.maxPrice > INDUSTRY_MAX) {
      setShowMaxWarning(true);
      setPendingMaxValue(editForm.maxPrice);
      return;
    }

    confirmSave();
  };

  const confirmSave = () => {
    if (!editForm) return;
    
    setPolicies(prev =>
      prev.map(p => (p.id === editForm.id ? { ...editForm } : p))
    );
    showSuccess(t('pages.admin.pricing.policy_saved'));
    setEditingId(null);
    setEditForm(null);
    setShowMaxWarning(false);
  };

  const handleMaxWarningConfirm = () => {
    confirmSave();
  };

  const handleMaxWarningCancel = () => {
    setShowMaxWarning(false);
    // Keep editing mode open
  };

  const togglePolicy = (id: string) => {
    setPolicies(prev =>
      prev.map(p => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
    showSuccess(t('pages.admin.pricing.status_updated'));
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<PricingPolicy | null>(null);

  const deletePolicy = (policy: PricingPolicy) => {
    if (policy.hasHistory) {
      showError(t('pages.admin.pricing.cannot_delete_history'));
      return;
    }
    setPolicyToDelete(policy);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (policyToDelete) {
      setPolicies(prev => prev.filter(p => p.id !== policyToDelete.id));
      showSuccess(t('pages.admin.pricing.policy_deleted'));
    }
    setShowDeleteModal(false);
    setPolicyToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setPolicyToDelete(null);
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
