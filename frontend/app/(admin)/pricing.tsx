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
  },
  {
    id: '2',
    name: 'Premium Coaches',
    description: 'Reduced fee for top-rated tutors',
    platformFeePercent: 10,
    minPrice: 50,
    maxPrice: 1000,
    isActive: true,
  },
  {
    id: '3',
    name: 'Promotional Rate',
    description: 'Special promotional pricing',
    platformFeePercent: 5,
    minPrice: 15,
    maxPrice: 200,
    isActive: false,
  },
];

export default function AdminPricingScreen() {
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [policies, setPolicies] = useState<PricingPolicy[]>(DEFAULT_POLICIES);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 800 : isTablet ? 640 : undefined;

  const styles = getStyles(colors);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      showInfo(`${title}: ${message}`);
    } else {
      showInfo(message, title);
    }
  };

  const togglePolicy = (id: string) => {
    setPolicies(prev =>
      prev.map(p => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
    showSuccess('Policy status updated');
  };

  const updateFee = (id: string, newFee: string) => {
    const fee = parseFloat(newFee);
    if (isNaN(fee) || fee < 0 || fee > 100) return;
    setPolicies(prev =>
      prev.map(p => (p.id === id ? { ...p, platformFeePercent: fee } : p))
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title="Pricing Policies" />
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Pricing Policies</Text>
            <Text style={styles.subtitle}>Manage platform fees and pricing rules</Text>
          </View>

          {/* Summary Card */}
          <View style={[styles.summaryCard, isTablet && styles.summaryCardTablet]}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>15%</Text>
              <Text style={styles.summaryLabel}>Default Fee</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>$20-500</Text>
              <Text style={styles.summaryLabel}>Price Range</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{policies.filter(p => p.isActive).length}</Text>
              <Text style={styles.summaryLabel}>Active Policies</Text>
            </View>
          </View>

          {/* Policies List */}
          {policies.map(policy => (
            <View key={policy.id} style={[styles.policyCard, isTablet && styles.policyCardTablet]}>
              <View style={styles.policyHeader}>
                <View style={styles.policyInfo}>
                  <Text style={[styles.policyName, isDesktop && styles.policyNameDesktop]}>{policy.name}</Text>
                  <Text style={styles.policyDescription}>{policy.description}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusToggle, policy.isActive && styles.statusToggleActive]}
                  onPress={() => togglePolicy(policy.id)}
                >
                  <Text style={[styles.statusToggleText, policy.isActive && styles.statusToggleTextActive]}>
                    {policy.isActive ? 'Active' : 'Inactive'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.policyDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Platform Fee</Text>
                  <View style={styles.feeInput}>
                    <TextInput
                      style={styles.feeInputField}
                      value={policy.platformFeePercent.toString()}
                      onChangeText={(val) => updateFee(policy.id, val)}
                      keyboardType="numeric"
                      editable={editingId === policy.id}
                    />
                    <Text style={styles.feePercent}>%</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Min Price</Text>
                  <Text style={styles.detailValue}>${policy.minPrice}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Max Price</Text>
                  <Text style={styles.detailValue}>${policy.maxPrice}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() => setEditingId(editingId === policy.id ? null : policy.id)}
              >
                <Ionicons name={editingId === policy.id ? 'checkmark' : 'pencil'} size={16} color={colors.primary} />
                <Text style={styles.editButtonText}>{editingId === policy.id ? 'Save' : 'Edit'}</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Policy Button */}
          <TouchableOpacity style={[styles.addButton, isTablet && styles.addButtonTablet]}>
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.addButtonText}>Add New Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryCardTablet: { borderRadius: 20, padding: 24 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: colors.primary },
  summaryLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  policyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  policyCardTablet: { borderRadius: 20, padding: 20 },
  policyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  policyInfo: { flex: 1, marginRight: 12 },
  policyName: { fontSize: 16, fontWeight: '600', color: colors.text },
  policyNameDesktop: { fontSize: 18 },
  policyDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  statusToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.gray200,
  },
  statusToggleActive: { backgroundColor: colors.successLight },
  statusToggleText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  statusToggleTextActive: { color: colors.success },
  policyDetails: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '600', color: colors.text },
  feeInput: { flexDirection: 'row', alignItems: 'center' },
  feeInputField: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 40,
    textAlign: 'center',
  },
  feePercent: { fontSize: 16, fontWeight: '600', color: colors.text, marginLeft: 2 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
  },
  editButtonText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addButtonTablet: { borderRadius: 20, paddingVertical: 20 },
  addButtonText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
