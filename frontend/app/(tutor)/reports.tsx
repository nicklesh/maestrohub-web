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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';
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
  const { colors } = useTheme();
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
  const styles = getStyles(colors);

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
      if (Platform.OS === 'web') {
        // Use fetch with authorization header for authenticated download
        const response = await api.get('/reports/provider/pdf', {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        
        // Create blob and download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `maestrohub_earnings_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        Alert.alert('Success', 'Report downloaded successfully');
      } else {
        // For mobile, show info about web availability
        Alert.alert('Info', 'PDF download is available in the web version. Please use the web app to download reports.');
      }
    } catch (error) {
      console.error('PDF download error:', error);
      Alert.alert('Error', 'Failed to download report. Please try again.');
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
        <AppHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <AppHeader />
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
            <View style={[styles.summaryCard, { backgroundColor: colors.cardPrimary }]}>
              <Ionicons name="cash" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{formatCurrency(summary?.total_earned_cents || 0)}</Text>
              <Text style={styles.summaryLabel}>Total Earned</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardWarning }]}>
              <Ionicons name="hourglass" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{formatCurrency(summary?.pending_cents || 0)}</Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardSuccess }]}>
              <Ionicons name="checkmark-circle" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.completed_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardInfo }]}>
              <Ionicons name="time" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.upcoming_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>Upcoming</Text>
            </View>
          </View>

          {/* By Student Section */}
          {byStudent.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Earnings by Student</Text>
              {byStudent.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <View style={[styles.avatar, { backgroundColor: '#8b5cf6' }]}>
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
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.success,
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
    color: colors.success,
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
