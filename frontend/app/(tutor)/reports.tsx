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
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';
import Constants from 'expo-constants';

interface ReportSummary {
  total_sessions: number;
  completed_sessions: number;
  upcoming_sessions: number;
  canceled_sessions: number;
  total_earned_cents: number;
  pending_cents: number;
  total_platform_fees_cents: number;
  currency: string;
  currency_symbol: string;
}

interface ByStudent {
  student_id: string;
  student_name: string;
  sessions: number;
  earned_cents: number;
}

interface ByMonth {
  month: string;
  sessions: number;
  earned_cents: number;
}

export default function TutorReportsScreen() {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [byStudent, setByStudent] = useState<ByStudent[]>([]);
  const [byMonth, setByMonth] = useState<ByMonth[]>([]);

  const containerMaxWidth = isDesktop ? 1200 : isTablet ? 900 : undefined;

  const fetchReport = async () => {
    try {
      const response = await api.get('/reports/provider', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      setSummary(data.summary);
      setByStudent(data.by_student || []);
      setByMonth(data.by_month || []);
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReport();
  };

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const backendUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '';
      const pdfUrl = `${backendUrl}/api/reports/provider/pdf`;
      
      await Linking.openURL(pdfUrl);
    } catch (error) {
      Alert.alert('Error', 'Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    if (!summary) return '';
    return `${summary.currency_symbol}${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Earnings Report</Text>
              <Text style={styles.subtitle}>Track your sessions and payouts</Text>
            </View>
            <TouchableOpacity 
              style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
              onPress={downloadPDF}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color={colors.white} />
                  <Text style={styles.downloadButtonText}>PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={[styles.summaryGrid, isTablet && styles.summaryGridTablet]}>
            <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
              <Ionicons name="cash" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{formatCurrency(summary?.total_earned_cents || 0)}</Text>
              <Text style={styles.summaryLabel}>Total Earned</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardWarning]}>
              <Ionicons name="hourglass" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{formatCurrency(summary?.pending_cents || 0)}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardSuccess]}>
              <Ionicons name="checkmark-circle" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.completed_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={[styles.summaryCard, styles.summaryCardInfo]}>
              <Ionicons name="time" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.upcoming_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>Upcoming</Text>
            </View>
          </View>

          {/* Platform Fees Info */}
          <View style={styles.feeInfoCard}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={styles.feeInfoText}>
              Platform fees: {formatCurrency(summary?.total_platform_fees_cents || 0)} ({((summary?.total_platform_fees_cents || 0) / Math.max(((summary?.total_earned_cents || 0) + (summary?.total_platform_fees_cents || 0)), 1) * 100).toFixed(0)}%)
            </Text>
          </View>

          {/* By Student Section */}
          {byStudent.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Earnings by Student</Text>
              {byStudent.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.student_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.listItemName}>{item.student_name}</Text>
                      <Text style={styles.listItemSub}>{item.sessions} sessions</Text>
                    </View>
                  </View>
                  <Text style={styles.listItemAmount}>{formatCurrency(item.earned_cents)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Monthly Breakdown */}
          {byMonth.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Monthly Earnings</Text>
              {byMonth.slice(0, 6).map((item, index) => (
                <View key={index} style={styles.monthItem}>
                  <Text style={styles.monthLabel}>{item.month}</Text>
                  <View style={styles.monthStats}>
                    <Text style={styles.monthSessions}>{item.sessions} sessions</Text>
                    <Text style={styles.monthAmount}>{formatCurrency(item.earned_cents)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Empty State */}
          {!byStudent.length && !byMonth.length && (
            <View style={styles.emptyState}>
              <Ionicons name="bar-chart-outline" size={64} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No data yet</Text>
              <Text style={styles.emptyText}>Complete sessions to see your earnings report</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    padding: 16,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  titleDesktop: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  summaryGridTablet: {
    gap: 16,
  },
  summaryCard: {
    flex: 1,
    minWidth: 150,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryCardPrimary: {
    backgroundColor: colors.primary,
  },
  summaryCardSuccess: {
    backgroundColor: '#10b981',
  },
  summaryCardWarning: {
    backgroundColor: '#f59e0b',
  },
  summaryCardInfo: {
    backgroundColor: '#6366f1',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.white,
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  feeInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  feeInfoText: {
    fontSize: 13,
    color: colors.primary,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  listItemSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  listItemAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
  },
  monthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  monthStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  monthSessions: {
    fontSize: 13,
    color: colors.textMuted,
  },
  monthAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});
