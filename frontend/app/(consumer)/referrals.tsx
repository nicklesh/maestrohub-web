import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Share,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Referral {
  referral_id: string;
  referred_id: string;
  referred_role: string;
  status: string;
  sessions_completed: number;
  reward_type: string;
  reward_applied: boolean;
  created_at: string;
  qualified_at?: string;
}

interface ReferralStats {
  total: number;
  pending: number;
  qualified: number;
  sessions_required: number;
}

export default function ReferralsScreen() {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referralCode, setReferralCode] = useState('');
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingCode, setApplyingCode] = useState(false);
  const [inputCode, setInputCode] = useState('');

  const shareUrl = 'https://www.maestrohabitat.com';
  const shareMessage = `Join me on Maestro Habitat! Use my referral code: ${referralCode}`;

  const loadData = useCallback(async () => {
    try {
      const [referralsRes, codeRes, creditsRes] = await Promise.all([
        api.get('/referrals', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/referrals/code', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/referrals/credits', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setReferrals(referralsRes.data.referrals || []);
      setStats(referralsRes.data.stats || null);
      setReferralCode(codeRes.data.referral_code || '');
      setCredits(creditsRes.data.total_free_sessions || 0);
    } catch (error) {
      console.error('Failed to load referrals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApplyCode = async () => {
    if (!inputCode.trim()) {
      Alert.alert('Error', 'Please enter a referral code');
      return;
    }
    setApplyingCode(true);
    try {
      await api.post(`/referrals/apply?code=${inputCode.trim()}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Success', 'Referral code applied! Complete 2 sessions to earn rewards.');
      setInputCode('');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Invalid referral code');
    } finally {
      setApplyingCode(false);
    }
  };

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: 'Join Maestro Habitat', text: shareMessage, url: shareUrl });
        } else {
          await navigator.clipboard.writeText(`${shareMessage}\n${shareUrl}`);
          Alert.alert('Copied!', 'Referral link copied to clipboard');
        }
      } else {
        await Share.share({ message: `${shareMessage}\n${shareUrl}` });
      }
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'rewarded': return colors.success;
      case 'qualified': return colors.success;
      case 'pending': return colors.warning;
      default: return colors.textMuted;
    }
  };

  const renderReferral = ({ item }: { item: Referral }) => (
    <View style={[styles.referralCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.referralHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="person" size={20} color={colors.primary} />
        </View>
        <View style={styles.referralInfo}>
          <Text style={[styles.referralRole, { color: colors.text }]}>
            {item.referred_role === 'consumer' ? 'Parent' : 'Coach'}
          </Text>
          <Text style={[styles.referralDate, { color: colors.textMuted }]}>
            Joined {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View style={[
            styles.progressFill,
            { backgroundColor: colors.primary, width: `${(item.sessions_completed / 2) * 100}%` }
          ]} />
        </View>
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {item.sessions_completed}/2 sessions completed
        </Text>
      </View>
      {item.reward_applied && (
        <View style={[styles.rewardBadge, { backgroundColor: colors.successLight }]}>
          <Ionicons name="gift" size={16} color={colors.success} />
          <Text style={[styles.rewardText, { color: colors.success }]}>Reward earned!</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title="Referrals" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title="Referrals" />
      
      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="people" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.primary }]}>{stats?.total || 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Referrals</Text>
        </View>
        {user?.role === 'consumer' && (
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Ionicons name="gift" size={24} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.success }]}>{credits}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Free Sessions</Text>
          </View>
        )}
      </View>

      {/* Your Code */}
      <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.codeLabel, { color: colors.textMuted }]}>Your Referral Code</Text>
        <View style={styles.codeRow}>
          <Text style={[styles.codeText, { color: colors.text }]}>{referralCode}</Text>
          <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.primary }]} onPress={handleShare}>
            <Ionicons name="share-social" size={18} color="#fff" />
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.rewardInfo, { color: colors.textMuted }]}>
          {user?.role === 'consumer' 
            ? '🎁 Earn 1 FREE session when your referral completes 2 paid sessions!'
            : '🎁 Earn 1 month fee waiver when your referral completes 2 paid sessions!'}
        </Text>
      </View>

      {/* Apply Code */}
      <View style={[styles.applyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.applyLabel, { color: colors.text }]}>Have a referral code?</Text>
        <View style={styles.applyRow}>
          <TextInput
            style={[styles.codeInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter code"
            placeholderTextColor={colors.textMuted}
            value={inputCode}
            onChangeText={setInputCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.applyButton, { backgroundColor: colors.primary }, applyingCode && styles.buttonDisabled]}
            onPress={handleApplyCode}
            disabled={applyingCode}
          >
            {applyingCode ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.applyText}>Apply</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Referrals List */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Referrals</Text>
      <FlatList
        data={referrals}
        renderItem={renderReferral}
        keyExtractor={(item) => item.referral_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No referrals yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Share your code to start earning!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  codeCard: { margin: 16, marginTop: 0, padding: 16, borderRadius: 12, borderWidth: 1 },
  codeLabel: { fontSize: 12, fontWeight: '500', marginBottom: 8 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeText: { fontSize: 24, fontWeight: '700', letterSpacing: 2 },
  shareButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, gap: 6 },
  shareText: { color: '#fff', fontWeight: '600' },
  rewardInfo: { fontSize: 13, marginTop: 12, lineHeight: 18 },
  applyCard: { margin: 16, marginTop: 0, padding: 16, borderRadius: 12, borderWidth: 1 },
  applyLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  applyRow: { flexDirection: 'row', gap: 12 },
  codeInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  applyButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, justifyContent: 'center' },
  applyText: { color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  sectionTitle: { fontSize: 17, fontWeight: '600', paddingHorizontal: 16, marginBottom: 8 },
  listContent: { padding: 16, paddingTop: 0 },
  referralCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  referralHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  referralInfo: { flex: 1, marginLeft: 12 },
  referralRole: { fontSize: 15, fontWeight: '600' },
  referralDate: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  progressContainer: { gap: 6 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12 },
  rewardBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, padding: 8, borderRadius: 8 },
  rewardText: { fontSize: 13, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 14, marginTop: 4 },
});
