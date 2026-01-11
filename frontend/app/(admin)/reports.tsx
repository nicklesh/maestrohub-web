import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useAuth } from '@/src/context/AuthContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface TrendData {
  period: string;
  tutors: number;
  parents: number;
  revenue: number;
}

interface CategoryBreakdown {
  category: string;
  tutors: number;
  parents: number;
  bookings: number;
}

export default function AdminReportsScreen() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'categories' | 'revenue'>('overview');

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 1000 : isTablet ? 800 : undefined;

  const styles = getStyles(colors);

  // Mock data - In production, these would come from API
  const [stats, setStats] = useState({
    totalUsers: 156,
    paidUsers: 42,
    freemiumUsers: 114,
    totalTutors: 28,
    approvedTutors: 22,
    totalParents: 128,
    activeParents: 89,
    totalRevenue: 12450,
    platformFees: 1867,
    pendingPayouts: 3240,
  });

  const [weeklyTrends] = useState<TrendData[]>([
    { period: 'Week 1', tutors: 18, parents: 95, revenue: 2100 },
    { period: 'Week 2', tutors: 20, parents: 108, revenue: 2890 },
    { period: 'Week 3', tutors: 24, parents: 118, revenue: 3450 },
    { period: 'Week 4', tutors: 28, parents: 128, revenue: 4010 },
  ]);

  const [monthlyTrends] = useState<TrendData[]>([
    { period: 'Oct', tutors: 12, parents: 65, revenue: 5200 },
    { period: 'Nov', tutors: 18, parents: 89, revenue: 7800 },
    { period: 'Dec', tutors: 24, parents: 112, revenue: 9600 },
    { period: 'Jan', tutors: 28, parents: 128, revenue: 12450 },
  ]);

  const [categoryBreakdown] = useState<CategoryBreakdown[]>([
    { category: 'Academic', tutors: 12, parents: 85, bookings: 156 },
    { category: 'STEM', tutors: 8, parents: 42, bookings: 89 },
    { category: 'Languages', tutors: 5, parents: 38, bookings: 67 },
    { category: 'Arts & Music', tutors: 3, parents: 28, bookings: 34 },
    { category: 'Sports', tutors: 2, parents: 18, bookings: 22 },
    { category: 'Life Skills', tutors: 1, parents: 12, bookings: 15 },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load real data from API
      const [tutorsRes, analyticsRes] = await Promise.all([
        api.get('/admin/tutors', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        api.get('/admin/analytics/markets', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { markets: [] } })),
      ]);

      const tutors = tutorsRes.data || [];
      const analytics = analyticsRes.data;
      
      // Calculate real stats from API data
      const approvedCount = tutors.filter((t: any) => t.status === 'approved').length;
      const totalRevenue = analytics.markets?.reduce((sum: number, m: any) => sum + (m.total_revenue_cents || 0), 0) || 0;
      
      setStats(prev => ({
        ...prev,
        totalTutors: tutors.length,
        approvedTutors: approvedCount,
        totalRevenue: totalRevenue / 100,
        platformFees: (totalRevenue / 100) * 0.15,
      }));
    } catch (error) {
      console.error('Failed to load reports data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const calculateGrowth = (current: number, previous: number) => {
    if (previous === 0) return '+100%';
    const growth = ((current - previous) / previous) * 100;
    return growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
  };

  const renderOverview = () => (
    <>
      {/* User Distribution */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>User Distribution</Text>
        <View style={styles.distributionRow}>
          <View style={[styles.distributionCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.distributionValue, { color: colors.success }]}>{stats.paidUsers}</Text>
            <Text style={styles.distributionLabel}>Paid Users</Text>
            <Text style={styles.distributionPercent}>
              {((stats.paidUsers / stats.totalUsers) * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={[styles.distributionCard, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.distributionValue, { color: colors.primary }]}>{stats.freemiumUsers}</Text>
            <Text style={styles.distributionLabel}>Freemium Users</Text>
            <Text style={styles.distributionPercent}>
              {((stats.freemiumUsers / stats.totalUsers) * 100).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Stats Grid */}
      <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
        <View style={styles.statCard}>
          <Ionicons name="people" size={24} color={colors.primary} />
          <Text style={styles.statValue}>{stats.totalTutors}</Text>
          <Text style={styles.statLabel}>Total Coaches</Text>
          <Text style={[styles.statGrowth, { color: colors.success }]}>+16.7% WoW</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.statValue}>{stats.approvedTutors}</Text>
          <Text style={styles.statLabel}>Approved</Text>
          <Text style={[styles.statGrowth, { color: colors.success }]}>+20% WoW</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="person" size={24} color={colors.accent} />
          <Text style={styles.statValue}>{stats.totalParents}</Text>
          <Text style={styles.statLabel}>Parents</Text>
          <Text style={[styles.statGrowth, { color: colors.success }]}>+8.5% WoW</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="heart" size={24} color={colors.error} />
          <Text style={styles.statValue}>{stats.activeParents}</Text>
          <Text style={styles.statLabel}>Active</Text>
          <Text style={[styles.statGrowth, { color: colors.success }]}>+12.3% WoW</Text>
        </View>
      </View>

      {/* Revenue Summary */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>Revenue Summary</Text>
        <View style={styles.revenueRow}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Total Revenue</Text>
            <Text style={[styles.revenueValue, { color: colors.success }]}>${stats.totalRevenue.toLocaleString()}</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Platform Fees (15%)</Text>
            <Text style={[styles.revenueValue, { color: colors.primary }]}>${stats.platformFees.toLocaleString()}</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Pending Payouts</Text>
            <Text style={[styles.revenueValue, { color: colors.accent }]}>${stats.pendingPayouts.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* Recommendations */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>💡 Recommendations</Text>
        <View style={styles.recommendationCard}>
          <Ionicons name="trending-up" size={20} color={colors.success} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>Increase Coach Conversion</Text>
            <Text style={styles.recommendationText}>
              27% of pending tutors haven't completed profiles. Send reminder emails to boost completion rate.
            </Text>
          </View>
        </View>
        <View style={styles.recommendationCard}>
          <Ionicons name="star" size={20} color={colors.accent} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>Promote Top Categories</Text>
            <Text style={styles.recommendationText}>
              Academic tutoring has highest demand. Consider marketing campaigns to attract more tutors.
            </Text>
          </View>
        </View>
        <View style={styles.recommendationCard}>
          <Ionicons name="cash" size={20} color={colors.primary} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>Freemium to Paid Conversion</Text>
            <Text style={styles.recommendationText}>
              73% users are freemium. Offer limited-time discounts to convert to paid subscriptions.
            </Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderTrends = () => (
    <>
      {/* Weekly Trends */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>Week over Week (WoW)</Text>
        <View style={styles.trendTable}>
          <View style={styles.trendHeader}>
            <Text style={[styles.trendHeaderCell, { flex: 1.5 }]}>Period</Text>
            <Text style={styles.trendHeaderCell}>Tutors</Text>
            <Text style={styles.trendHeaderCell}>Parents</Text>
            <Text style={styles.trendHeaderCell}>Revenue</Text>
          </View>
          {weeklyTrends.map((trend, index) => (
            <View key={trend.period} style={styles.trendRow}>
              <Text style={[styles.trendCell, { flex: 1.5 }]}>{trend.period}</Text>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>{trend.tutors}</Text>
                {index > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.tutors, weeklyTrends[index - 1].tutors)}
                  </Text>
                )}
              </View>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>{trend.parents}</Text>
                {index > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.parents, weeklyTrends[index - 1].parents)}
                  </Text>
                )}
              </View>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>${trend.revenue}</Text>
                {index > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.revenue, weeklyTrends[index - 1].revenue)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Monthly Trends */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>Month over Month (MoM)</Text>
        <View style={styles.trendTable}>
          <View style={styles.trendHeader}>
            <Text style={[styles.trendHeaderCell, { flex: 1.5 }]}>Month</Text>
            <Text style={styles.trendHeaderCell}>Tutors</Text>
            <Text style={styles.trendHeaderCell}>Parents</Text>
            <Text style={styles.trendHeaderCell}>Revenue</Text>
          </View>
          {monthlyTrends.map((trend, index) => (
            <View key={trend.period} style={styles.trendRow}>
              <Text style={[styles.trendCell, { flex: 1.5 }]}>{trend.period}</Text>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>{trend.tutors}</Text>
                {index > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.tutors, monthlyTrends[index - 1].tutors)}
                  </Text>
                )}
              </View>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>{trend.parents}</Text>
                {index > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.parents, monthlyTrends[index - 1].parents)}
                  </Text>
                )}
              </View>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>${trend.revenue}</Text>
                {index > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.revenue, monthlyTrends[index - 1].revenue)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Projections */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>📊 Projections (QoQ & YoY)</Text>
        <View style={styles.projectionsGrid}>
          <View style={styles.projectionCard}>
            <Text style={styles.projectionLabel}>Q1 2026 (Projected)</Text>
            <Text style={[styles.projectionValue, { color: colors.primary }]}>$45,000</Text>
            <Text style={[styles.projectionGrowth, { color: colors.success }]}>+32% QoQ</Text>
          </View>
          <View style={styles.projectionCard}>
            <Text style={styles.projectionLabel}>2026 Annual (Est.)</Text>
            <Text style={[styles.projectionValue, { color: colors.success }]}>$180,000</Text>
            <Text style={[styles.projectionGrowth, { color: colors.success }]}>+240% YoY</Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderCategories = () => (
    <View style={[styles.section, isTablet && styles.sectionTablet]}>
      <Text style={styles.sectionTitle}>Category Breakdown</Text>
      {categoryBreakdown.map((cat) => (
        <View key={cat.category} style={styles.categoryRow}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryName}>{cat.category}</Text>
            <Text style={styles.categoryBookings}>{cat.bookings} bookings</Text>
          </View>
          <View style={styles.categoryStats}>
            <View style={styles.categoryStat}>
              <Ionicons name="school" size={14} color={colors.primary} />
              <Text style={styles.categoryStatValue}>{cat.tutors}</Text>
              <Text style={styles.categoryStatLabel}>tutors</Text>
            </View>
            <View style={styles.categoryStat}>
              <Ionicons name="people" size={14} color={colors.accent} />
              <Text style={styles.categoryStatValue}>{cat.parents}</Text>
              <Text style={styles.categoryStatLabel}>parents</Text>
            </View>
            <View style={styles.categoryStat}>
              <Ionicons name="trending-up" size={14} color={colors.success} />
              <Text style={styles.categoryStatValue}>
                {((cat.bookings / categoryBreakdown.reduce((sum, c) => sum + c.bookings, 0)) * 100).toFixed(0)}%
              </Text>
              <Text style={styles.categoryStatLabel}>share</Text>
            </View>
          </View>
          <View style={styles.categoryBar}>
            <View
              style={[
                styles.categoryBarFill,
                {
                  width: `${(cat.bookings / categoryBreakdown[0].bookings) * 100}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );

  const renderRevenue = () => (
    <>
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>Revenue Breakdown</Text>
        <View style={styles.revenueBreakdown}>
          <View style={styles.revenueBreakdownItem}>
            <View style={[styles.revenueIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="arrow-down" size={20} color={colors.success} />
            </View>
            <View style={styles.revenueBreakdownInfo}>
              <Text style={styles.revenueBreakdownLabel}>Total Received</Text>
              <Text style={[styles.revenueBreakdownValue, { color: colors.success }]}>$12,450</Text>
            </View>
          </View>
          <View style={styles.revenueBreakdownItem}>
            <View style={[styles.revenueIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="business" size={20} color={colors.primary} />
            </View>
            <View style={styles.revenueBreakdownInfo}>
              <Text style={styles.revenueBreakdownLabel}>Platform Commission</Text>
              <Text style={[styles.revenueBreakdownValue, { color: colors.primary }]}>$1,867</Text>
            </View>
          </View>
          <View style={styles.revenueBreakdownItem}>
            <View style={[styles.revenueIcon, { backgroundColor: colors.accent + '30' }]}>
              <Ionicons name="arrow-up" size={20} color={colors.accent} />
            </View>
            <View style={styles.revenueBreakdownInfo}>
              <Text style={styles.revenueBreakdownLabel}>Coach Payouts</Text>
              <Text style={[styles.revenueBreakdownValue, { color: colors.accent }]}>$10,583</Text>
            </View>
          </View>
          <View style={styles.revenueBreakdownItem}>
            <View style={[styles.revenueIcon, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="time" size={20} color={colors.error} />
            </View>
            <View style={styles.revenueBreakdownInfo}>
              <Text style={styles.revenueBreakdownLabel}>Pending Payouts</Text>
              <Text style={[styles.revenueBreakdownValue, { color: colors.error }]}>$3,240</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>Top Earning Coaches</Text>
        {[
          { name: 'Emily T.', earnings: 2450, sessions: 42 },
          { name: 'Michael S.', earnings: 1890, sessions: 35 },
          { name: 'Sarah K.', earnings: 1650, sessions: 28 },
          { name: 'David L.', earnings: 1420, sessions: 24 },
          { name: 'Jessica M.', earnings: 1180, sessions: 21 },
        ].map((tutor, index) => (
          <View key={tutor.name} style={styles.topTutorRow}>
            <Text style={styles.topTutorRank}>#{index + 1}</Text>
            <View style={styles.topTutorAvatar}>
              <Text style={styles.topTutorAvatarText}>{tutor.name.charAt(0)}</Text>
            </View>
            <View style={styles.topTutorInfo}>
              <Text style={styles.topTutorName}>{tutor.name}</Text>
              <Text style={styles.topTutorSessions}>{tutor.sessions} sessions</Text>
            </View>
            <Text style={styles.topTutorEarnings}>${tutor.earnings.toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBack={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack={false} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Reports & Analytics</Text>
            <Text style={styles.subtitle}>Platform performance and insights</Text>
          </View>

          {/* Tab Navigation */}
          <View style={styles.tabRow}>
            {(['overview', 'trends', 'categories', 'revenue'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'trends' && renderTrends()}
          {activeTab === 'categories' && renderCategories()}
          {activeTab === 'revenue' && renderRevenue()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  scrollContentTablet: { padding: 32 },
  contentWrapper: { flex: 1 },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  titleDesktop: { fontSize: 28 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  tabRow: { flexDirection: 'row', marginBottom: 20, gap: 8, flexWrap: 'wrap' },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '500', color: colors.text },
  tabTextActive: { color: '#FFFFFF' },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTablet: { borderRadius: 20, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 16 },
  distributionRow: { flexDirection: 'row', gap: 12 },
  distributionCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  distributionValue: { fontSize: 28, fontWeight: 'bold' },
  distributionLabel: { fontSize: 13, color: colors.text, marginTop: 4 },
  distributionPercent: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  statsGridTablet: { gap: 16 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: 24, fontWeight: 'bold', color: colors.text, marginTop: 8 },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  statGrowth: { fontSize: 11, fontWeight: '500', marginTop: 4 },
  revenueRow: { flexDirection: 'row' },
  revenueItem: { flex: 1, alignItems: 'center' },
  revenueDivider: { width: 1, backgroundColor: colors.border },
  revenueLabel: { fontSize: 12, color: colors.textMuted },
  revenueValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  recommendationContent: { flex: 1 },
  recommendationTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  recommendationText: { fontSize: 13, color: colors.textMuted, marginTop: 4, lineHeight: 18 },
  trendTable: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, overflow: 'hidden' },
  trendHeader: { flexDirection: 'row', backgroundColor: colors.background, padding: 12 },
  trendHeaderCell: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
  trendRow: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: colors.border },
  trendCell: { flex: 1, fontSize: 14, color: colors.text, textAlign: 'center' },
  trendCellWithGrowth: { flex: 1, alignItems: 'center' },
  trendGrowth: { fontSize: 10, marginTop: 2 },
  projectionsGrid: { flexDirection: 'row', gap: 12 },
  projectionCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  projectionLabel: { fontSize: 12, color: colors.textMuted },
  projectionValue: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  projectionGrowth: { fontSize: 12, fontWeight: '500', marginTop: 4 },
  categoryRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  categoryName: { fontSize: 15, fontWeight: '600', color: colors.text },
  categoryBookings: { fontSize: 13, color: colors.textMuted },
  categoryStats: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  categoryStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryStatValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  categoryStatLabel: { fontSize: 12, color: colors.textMuted },
  categoryBar: { height: 6, backgroundColor: colors.gray200, borderRadius: 3 },
  categoryBarFill: { height: '100%', borderRadius: 3 },
  revenueBreakdown: { gap: 12 },
  revenueBreakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  revenueIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revenueBreakdownInfo: { flex: 1 },
  revenueBreakdownLabel: { fontSize: 13, color: colors.textMuted },
  revenueBreakdownValue: { fontSize: 18, fontWeight: 'bold' },
  topTutorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  topTutorRank: { fontSize: 14, fontWeight: '600', color: colors.textMuted, width: 24 },
  topTutorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTutorAvatarText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  topTutorInfo: { flex: 1 },
  topTutorName: { fontSize: 14, fontWeight: '500', color: colors.text },
  topTutorSessions: { fontSize: 12, color: colors.textMuted },
  topTutorEarnings: { fontSize: 16, fontWeight: '700', color: colors.success },
});
