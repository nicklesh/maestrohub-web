import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface SponsorshipPlan {
  plan_id: string;
  name: string;
  weeks: number;
  duration_days: number;
  price_cents: number;
  currency: string;
  description: string;
}

interface ActiveSponsorship {
  sponsorship_id: string;
  plan_id: string;
  plan_name: string;
  categories: string[];
  price_paid_cents: number;
  platform_fee_cents: number;
  currency: string;
  started_at: string;
  expires_at: string;
  auto_renew: boolean;
  status: string;
}

const CATEGORIES = [
  'Music', 'Math', 'Languages', 'Science', 'Arts', 'Sports', 
  'Technology', 'Business', 'Health', 'Academic'
];

export default function SponsorshipScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState<SponsorshipPlan[]>([]);
  const [activeSponsorships, setActiveSponsorships] = useState<ActiveSponsorship[]>([]);
  const [pastSponsorships, setPastSponsorships] = useState<ActiveSponsorship[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [platformFee, setPlatformFee] = useState(5);
  
  // Purchase modal
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SponsorshipPlan | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [autoRenew, setAutoRenew] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [plansRes, sponsorshipsRes] = await Promise.all([
        api.get('/sponsorship/plans', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/sponsorship/my-sponsorships', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      
      setPlans(plansRes.data.plans || []);
      setCurrencySymbol(plansRes.data.currency_symbol || '$');
      setPlatformFee(plansRes.data.platform_fee_percent || 5);
      setActiveSponsorships(sponsorshipsRes.data.active || []);
      setPastSponsorships(sponsorshipsRes.data.past || []);
    } catch (error) {
      console.error('Failed to load sponsorship data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatPrice = (cents: number) => {
    return `${currencySymbol}${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysRemaining = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const handleSelectPlan = (plan: SponsorshipPlan) => {
    setSelectedPlan(plan);
    setSelectedCategories([]);
    setAutoRenew(false);
    setShowPurchaseModal(true);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const calculateTotal = () => {
    if (!selectedPlan) return { base: 0, fee: 0, total: 0 };
    const base = selectedPlan.price_cents;
    // Platform fee is built into the price - no extra charge shown
    return { base, fee: 0, total: base };
  };

  const handlePurchase = async () => {
    if (!selectedPlan) return;
    if (selectedCategories.length === 0) {
      Alert.alert('Required', 'Please select at least one category');
      return;
    }
    
    setPurchasing(true);
    try {
      const response = await api.post('/sponsorship/purchase', {
        plan_id: selectedPlan.plan_id,
        categories: selectedCategories,
        auto_renew: autoRenew,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        Alert.alert(
          'Success!', 
          `Your sponsorship is now active! Total charged: ${response.data.total_charged}`,
          [{ text: 'OK', onPress: () => { setShowPurchaseModal(false); loadData(); } }]
        );
      } else if (response.data.redirect_to_billing) {
        Alert.alert('Payment Method Required', response.data.message);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to purchase sponsorship');
    } finally {
      setPurchasing(false);
    }
  };

  const handleRenew = async (sponsorship: ActiveSponsorship) => {
    Alert.alert(
      'Renew Sponsorship',
      `Renew "${sponsorship.plan_name}" for another period?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Renew',
          onPress: async () => {
            try {
              const response = await api.post(`/sponsorship/${sponsorship.sponsorship_id}/renew`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              });
              if (response.data.success) {
                Alert.alert('Renewed!', `Total charged: ${response.data.total_charged}`);
                loadData();
              }
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to renew');
            }
          }
        }
      ]
    );
  };

  const handleToggleAutoRenew = async (sponsorship: ActiveSponsorship) => {
    try {
      const response = await api.put(`/sponsorship/${sponsorship.sponsorship_id}/auto-renew`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        loadData();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update');
    }
  };

  const handleCancel = (sponsorship: ActiveSponsorship) => {
    Alert.alert(
      'Cancel Sponsorship',
      'Your sponsorship will remain active until the end of the current period. Are you sure?',
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/sponsorship/${sponsorship.sponsorship_id}/cancel`, {}, {
                headers: { Authorization: `Bearer ${token}` }
              });
              Alert.alert('Cancelled', 'Your sponsorship will expire at the end of the current period.');
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel');
            }
          }
        }
      ]
    );
  };

  const pricing = calculateTotal();

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title="Sponsorship" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title="Become a Sponsored Coach" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {/* Info Banner */}
        <View style={[styles.banner, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="star" size={32} color={colors.primary} />
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerTitle, { color: colors.primary }]}>Get More Visibility</Text>
            <Text style={[styles.bannerText, { color: colors.primary }]}>
              Sponsored coaches appear at the top of search results with a "Sponsored" badge, helping you reach more students.
            </Text>
          </View>
        </View>

        {/* Active Sponsorships */}
        {activeSponsorships.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Sponsorships</Text>
            {activeSponsorships.map((sponsorship) => (
              <View key={sponsorship.sponsorship_id} style={[styles.activeCard, { backgroundColor: colors.surface, borderColor: colors.success }]}>
                <View style={styles.activeHeader}>
                  <View>
                    <Text style={[styles.activePlanName, { color: colors.text }]}>{sponsorship.plan_name}</Text>
                    <Text style={[styles.activeCategories, { color: colors.textMuted }]}>
                      {sponsorship.categories.join(', ')}
                    </Text>
                  </View>
                  <View style={[styles.activeBadge, { backgroundColor: colors.success + '20' }]}>
                    <Text style={[styles.activeBadgeText, { color: colors.success }]}>ACTIVE</Text>
                  </View>
                </View>
                
                <View style={styles.activeStats}>
                  <View style={styles.activeStat}>
                    <Text style={[styles.activeStatLabel, { color: colors.textMuted }]}>Expires</Text>
                    <Text style={[styles.activeStatValue, { color: colors.text }]}>{formatDate(sponsorship.expires_at)}</Text>
                  </View>
                  <View style={styles.activeStat}>
                    <Text style={[styles.activeStatLabel, { color: colors.textMuted }]}>Days Left</Text>
                    <Text style={[styles.activeStatValue, { color: colors.primary }]}>{getDaysRemaining(sponsorship.expires_at)}</Text>
                  </View>
                </View>

                <View style={styles.activeActions}>
                  <View style={styles.autoRenewToggle}>
                    <Text style={[styles.autoRenewLabel, { color: colors.text }]}>Auto-renew</Text>
                    <Switch
                      value={sponsorship.auto_renew}
                      onValueChange={() => handleToggleAutoRenew(sponsorship)}
                      trackColor={{ false: colors.gray300, true: colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.renewButton, { backgroundColor: colors.primary }]}
                      onPress={() => handleRenew(sponsorship)}
                    >
                      <Text style={styles.renewButtonText}>Renew</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cancelButton, { borderColor: colors.error }]}
                      onPress={() => handleCancel(sponsorship)}
                    >
                      <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Available Plans */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Plans</Text>
          <Text style={[styles.pricingInfo, { color: colors.textMuted }]}>
            {currencySymbol === '₹' ? '₹1,200/week • ₹800/week from week 13' : '$15/week • $10/week from week 13'}
          </Text>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.plan_id}
              style={[styles.planCard, { backgroundColor: colors.surface }]}
              onPress={() => handleSelectPlan(plan)}
            >
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                <View style={[styles.durationBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.durationText, { color: colors.primary }]}>{plan.weeks} {plan.weeks === 1 ? 'week' : 'weeks'}</Text>
                </View>
              </View>
              <Text style={[styles.planDescription, { color: colors.textMuted }]}>{plan.description}</Text>
              <View style={styles.planFooter}>
                <Text style={[styles.planPrice, { color: colors.primary }]}>{formatPrice(plan.price_cents)}</Text>
                {plan.weeks > 1 && (
                  <Text style={[styles.planPriceNote, { color: colors.textMuted }]}>
                    ({currencySymbol}{(plan.price_cents / 100 / plan.weeks).toFixed(0)}/week avg)
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Past Sponsorships */}
        {pastSponsorships.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Past Sponsorships</Text>
            {pastSponsorships.map((sponsorship) => (
              <View key={sponsorship.sponsorship_id} style={[styles.pastCard, { backgroundColor: colors.surface }]}>
                <View style={styles.pastHeader}>
                  <Text style={[styles.pastPlanName, { color: colors.textMuted }]}>{sponsorship.plan_name}</Text>
                  <Text style={[styles.pastStatus, { color: colors.textMuted }]}>{sponsorship.status}</Text>
                </View>
                <Text style={[styles.pastDate, { color: colors.textMuted }]}>
                  Ended: {formatDate(sponsorship.expires_at)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Purchase Modal */}
      <Modal visible={showPurchaseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedPlan?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowPurchaseModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Select Categories to Sponsor</Text>
              <Text style={[styles.inputHint, { color: colors.textMuted }]}>
                Your profile will appear at the top of these category searches
              </Text>
              
              <View style={styles.categoriesGrid}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryChip,
                      { borderColor: colors.border, backgroundColor: colors.background },
                      selectedCategories.includes(category) && { borderColor: colors.primary, backgroundColor: colors.primary + '20' }
                    ]}
                    onPress={() => toggleCategory(category)}
                  >
                    <Text style={[
                      styles.categoryChipText,
                      { color: selectedCategories.includes(category) ? colors.primary : colors.text }
                    ]}>
                      {category}
                    </Text>
                    {selectedCategories.includes(category) && (
                      <Ionicons name="checkmark" size={16} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.autoRenewRow, { borderColor: colors.border }]}>
                <View>
                  <Text style={[styles.autoRenewTitle, { color: colors.text }]}>Auto-Renew</Text>
                  <Text style={[styles.autoRenewDesc, { color: colors.textMuted }]}>
                    Automatically renew when period ends
                  </Text>
                </View>
                <Switch
                  value={autoRenew}
                  onValueChange={setAutoRenew}
                  trackColor={{ false: colors.gray300, true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {/* Pricing Summary */}
              <View style={[styles.pricingSummary, { backgroundColor: colors.background }]}>
                <Text style={[styles.pricingTitle, { color: colors.text }]}>Payment Summary</Text>
                <View style={styles.pricingRow}>
                  <Text style={[styles.pricingLabel, { color: colors.textMuted }]}>
                    {selectedPlan?.name} ({selectedPlan?.weeks} {selectedPlan?.weeks === 1 ? 'week' : 'weeks'})
                  </Text>
                  <Text style={[styles.pricingValue, { color: colors.text }]}>{formatPrice(pricing.base)}</Text>
                </View>
                <View style={[styles.pricingRow, styles.pricingTotal]}>
                  <Text style={[styles.pricingTotalLabel, { color: colors.text }]}>Total</Text>
                  <Text style={[styles.pricingTotalValue, { color: colors.primary }]}>{formatPrice(pricing.total)}</Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.purchaseButton, { backgroundColor: colors.primary }]}
                onPress={handlePurchase}
                disabled={purchasing}
              >
                {purchasing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="card" size={20} color="#fff" />
                    <Text style={styles.purchaseButtonText}>Pay {formatPrice(pricing.total)}</Text>
                  </>
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
  scrollContent: { padding: 16 },
  banner: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  bannerContent: { flex: 1 },
  bannerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  bannerText: { fontSize: 13, lineHeight: 18 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  pricingInfo: { fontSize: 13, marginBottom: 12 },
  activeCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activePlanName: { fontSize: 16, fontWeight: '600' },
  activeCategories: { fontSize: 13, marginTop: 2 },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700' },
  activeStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  activeStat: {},
  activeStatLabel: { fontSize: 12 },
  activeStatValue: { fontSize: 16, fontWeight: '600', marginTop: 2 },
  activeActions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  autoRenewToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoRenewLabel: { fontSize: 14 },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  renewButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  renewButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButtonText: { fontSize: 14, fontWeight: '600' },
  planCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: { fontSize: 16, fontWeight: '600' },
  durationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  durationText: { fontSize: 12, fontWeight: '600' },
  planDescription: { fontSize: 13, marginTop: 8 },
  planFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
    gap: 8,
  },
  planPrice: { fontSize: 24, fontWeight: '700' },
  planPriceNote: { fontSize: 12 },
  pastCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  pastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pastPlanName: { fontSize: 14 },
  pastStatus: { fontSize: 12, textTransform: 'capitalize' },
  pastDate: { fontSize: 12, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
  inputLabel: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  inputHint: { fontSize: 13, marginBottom: 12 },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  categoryChipText: { fontSize: 13 },
  autoRenewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  autoRenewTitle: { fontSize: 15, fontWeight: '500' },
  autoRenewDesc: { fontSize: 12, marginTop: 2 },
  pricingSummary: {
    padding: 16,
    borderRadius: 12,
  },
  pricingTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pricingLabel: { fontSize: 14 },
  pricingValue: { fontSize: 14 },
  pricingTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  pricingTotalLabel: { fontSize: 16, fontWeight: '600' },
  pricingTotalValue: { fontSize: 20, fontWeight: '700' },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  purchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  purchaseButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
