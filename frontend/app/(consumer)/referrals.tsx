import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Share,
  useWindowDimensions,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Referral {
  referral_id: string;
  referred_id: string;
  referred_name: string;
  referred_email: string;
  status: string;
  referred_sessions_count: number;
  sessions_progress: string;
  created_at: string;
  referrer_reward_status: string;
}

interface ReferralStats {
  total_referrals: number;
  pending_referrals: number;
  rewarded_referrals: number;
  required_sessions: number;
}

interface Credits {
  free_session_credits: number;
  has_active_fee_waiver: boolean;
  fee_waiver_days_remaining: number;
}

export default function ReferralsScreen() {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [rewardType, setRewardType] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [credits, setCredits] = useState<Credits | null>(null);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;
  const isProvider = user?.role === 'provider' || user?.role === 'tutor';

  const loadData = useCallback(async () => {
    try {
      const [referralsRes, creditsRes] = await Promise.all([
        api.get('/referrals', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/referrals/credits', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      if (referralsRes.data.success !== false) {
        setReferralCode(referralsRes.data.referral_code || '');
        setStats(referralsRes.data.stats || null);
        setReferrals(referralsRes.data.referrals || []);
        setRewardType(referralsRes.data.reward_type || '');
        setRewardDescription(referralsRes.data.reward_description || '');
      }
      
      if (creditsRes.data.success !== false) {
        setCredits(creditsRes.data);
      }
    } catch (error) {
      console.error('Failed to load referrals:', error);
      showError('Failed to load referral data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(referralCode);
    showSuccess(t('pages.referrals.code_copied'));
  };

  const shareReferralCode = async () => {
    const message = isProvider
      ? `Join me on Maestro Habitat! Use my referral code ${referralCode} when you sign up. Find amazing tutors and coaches for your kids! 🎓`
      : `Join me on Maestro Habitat! Use my referral code ${referralCode} when you sign up. ${isProvider ? 'Start coaching and earn!' : 'Find amazing tutors and coaches for your kids!'} 🎓`;
    
    if (Platform.OS === 'web') {
      // On web, copy to clipboard and show message
      await Clipboard.setStringAsync(message);
      showSuccess(t('pages.referrals.share_message_copied'));
    } else {
      try {
        await Share.share({
          message,
          title: 'Join Maestro Habitat',
        });
      } catch (error: any) {
        // User cancelled - not an error
        if (error?.message !== 'User did not share') {
          showError('Failed to share');
        }
      }
    }
  };

  const handleApplyCode = async () => {
    if (!applyCode.trim()) {
      showError(t('forms.validation.enter_referral_code'));
      return;
    }
    
    setApplying(true);
    try {
      const response = await api.post(
        `/referrals/apply?code=${applyCode.trim().toUpperCase()}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      showSuccess(response.data.message || t('pages.referrals.code_applied_success'));
      setApplyCode('');
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.detail || t('pages.referrals.code_apply_failed'));
    } finally {
      setApplying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'rewarded':
        return { bg: colors.successLight, text: colors.success };
      case 'qualified':
        return { bg: colors.primaryLight, text: colors.primary };
      default:
        return { bg: colors.gray200, text: colors.textMuted };
    }
  };

  const renderReferralItem = ({ item }: { item: Referral }) => {
    const statusColor = getStatusColor(item.status);
    
    return (
      <View style={[styles.referralCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.referralHeader}>
          <View style={styles.referralUser}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {item.referred_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <View>
              <Text style={[styles.referralName, { color: colors.text }]}>{item.referred_name}</Text>
              <Text style={[styles.referralEmail, { color: colors.textMuted }]}>{item.referred_email}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        
        <View style={styles.progressContainer}>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>{t('pages.referrals.sessions_progress')}</Text>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, { backgroundColor: colors.gray200 }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.primary,
                    width: `${Math.min((item.referred_sessions_count / (stats?.required_sessions || 2)) * 100, 100)}%`
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: colors.text }]}>{item.sessions_progress}</Text>
          </View>
        </View>
        
        {item.status === 'rewarded' && (
          <View style={[styles.rewardBanner, { backgroundColor: colors.successLight }]}>
            <Ionicons name="gift" size={16} color={colors.success} />
            <Text style={[styles.rewardText, { color: colors.success }]}>{t('pages.referrals.reward_earned')}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title={t('pages.referrals.title')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title={t('pages.referrals.title')} />
      
      <FlatList
        data={referrals}
        renderItem={renderReferralItem}
        keyExtractor={(item) => item.referral_id}
        contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Your Reward Info */}
            <View style={[styles.card, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <View style={styles.rewardHeader}>
                <Ionicons name="gift" size={28} color={colors.primary} />
                <Text style={[styles.rewardTitle, { color: colors.text }]}>
                  {isProvider ? t('pages.referrals.provider_rewards') : t('pages.referrals.your_rewards')}
                </Text>
              </View>
              <Text style={[styles.rewardDesc, { color: colors.textSecondary }]}>
                {t('pages.referrals.earn_reward_desc')}
              </Text>
              
              {/* Credits Display */}
              {credits && (
                <View style={styles.creditsRow}>
                  {!isProvider && credits.free_session_credits > 0 && (
                    <View style={[styles.creditBadge, { backgroundColor: colors.success }]}>
                      <Ionicons name="star" size={16} color="#fff" />
                      <Text style={styles.creditText}>{credits.free_session_credits} {t('pages.referrals.free_sessions')}</Text>
                    </View>
                  )}
                  {isProvider && credits.has_active_fee_waiver && (
                    <View style={[styles.creditBadge, { backgroundColor: colors.success }]}>
                      <Ionicons name="shield-checkmark" size={16} color="#fff" />
                      <Text style={styles.creditText}>{credits.fee_waiver_days_remaining} {t('pages.referrals.days_fee_waiver')}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Your Referral Code */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('pages.referrals.your_referral_code')}</Text>
              <View style={styles.codeContainer}>
                <Text style={[styles.codeText, { color: colors.primary }]}>{referralCode}</Text>
                <View style={styles.codeActions}>
                  <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.gray200 }]} onPress={copyToClipboard}>
                    <Ionicons name="copy" size={20} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconButton, { backgroundColor: colors.primary }]} onPress={shareReferralCode}>
                    <Ionicons name="share-social" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Apply Referral Code */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('pages.referrals.have_code')}</Text>
              <View style={styles.applyContainer}>
                <TextInput
                  style={[styles.applyInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder={t('pages.referrals.enter_code')}
                  placeholderTextColor={colors.textMuted}
                  value={applyCode}
                  onChangeText={setApplyCode}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[styles.applyButton, { backgroundColor: colors.primary }]}
                  onPress={handleApplyCode}
                  disabled={applying}
                >
                  {applying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.applyButtonText}>{t('pages.referrals.apply')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Stats */}
            {stats && (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('pages.referrals.your_stats')}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>{stats.total_referrals}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('pages.referrals.total')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending_referrals}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('pages.referrals.pending')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { color: colors.success }]}>{stats.rewarded_referrals}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('pages.referrals.rewarded')}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Referrals Header */}
            {referrals.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.referrals.your_referrals')}</Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>{t('pages.referrals.no_referrals')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              {t('pages.referrals.no_referrals_desc')}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  listContentTablet: { maxWidth: 700, alignSelf: 'center', width: '100%' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  rewardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  rewardTitle: { fontSize: 18, fontWeight: '700' },
  rewardDesc: { fontSize: 14, lineHeight: 20 },
  creditsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  creditText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeText: { fontSize: 24, fontWeight: '700', letterSpacing: 2 },
  codeActions: { flexDirection: 'row', gap: 8 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyContainer: { flexDirection: 'row', gap: 12 },
  applyInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    letterSpacing: 1,
  },
  applyButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  referralCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralUser: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  referralName: { fontSize: 15, fontWeight: '600' },
  referralEmail: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  progressContainer: { marginTop: 4 },
  progressLabel: { fontSize: 12, marginBottom: 6 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 13, fontWeight: '600', minWidth: 35 },
  rewardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rewardText: { fontWeight: '600', fontSize: 13 },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 32 },
});
