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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useAuth } from '@/src/context/AuthContext';
import AppHeader from '@/src/components/AppHeader';

interface MarketStats {
  published_tutors: number;
  consumers: number;
  total_bookings: number;
  total_revenue: number;
}

interface Market {
  market_id: string;
  country: string;
  currency: string;
  currency_symbol: string;
  default_timezone: string;
  is_enabled: boolean;
  min_price: number;
  max_price: number;
  stats: MarketStats;
}

interface MarketAnalytics {
  market_id: string;
  market_name: string;
  currency: string;
  supply: {
    published_tutors: number;
    pending_tutors: number;
    active_tutors_with_availability: number;
  };
  demand: {
    total_consumers: number;
  };
  bookings: {
    total: number;
    completed: number;
    canceled: number;
    completion_rate: number;
  };
  revenue: {
    total: number;
    currency: string;
  };
}

const FLAG_EMOJI: Record<string, string> = {
  US: '🇺🇸',
  IN: '🇮🇳',
};

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  IN: 'India',
};

export default function AdminMarketsScreen() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, MarketAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;

  const styles = getStyles(colors);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [marketsRes, analyticsRes] = await Promise.all([
        api.get('/admin/markets', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/admin/analytics/markets', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setMarkets(marketsRes.data.markets);
      setAnalytics(analyticsRes.data.analytics);
    } catch (error) {
      console.error('Failed to load markets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleMarket = async (marketId: string) => {
    try {
      await api.post(`/admin/markets/${marketId}/toggle`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if (Platform.OS === 'web') {
        window.alert('Market toggle logged. Server restart required to apply changes.');
      } else {
        Alert.alert('Market Toggle', 'Market toggle logged. Server restart required to apply changes.');
      }
      loadData();
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('Failed to toggle market');
      } else {
        Alert.alert('Error', 'Failed to toggle market');
      }
    }
  };

  const renderMarketCard = (market: Market) => {
    const marketAnalytics = analytics[market.market_id];
    const isSelected = selectedMarket === market.market_id;

    return (
      <View key={market.market_id} style={[styles.marketCard, isTablet && styles.marketCardTablet]}>
        {/* Header */}
        <TouchableOpacity
          style={styles.marketHeader}
          onPress={() => setSelectedMarket(isSelected ? null : market.market_id)}
        >
          <Text style={styles.flag}>{FLAG_EMOJI[market.country] || '🌍'}</Text>
          <View style={styles.marketInfo}>
            <Text style={[styles.marketName, isDesktop && styles.marketNameDesktop]}>
              {COUNTRY_NAMES[market.country] || market.country}
            </Text>
            <Text style={styles.marketMeta}>
              {market.currency_symbol} {market.currency} • {market.default_timezone}
            </Text>
          </View>
          <View style={[styles.statusBadge, market.is_enabled ? styles.statusEnabled : styles.statusDisabled]}>
            <Text style={[styles.statusText, { color: market.is_enabled ? colors.success : colors.error }]}>
              {market.is_enabled ? 'Active' : 'Disabled'}
            </Text>
          </View>
          <Ionicons name={isSelected ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>
              {market.stats?.published_tutors || 0}
            </Text>
            <Text style={styles.statLabel}>Tutors</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>
              {market.stats?.consumers || 0}
            </Text>
            <Text style={styles.statLabel}>Consumers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>
              {market.stats?.total_bookings || 0}
            </Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={[styles.statItem, { borderRightWidth: 0 }]}>
            <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>
              {market.currency_symbol}{(market.stats?.total_revenue || 0).toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>

        {/* Expanded Analytics */}
        {isSelected && marketAnalytics && (
          <View style={[styles.analyticsSection, isTablet && styles.analyticsSectionTablet]}>
            <Text style={styles.analyticsSectionTitle}>Supply</Text>
            <View style={styles.analyticsGrid}>
              <View style={styles.analyticsItem}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.analyticsLabel}>Published</Text>
                <Text style={styles.analyticsValue}>{marketAnalytics.supply.published_tutors}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Ionicons name="time" size={18} color={colors.accent} />
                <Text style={styles.analyticsLabel}>Pending</Text>
                <Text style={styles.analyticsValue}>{marketAnalytics.supply.pending_tutors}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <Text style={styles.analyticsLabel}>With Availability</Text>
                <Text style={styles.analyticsValue}>{marketAnalytics.supply.active_tutors_with_availability}</Text>
              </View>
            </View>

            <Text style={styles.analyticsSectionTitle}>Bookings</Text>
            <View style={styles.analyticsGrid}>
              <View style={styles.analyticsItem}>
                <Ionicons name="checkmark-done" size={18} color={colors.success} />
                <Text style={styles.analyticsLabel}>Completed</Text>
                <Text style={styles.analyticsValue}>{marketAnalytics.bookings.completed}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Ionicons name="close-circle" size={18} color={colors.error} />
                <Text style={styles.analyticsLabel}>Canceled</Text>
                <Text style={styles.analyticsValue}>{marketAnalytics.bookings.canceled}</Text>
              </View>
              <View style={styles.analyticsItem}>
                <Ionicons name="stats-chart" size={18} color={colors.primary} />
                <Text style={styles.analyticsLabel}>Rate</Text>
                <Text style={styles.analyticsValue}>{marketAnalytics.bookings.completion_rate}%</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleToggleMarket(market.market_id)}
              >
                <Ionicons name={market.is_enabled ? 'pause' : 'play'} size={18} color={colors.primary} />
                <Text style={styles.actionButtonText}>{market.is_enabled ? 'Disable' : 'Enable'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

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
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Markets</Text>
            <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
              Manage regions and view market analytics
            </Text>
          </View>

          {/* Info Card */}
          <View style={[styles.infoCard, isTablet && styles.infoCardTablet]}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Market Rules</Text>
              <Text style={styles.infoText}>
                • Consumers see tutors only from their selected market{'\n'}
                • Providers are assigned to a market based on payout country{'\n'}
                • Cross-market bookings are currently disabled
              </Text>
            </View>
          </View>

          {/* Markets List */}
          {markets.map(renderMarketCard)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  scrollContentTablet: {
    padding: 32,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  titleDesktop: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  subtitleDesktop: {
    fontSize: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoCardTablet: {
    borderRadius: 16,
    padding: 20,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  marketCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  marketCardTablet: {
    borderRadius: 20,
  },
  marketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  flag: {
    fontSize: 32,
    backgroundColor: '#1E3A5F',
    width: 48,
    height: 48,
    textAlign: 'center',
    lineHeight: 48,
    borderRadius: 8,
    overflow: 'hidden',
  },
  marketInfo: {
    flex: 1,
  },
  marketName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  marketNameDesktop: {
    fontSize: 18,
  },
  marketMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusEnabled: {
    backgroundColor: colors.successLight,
  },
  statusDisabled: {
    backgroundColor: colors.errorLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  statValueDesktop: {
    fontSize: 18,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  analyticsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    backgroundColor: colors.background,
  },
  analyticsSectionTablet: {
    padding: 20,
  },
  analyticsSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  analyticsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  analyticsItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  analyticsLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  analyticsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
