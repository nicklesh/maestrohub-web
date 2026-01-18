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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface TaxReport {
  report_id: string;
  year: number;
  market_id: string;
  status: string;
  report_type: string;
  total_amount: number;
  currency: string;
  file_url?: string;
  generated_at?: string;
}

export default function TaxReportsScreen() {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [reportsRes, yearsRes] = await Promise.all([
        api.get('/tax-reports', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/tax-reports/available-years', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setReports(reportsRes.data.reports || []);
      setAvailableYears(yearsRes.data.years || []);
    } catch (error) {
      console.error('Failed to load tax reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRequestReport = async (year: number) => {
    setGenerating(year);
    try {
      await api.post(`/tax-reports/request?year=${year}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Alert.alert('Success', `Tax report for ${year} is being generated. You'll be notified when it's ready.`);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to request report');
    } finally {
      setGenerating(null);
    }
  };

  const getReportForYear = (year: number) => reports.find(r => r.year === year);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return colors.success;
      case 'generating': return colors.warning;
      case 'pending': return colors.warning;
      case 'failed': return colors.error;
      default: return colors.textMuted;
    }
  };

  const getCurrencySymbol = (currency: string) => currency === 'INR' ? '₹' : '$';

  const renderYearCard = ({ item: year }: { item: number }) => {
    const report = getReportForYear(year);
    const isGenerating = generating === year;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.yearContainer}>
            <Ionicons name="calendar" size={24} color={colors.primary} />
            <Text style={[styles.yearText, { color: colors.text }]}>{year}</Text>
          </View>
          {report && (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(report.status) }]}>
                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {report ? (
          <View style={styles.reportDetails}>
            <Text style={[styles.reportType, { color: colors.textSecondary }]}>
              {report.report_type}
            </Text>
            {report.status === 'ready' && (
              <>
                <Text style={[styles.amount, { color: colors.text }]}>
                  Total: {getCurrencySymbol(report.currency)}{report.total_amount.toLocaleString()}
                </Text>
                <TouchableOpacity
                  style={[styles.downloadButton, { backgroundColor: colors.primary }]}
                  onPress={() => Alert.alert('Download', 'Report download will be available soon')}
                >
                  <Ionicons name="download" size={18} color="#fff" />
                  <Text style={styles.downloadText}>Download PDF</Text>
                </TouchableOpacity>
              </>
            )}
            {report.status === 'generating' && (
              <View style={styles.generatingRow}>
                <ActivityIndicator size="small" color={colors.warning} />
                <Text style={[styles.generatingText, { color: colors.textMuted }]}>
                  Generating report...
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noReportContainer}>
            <Text style={[styles.noReportText, { color: colors.textMuted }]}>
              No report generated yet
            </Text>
            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: colors.primary }, isGenerating && styles.buttonDisabled]}
              onPress={() => handleRequestReport(year)}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-text" size={18} color="#fff" />
                  <Text style={styles.generateText}>Generate Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title="Tax Reports" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title="Tax Reports" />
      
      <View style={[styles.infoCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <Ionicons name="information-circle" size={24} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.text }]}>
          {user?.role === 'tutor' 
            ? 'Generate 1099-NEC forms for your coaching earnings.'
            : 'Generate payment summaries for your records.'}
        </Text>
      </View>

      <FlatList
        data={availableYears}
        renderItem={renderYearCard}
        keyExtractor={(item) => item.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No tax years available</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  listContent: { padding: 16, paddingTop: 0 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  yearContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearText: { fontSize: 20, fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  reportDetails: { gap: 8 },
  reportType: { fontSize: 14 },
  amount: { fontSize: 16, fontWeight: '600' },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  downloadText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  generatingText: { fontSize: 14 },
  noReportContainer: { alignItems: 'center', gap: 12 },
  noReportText: { fontSize: 14 },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  generateText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  buttonDisabled: { opacity: 0.7 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, marginTop: 16 },
});
