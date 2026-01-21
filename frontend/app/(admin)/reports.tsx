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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
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

interface RevenueData {
  period: string;
  gross_revenue_cents: number;
  platform_fees_cents: number;
  net_to_coaches_cents: number;
  booking_count: number;
}

// Simple Bar Chart Component
const BarChart = ({ 
  data, 
  valueKey, 
  labelKey, 
  color, 
  height = 150,
  formatValue = (v: number) => String(v),
  colors 
}: {
  data: any[];
  valueKey: string;
  labelKey: string;
  color: string;
  height?: number;
  formatValue?: (v: number) => string;
  colors: ThemeColors;
}) => {
  const maxValue = Math.max(...data.map(d => d[valueKey]), 1);
  
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 8 }}>
      {data.map((item, index) => {
        const barHeight = (item[valueKey] / maxValue) * (height - 30);
        return (
          <View key={index} style={{ alignItems: 'center', flex: 1, maxWidth: 80 }}>
            <Text style={{ fontSize: 10, color: colors.text, marginBottom: 4, fontWeight: '600' }}>
              {formatValue(item[valueKey])}
            </Text>
            <View 
              style={{ 
                width: '60%', 
                height: Math.max(barHeight, 4), 
                backgroundColor: color,
                borderRadius: 4,
                minWidth: 20,
              }} 
            />
            <Text style={{ fontSize: 9, color: colors.textMuted, marginTop: 4, textAlign: 'center' }}>
              {item[labelKey]}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// Donut/Pie Chart Component (simplified as circular progress)
const DonutChart = ({
  data,
  size = 120,
  colors: chartColors,
  themeColors,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  colors: string[];
  themeColors: ThemeColors;
}) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;
  
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, position: 'relative' }}>
        {/* Background circle */}
        <View style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: themeColors.border,
        }} />
        {/* Segments represented as overlapping progress bars */}
        {data.map((segment, index) => {
          const percentage = total > 0 ? (segment.value / total) * 100 : 0;
          const segmentColor = chartColors[index % chartColors.length];
          return (
            <View key={index} style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: size / 5,
              borderColor: 'transparent',
              borderTopColor: segmentColor,
              transform: [{ rotate: `${currentAngle}deg` }],
            }}>
              {(() => { currentAngle += (percentage / 100) * 360; return null; })()}
            </View>
          );
        })}
        {/* Center hole */}
        <View style={{
          position: 'absolute',
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size * 0.3,
          backgroundColor: themeColors.surface,
          top: size * 0.2,
          left: size * 0.2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.text }}>{total}</Text>
          <Text style={{ fontSize: 10, color: themeColors.textMuted }}>Total</Text>
        </View>
      </View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12, gap: 12 }}>
        {data.map((segment, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: chartColors[index % chartColors.length], marginRight: 4 }} />
            <Text style={{ fontSize: 11, color: themeColors.textMuted }}>{segment.label}: {segment.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Line Sparkline Component
const SparkLine = ({
  data,
  width = 100,
  height = 30,
  color,
}: {
  data: number[];
  width?: number;
  height?: number;
  color: string;
}) => {
  if (data.length < 2) return null;
  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((val - minVal) / range) * height,
  }));
  
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end' }}>
      {points.map((point, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: point.x - 2,
            top: point.y - 2,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      ))}
      {/* Simplified line as connected dots */}
      {points.slice(0, -1).map((point, i) => {
        const nextPoint = points[i + 1];
        const lineWidth = Math.sqrt(Math.pow(nextPoint.x - point.x, 2) + Math.pow(nextPoint.y - point.y, 2));
        const angle = Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) * 180 / Math.PI;
        return (
          <View
            key={`line-${i}`}
            style={{
              position: 'absolute',
              left: point.x,
              top: point.y,
              width: lineWidth,
              height: 2,
              backgroundColor: color,
              opacity: 0.5,
              transform: [{ rotate: `${angle}deg` }],
              transformOrigin: 'left center',
            }}
          />
        );
      })}
    </View>
  );
};

export default function AdminReportsScreen() {
  const { colors } = useTheme();
  const { token } = useAuth();
  const { t, formatNumber, formatCurrency } = useTranslation();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'categories' | 'revenue'>('overview');

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 1000 : isTablet ? 800 : undefined;

  const styles = getStyles(colors);

  // Chart colors
  const chartColors = [colors.primary, colors.success, colors.warning, colors.error, colors.accent];

  // State for API data
  const [stats, setStats] = useState({
    totalUsers: 0,
    paidUsers: 0,
    freemiumUsers: 0,
    totalTutors: 0,
    approvedTutors: 0,
    totalParents: 0,
    activeParents: 0,
    totalRevenue: 0,
    platformFees: 0,
    pendingPayouts: 0,
    totalBookings: 0,
    completedBookings: 0,
  });

  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load real data from new backend API endpoints
      const [overviewRes, trendsRes, categoriesRes, revenueRes] = await Promise.all([
        api.get('/admin/reports/overview', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
        api.get('/admin/reports/trends?period=monthly&num_periods=6', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
        api.get('/admin/reports/categories', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
        api.get('/admin/reports/revenue?period=monthly&num_periods=6', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: null })),
      ]);

      // Update stats from overview endpoint
      if (overviewRes.data?.stats) {
        const s = overviewRes.data.stats;
        setStats({
          totalUsers: s.total_users || 0,
          paidUsers: s.completed_bookings || 0, // Users with completed bookings
          freemiumUsers: (s.total_users || 0) - (s.completed_bookings || 0),
          totalTutors: s.total_tutors || 0,
          approvedTutors: s.approved_tutors || 0,
          totalParents: s.total_consumers || 0,
          activeParents: Math.round((s.total_consumers || 0) * 0.7), // Estimate
          totalRevenue: (s.total_revenue_cents || 0) / 100,
          platformFees: (s.platform_fees_cents || 0) / 100,
          pendingPayouts: (s.pending_payouts_cents || 0) / 100,
          totalBookings: s.total_bookings || 0,
          completedBookings: s.completed_bookings || 0,
        });
      }

      // Update trends from trends endpoint
      if (trendsRes.data?.trends) {
        const formattedTrends = trendsRes.data.trends.map((t: any) => ({
          period: t.period,
          tutors: t.new_tutors || 0,
          parents: t.new_consumers || 0,
          revenue: (t.revenue_cents || 0) / 100,
        }));
        setTrendData(formattedTrends);
      }

      // Update categories from categories endpoint
      if (categoriesRes.data?.categories) {
        const formattedCategories = categoriesRes.data.categories.map((c: any) => ({
          category: c.category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          tutors: c.tutors || 0,
          parents: c.consumers || 0,
          bookings: c.bookings || 0,
        }));
        setCategoryBreakdown(formattedCategories);
      }

      // Update revenue data from revenue endpoint
      if (revenueRes.data?.revenue) {
        setRevenueData(revenueRes.data.revenue);
      }
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
        <Text style={styles.sectionTitle}>{t('pages.admin.reports_page.user_distribution')}</Text>
        <View style={styles.distributionRow}>
          <View style={[styles.distributionCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.distributionValue, { color: colors.success }]}>{stats.paidUsers}</Text>
            <Text style={styles.distributionLabel}>{t('pages.admin.reports_page.paid_users')}</Text>
            <Text style={styles.distributionPercent}>
              {((stats.paidUsers / stats.totalUsers) * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={[styles.distributionCard, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.distributionValue, { color: colors.primary }]}>{stats.freemiumUsers}</Text>
            <Text style={styles.distributionLabel}>{t('pages.admin.reports_page.freemium_users')}</Text>
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
          <Text style={styles.statLabel}>{t('pages.admin.reports_page.total_coaches')}</Text>
          <Text style={[styles.statGrowth, { color: colors.success }]}>+16.7% {t('pages.admin.reports_page.wow')}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={styles.statValue}>{stats.approvedTutors}</Text>
          <Text style={styles.statLabel}>{t('pages.admin.reports_page.approved')}</Text>
          <Text style={[styles.statGrowth, { color: colors.success }]}>+20% {t('pages.admin.reports_page.wow')}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="person" size={24} color={colors.accent} />
          <Text style={styles.statValue}>{stats.totalParents}</Text>
          <Text style={styles.statLabel}>{t('pages.admin.reports_page.parents')}</Text>
          <Text style={[styles.statGrowth, { color: colors.success }]}>+8.5% {t('pages.admin.reports_page.wow')}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="heart" size={24} color={colors.error} />
          <Text style={styles.statValue}>{stats.activeParents}</Text>
          <Text style={styles.statLabel}>{t('pages.admin.reports_page.active')}</Text>
          <Text style={[styles.statGrowth, { color: colors.success }]}>+12.3% {t('pages.admin.reports_page.wow')}</Text>
        </View>
      </View>

      {/* Revenue Summary with Chart */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>{t('pages.admin.reports_page.revenue_summary')}</Text>
        <View style={styles.revenueRow}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>{t('pages.admin.reports_page.total_revenue')}</Text>
            <Text style={[styles.revenueValue, { color: colors.success }]}>${stats.totalRevenue.toLocaleString()}</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>{t('pages.admin.reports_page.platform_fees')}</Text>
            <Text style={[styles.revenueValue, { color: colors.primary }]}>${stats.platformFees.toLocaleString()}</Text>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>{t('pages.admin.reports_page.pending_payouts')}</Text>
            <Text style={[styles.revenueValue, { color: colors.accent }]}>${stats.pendingPayouts.toLocaleString()}</Text>
          </View>
        </View>
        
        {/* Revenue Chart */}
        {revenueData.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.chartTitle, { color: colors.textMuted }]}>{t('pages.admin.reports_page.monthly_revenue_chart')}</Text>
            <BarChart
              data={revenueData}
              valueKey="gross_revenue_cents"
              labelKey="period"
              color={colors.success}
              height={140}
              formatValue={(v) => `$${(v / 100).toFixed(0)}`}
              colors={colors}
            />
          </View>
        )}
      </View>

      {/* User Distribution Chart */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>{t('pages.admin.reports_page.user_breakdown_chart')}</Text>
        <DonutChart
          data={[
            { label: t('pages.admin.reports_page.coaches'), value: stats.totalTutors, color: colors.primary },
            { label: t('pages.admin.reports_page.parents'), value: stats.totalParents, color: colors.accent },
            { label: t('pages.admin.reports_page.paid_users'), value: stats.paidUsers, color: colors.success },
          ]}
          size={140}
          colors={chartColors}
          themeColors={colors}
        />
      </View>

      {/* Recommendations */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>💡 {t('pages.admin.reports_page.recommendations')}</Text>
        <View style={styles.recommendationCard}>
          <Ionicons name="trending-up" size={20} color={colors.success} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>{t('pages.admin.reports_page.increase_conversion')}</Text>
            <Text style={styles.recommendationText}>
              {t('pages.admin.reports_page.increase_conversion_desc')}
            </Text>
          </View>
        </View>
        <View style={styles.recommendationCard}>
          <Ionicons name="star" size={20} color={colors.accent} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>{t('pages.admin.reports_page.promote_categories')}</Text>
            <Text style={styles.recommendationText}>
              {t('pages.admin.reports_page.promote_categories_desc')}
            </Text>
          </View>
        </View>
        <View style={styles.recommendationCard}>
          <Ionicons name="cash" size={20} color={colors.primary} />
          <View style={styles.recommendationContent}>
            <Text style={styles.recommendationTitle}>{t('pages.admin.reports_page.freemium_conversion')}</Text>
            <Text style={styles.recommendationText}>
              {t('pages.admin.reports_page.freemium_conversion_desc')}
            </Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderTrends = () => {
    // Use real trend data from API, fallback to empty array
    const displayTrends = trendData.length > 0 ? trendData : [];
    
    return (
    <>
      {/* Monthly Trends from API */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>{t('pages.admin.reports_page.month_over_month')}</Text>
        {displayTrends.length === 0 ? (
          <Text style={styles.emptyText}>{t('pages.admin.reports_page.no_data')}</Text>
        ) : (
        <View style={styles.trendTable}>
          <View style={styles.trendHeader}>
            <Text style={[styles.trendHeaderCell, { flex: 1.5 }]}>{t('pages.admin.reports_page.period')}</Text>
            <Text style={styles.trendHeaderCell}>{t('pages.admin.coaches_page.title')}</Text>
            <Text style={styles.trendHeaderCell}>{t('pages.admin.reports_page.parents')}</Text>
            <Text style={styles.trendHeaderCell}>{t('pages.admin.reports_page.revenue')}</Text>
          </View>
          {displayTrends.map((trend, index) => (
            <View key={trend.period} style={styles.trendRow}>
              <Text style={[styles.trendCell, { flex: 1.5 }]}>{trend.period}</Text>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>{trend.tutors}</Text>
                {index > 0 && displayTrends[index - 1].tutors > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.tutors, displayTrends[index - 1].tutors)}
                  </Text>
                )}
              </View>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>{trend.parents}</Text>
                {index > 0 && displayTrends[index - 1].parents > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.parents, displayTrends[index - 1].parents)}
                  </Text>
                )}
              </View>
              <View style={styles.trendCellWithGrowth}>
                <Text style={styles.trendCell}>${trend.revenue}</Text>
                {index > 0 && displayTrends[index - 1].revenue > 0 && (
                  <Text style={[styles.trendGrowth, { color: colors.success }]}>
                    {calculateGrowth(trend.revenue, displayTrends[index - 1].revenue)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
        )}
      </View>

      {/* Projections */}
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>📊 {t('pages.admin.reports_page.projections')}</Text>
        <View style={styles.projectionsGrid}>
          <View style={styles.projectionCard}>
            <Text style={styles.projectionLabel}>Q1 2026 {t('pages.admin.reports_page.projected')}</Text>
            <Text style={[styles.projectionValue, { color: colors.primary }]}>$45,000</Text>
            <Text style={[styles.projectionGrowth, { color: colors.success }]}>+32% {t('pages.admin.reports_page.qoq')}</Text>
          </View>
          <View style={styles.projectionCard}>
            <Text style={styles.projectionLabel}>2026 {t('pages.admin.reports_page.annual_est')}</Text>
            <Text style={[styles.projectionValue, { color: colors.success }]}>$180,000</Text>
            <Text style={[styles.projectionGrowth, { color: colors.success }]}>+240% {t('pages.admin.reports_page.yoy')}</Text>
          </View>
        </View>
      </View>
    </>
  );
  };

  const renderCategories = () => (
    <View style={[styles.section, isTablet && styles.sectionTablet]}>
      <Text style={styles.sectionTitle}>{t('pages.admin.reports_page.category_breakdown')}</Text>
      {categoryBreakdown.length === 0 ? (
        <Text style={styles.emptyText}>{t('pages.admin.reports_page.no_data')}</Text>
      ) : (
      categoryBreakdown.map((cat) => (
        <View key={cat.category} style={styles.categoryRow}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryName}>{cat.category}</Text>
            <Text style={styles.categoryBookings}>{cat.bookings} {t('pages.admin.markets_page.bookings').toLowerCase()}</Text>
          </View>
          <View style={styles.categoryStats}>
            <View style={styles.categoryStat}>
              <Ionicons name="school" size={14} color={colors.primary} />
              <Text style={styles.categoryStatValue}>{cat.tutors}</Text>
              <Text style={styles.categoryStatLabel}>{t('pages.admin.markets_page.coaches').toLowerCase()}</Text>
            </View>
            <View style={styles.categoryStat}>
              <Ionicons name="people" size={14} color={colors.accent} />
              <Text style={styles.categoryStatValue}>{cat.parents}</Text>
              <Text style={styles.categoryStatLabel}>{t('pages.admin.reports_page.parents').toLowerCase()}</Text>
            </View>
            <View style={styles.categoryStat}>
              <Ionicons name="trending-up" size={14} color={colors.success} />
              <Text style={styles.categoryStatValue}>
                {categoryBreakdown.length > 0 ? ((cat.tutors / categoryBreakdown.reduce((sum, c) => sum + c.tutors, 0)) * 100).toFixed(0) : 0}%
              </Text>
              <Text style={styles.categoryStatLabel}>{t('pages.admin.reports_page.share')}</Text>
            </View>
          </View>
          <View style={styles.categoryBar}>
            <View
              style={[
                styles.categoryBarFill,
                {
                  width: `${categoryBreakdown[0]?.tutors > 0 ? (cat.tutors / categoryBreakdown[0].tutors) * 100 : 0}%`,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>
      ))
      )}
    </View>
  );

  const renderRevenue = () => (
    <>
      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>{t('pages.admin.reports_page.revenue_breakdown')}</Text>
        <View style={styles.revenueBreakdown}>
          <View style={styles.revenueBreakdownItem}>
            <View style={[styles.revenueIcon, { backgroundColor: colors.successLight }]}>
              <Ionicons name="arrow-down" size={20} color={colors.success} />
            </View>
            <View style={styles.revenueBreakdownInfo}>
              <Text style={styles.revenueBreakdownLabel}>{t('pages.admin.reports_page.total_received')}</Text>
              <Text style={[styles.revenueBreakdownValue, { color: colors.success }]}>$12,450</Text>
            </View>
          </View>
          <View style={styles.revenueBreakdownItem}>
            <View style={[styles.revenueIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="business" size={20} color={colors.primary} />
            </View>
            <View style={styles.revenueBreakdownInfo}>
              <Text style={styles.revenueBreakdownLabel}>{t('pages.admin.reports_page.platform_commission')}</Text>
              <Text style={[styles.revenueBreakdownValue, { color: colors.primary }]}>$1,867</Text>
            </View>
          </View>
          <View style={styles.revenueBreakdownItem}>
            <View style={[styles.revenueIcon, { backgroundColor: colors.accent + '30' }]}>
              <Ionicons name="arrow-up" size={20} color={colors.accent} />
            </View>
            <View style={styles.revenueBreakdownInfo}>
              <Text style={styles.revenueBreakdownLabel}>{t('pages.admin.reports_page.coach_payouts')}</Text>
              <Text style={[styles.revenueBreakdownValue, { color: colors.accent }]}>$10,583</Text>
            </View>
          </View>
          <View style={styles.revenueBreakdownItem}>
            <View style={[styles.revenueIcon, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="time" size={20} color={colors.error} />
            </View>
            <View style={styles.revenueBreakdownInfo}>
              <Text style={styles.revenueBreakdownLabel}>{t('pages.admin.reports_page.pending_payouts')}</Text>
              <Text style={[styles.revenueBreakdownValue, { color: colors.error }]}>$3,240</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.section, isTablet && styles.sectionTablet]}>
        <Text style={styles.sectionTitle}>{t('pages.admin.reports_page.top_earning_coaches')}</Text>
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
              <Text style={styles.topTutorSessions}>{tutor.sessions} {t('pages.admin.coaches_page.sessions')}</Text>
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
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>{t('pages.admin.reports_page.title')}</Text>
            <Text style={styles.subtitle}>{t('pages.admin.reports_page.subtitle')}</Text>
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
                  {t(`pages.admin.reports_page.${tab}`)}
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
