import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useMarket } from '@/src/context/MarketContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface SessionPackage {
  package_id: string;
  name: string;
  session_count: number;
  price_per_session: number;
  total_price: number;
  discount_percent: number;
  validity_days: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

const SESSION_OPTIONS = [4, 8, 12, 16, 20, 24];
const DISCOUNT_OPTIONS = [5, 10, 15, 20, 25, 30];
const VALIDITY_OPTIONS = [
  { value: 30, label: '1 month' },
  { value: 60, label: '2 months' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];

export default function PackagesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { market } = useMarket();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [basePrice, setBasePrice] = useState(0);
  
  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPackage, setNewPackage] = useState({
    name: '',
    session_count: 4,
    discount_percent: 10,
    validity_days: 90,
    description: '',
  });

  const currencySymbol = market?.currency_symbol || '$';

  const loadData = useCallback(async () => {
    try {
      const response = await api.get('/tutor/packages', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPackages(response.data.packages || []);
      
      // Get base price from tutor profile
      const profileRes = await api.get('/tutor/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBasePrice(profileRes.data.base_price || 0);
    } catch (error) {
      console.error('Failed to load packages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculatePricing = () => {
    const discountedPrice = basePrice * (1 - newPackage.discount_percent / 100);
    const totalPrice = discountedPrice * newPackage.session_count;
    const savings = (basePrice * newPackage.session_count) - totalPrice;
    return { discountedPrice, totalPrice, savings };
  };

  const handleCreatePackage = async () => {
    if (!newPackage.name.trim()) {
      Alert.alert('Required', 'Please enter a package name');
      return;
    }
    
    setCreating(true);
    try {
      await api.post('/tutor/packages', newPackage, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Success', 'Package created successfully!');
      setShowCreateModal(false);
      setNewPackage({
        name: '',
        session_count: 4,
        discount_percent: 10,
        validity_days: 90,
        description: '',
      });
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create package');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (packageId: string) => {
    try {
      await api.put(`/tutor/packages/${packageId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update package');
    }
  };

  const handleDelete = (pkg: SessionPackage) => {
    Alert.alert(
      'Delete Package',
      `Are you sure you want to delete "${pkg.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/tutor/packages/${pkg.package_id}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete package');
            }
          }
        }
      ]
    );
  };

  const pricing = calculatePricing();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title="Session Packages" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title="Session Packages" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="gift" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.primary }]}>Offer Session Packages</Text>
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Create discounted bundles to encourage commitment and recurring bookings from clients.
            </Text>
          </View>
        </View>

        {/* Base Price Info */}
        <View style={[styles.basePriceCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.basePriceLabel, { color: colors.textMuted }]}>Your session rate</Text>
          <Text style={[styles.basePriceValue, { color: colors.text }]}>
            {currencySymbol}{basePrice}/session
          </Text>
        </View>

        {/* Packages List */}
        {packages.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Packages Yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Create your first session package to offer discounts to clients
            </Text>
          </View>
        ) : (
          packages.map((pkg) => (
            <View 
              key={pkg.package_id} 
              style={[
                styles.packageCard, 
                { backgroundColor: colors.surface, borderColor: pkg.is_active ? colors.success : colors.border }
              ]}
            >
              <View style={styles.packageHeader}>
                <View style={styles.packageInfo}>
                  <Text style={[styles.packageName, { color: colors.text }]}>{pkg.name}</Text>
                  <Text style={[styles.packageSessions, { color: colors.textMuted }]}>
                    {pkg.session_count} sessions
                  </Text>
                </View>
                <View style={[styles.discountBadge, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.discountText, { color: colors.success }]}>
                    {pkg.discount_percent}% OFF
                  </Text>
                </View>
              </View>

              <View style={styles.packagePricing}>
                <View>
                  <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Per Session</Text>
                  <Text style={[styles.priceValue, { color: colors.text }]}>
                    {currencySymbol}{pkg.price_per_session.toFixed(2)}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Total</Text>
                  <Text style={[styles.totalPrice, { color: colors.primary }]}>
                    {currencySymbol}{pkg.total_price.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.packageMeta}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  Valid for {pkg.validity_days} days
                </Text>
              </View>

              <View style={styles.packageActions}>
                <View style={styles.activeToggle}>
                  <Text style={[styles.activeLabel, { color: colors.text }]}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </Text>
                  <Switch
                    value={pkg.is_active}
                    onValueChange={() => handleToggleActive(pkg.package_id)}
                    trackColor={{ false: colors.gray300, true: colors.success }}
                    thumbColor="#fff"
                  />
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(pkg)}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Button */}
      <TouchableOpacity
        style={[styles.createButton, { backgroundColor: colors.primary }]}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={24} color="#fff" />
        <Text style={styles.createButtonText}>Create Package</Text>
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Package</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Package Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="e.g., Monthly Bundle"
                placeholderTextColor={colors.textMuted}
                value={newPackage.name}
                onChangeText={(text) => setNewPackage({ ...newPackage, name: text })}
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Number of Sessions</Text>
              <View style={styles.optionsRow}>
                {SESSION_OPTIONS.map((count) => (
                  <TouchableOpacity
                    key={count}
                    style={[
                      styles.optionButton,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      newPackage.session_count === count && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                    ]}
                    onPress={() => setNewPackage({ ...newPackage, session_count: count })}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: newPackage.session_count === count ? colors.primary : colors.text }
                    ]}>
                      {count}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Discount Percentage</Text>
              <View style={styles.optionsRow}>
                {DISCOUNT_OPTIONS.map((discount) => (
                  <TouchableOpacity
                    key={discount}
                    style={[
                      styles.optionButton,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      newPackage.discount_percent === discount && { borderColor: colors.success, backgroundColor: colors.success + '20' }
                    ]}
                    onPress={() => setNewPackage({ ...newPackage, discount_percent: discount })}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: newPackage.discount_percent === discount ? colors.success : colors.text }
                    ]}>
                      {discount}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Validity Period</Text>
              <View style={styles.validityOptions}>
                {VALIDITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.validityButton,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      newPackage.validity_days === opt.value && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                    ]}
                    onPress={() => setNewPackage({ ...newPackage, validity_days: opt.value })}
                  >
                    <Text style={[
                      styles.validityText,
                      { color: newPackage.validity_days === opt.value ? colors.primary : colors.text }
                    ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Describe what's included..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={newPackage.description}
                onChangeText={(text) => setNewPackage({ ...newPackage, description: text })}
              />

              {/* Preview */}
              <View style={[styles.previewCard, { backgroundColor: colors.background }]}>
                <Text style={[styles.previewTitle, { color: colors.text }]}>Package Preview</Text>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Regular price:</Text>
                  <Text style={[styles.previewValue, { color: colors.textMuted, textDecorationLine: 'line-through' }]}>
                    {currencySymbol}{(basePrice * newPackage.session_count).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.text }]}>Package price:</Text>
                  <Text style={[styles.previewValue, { color: colors.primary, fontWeight: '700' }]}>
                    {currencySymbol}{pricing.totalPrice.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.previewLabel, { color: colors.success }]}>Client saves:</Text>
                  <Text style={[styles.previewValue, { color: colors.success, fontWeight: '600' }]}>
                    {currencySymbol}{pricing.savings.toFixed(2)}
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={handleCreatePackage}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Package</Text>
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  infoCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 18 },
  basePriceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  basePriceLabel: { fontSize: 14 },
  basePriceValue: { fontSize: 18, fontWeight: '700' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  packageCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  packageInfo: { flex: 1 },
  packageName: { fontSize: 16, fontWeight: '600' },
  packageSessions: { fontSize: 13, marginTop: 2 },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountText: { fontSize: 12, fontWeight: '700' },
  packagePricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  priceLabel: { fontSize: 12 },
  priceValue: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  totalPrice: { fontSize: 20, fontWeight: '700', marginTop: 2 },
  packageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
  },
  metaText: { fontSize: 12 },
  packageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  activeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeLabel: { fontSize: 14 },
  deleteButton: { padding: 8 },
  createButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  createButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { padding: 16 },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 16 },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionText: { fontSize: 14, fontWeight: '500' },
  validityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  validityButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  validityText: { fontSize: 13 },
  previewCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
  },
  previewTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  previewLabel: { fontSize: 14 },
  previewValue: { fontSize: 14 },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600' },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
