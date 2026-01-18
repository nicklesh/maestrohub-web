import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api, getBaseUrl } from '@/src/services/api';
import { format, parseISO } from 'date-fns';

interface TaxReport {
  report_id: string;
  user_id: string;
  user_type: string;
  report_type: string;
  report_year: number;
  report_month?: number;
  total_amount_cents: number;
  total_fees_cents?: number;
  total_payouts_cents?: number;
  transaction_count: number;
  generated_date: string;
  is_archived: boolean;
}

export default function TaxReportsScreen() {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { width } = useWindowDimensions();
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const isTablet = width >= 768;

  const loadData = useCallback(async () => {
    try {
      const [reportsRes, yearsRes] = await Promise.all([
        api.get('/tax-reports', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/tax-reports/available-years', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setReports(reportsRes.data.reports || []);
      setAvailableYears(yearsRes.data.years || []);
      if (yearsRes.data.current_year) {
        setCurrentYear(yearsRes.data.current_year);
      }
    } catch (error) {
      console.error('Failed to load tax reports:', error);
      showError('Failed to load tax reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateReport = async (year: number, reportType: string = 'annual') => {
    setGenerating(`${year}-${reportType}`);
    try {
      const response = await api.post(
        `/tax-reports/generate?year=${year}&report_type=${reportType}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        showSuccess(`Tax report for ${year} has been generated successfully!`);
        loadData();
      } else {
        showError(response.data.error || 'Failed to generate report');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to generate report. Please try again.';
      showError(errorMessage);
    } finally {
      setGenerating(null);
    }
  };

  const handleDownloadReport = async (report: TaxReport) => {
    setDownloading(report.report_id);
    try {
      const baseUrl = getBaseUrl();
      const downloadUrl = `${baseUrl}/tax-reports/${report.report_id}/download`;
      
      if (Platform.OS === 'web') {
        // Create a hidden link and trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `tax_report_${report.report_year}.pdf`);
        link.setAttribute('target', '_blank');
        
        // Add auth header via fetch and blob
        const response = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!response.ok) {
          throw new Error('Download failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        showSuccess('Report downloaded successfully!');
      } else {
        // For native, open in browser with auth
        await Linking.openURL(downloadUrl);
      }
    } catch (error: any) {
      showError('Failed to download report. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleRequestArchived = async (year: number) => {
    try {
      await api.post(
        `/tax-reports/request-archived?year=${year}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showInfo(`Your request for the ${year} archived report has been submitted. You'll be notified when it's ready in your inbox.`);
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to request archived report');
    }
  };

  const getReportsForYear = (year: number) => 
    reports.filter(r => r.report_year === year).sort((a, b) => 
      (b.report_month || 0) - (a.report_month || 0)
    );

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const getMonthName = (month: number) => {
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month] || '';
  };

  const renderReportItem = (report: TaxReport) => {
    const isDownloading = downloading === report.report_id;
    
    return (
      <View key={report.report_id} style={[styles.reportItem, { borderColor: colors.border }]}>
        <View style={styles.reportItemHeader}>
          <View style={styles.reportTypeContainer}>
            <Ionicons 
              name={report.report_type === 'annual_1099' ? 'document-text' : 'calendar'} 
              size={16} 
              color={colors.primary} 
            />
            <Text style={[styles.reportTypeText, { color: colors.text }]}>
              {report.report_type === 'annual_1099' 
                ? 'Annual 1099' 
                : `${getMonthName(report.report_month || 1)} Summary`}
            </Text>
          </View>
          <Text style={[styles.reportDate, { color: colors.textMuted }]}>
            {formatDate(report.generated_date)}
          </Text>
        </View>
        
        <View style={styles.reportStats}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Transactions</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{report.transaction_count}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Amount</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {formatAmount(report.total_amount_cents)}
            </Text>
          </View>
          {report.user_type === 'provider' && report.total_payouts_cents !== undefined && (
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Net Earnings</Text>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {formatAmount(report.total_payouts_cents)}
              </Text>
            </View>
          )}
        </View>
        
        {!report.is_archived ? (
          <TouchableOpacity
            style={[styles.downloadButton, { backgroundColor: colors.primary }]}
            onPress={() => handleDownloadReport(report)}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="download" size={16} color="#fff" />
                <Text style={styles.downloadText}>Download PDF</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.archivedBadge, { backgroundColor: colors.gray200 }]}>
            <Ionicons name="archive" size={14} color={colors.textMuted} />
            <Text style={[styles.archivedText, { color: colors.textMuted }]}>Archived</Text>
          </View>
        )}
      </View>
    );
  };

  const renderYearCard = ({ item: year }: { item: number }) => {
    const yearReports = getReportsForYear(year);
    const annualReport = yearReports.find(r => r.report_type === 'annual_1099');
    const isGenerating = generating === `${year}-annual`;
    const isArchived = year < (currentYear - 4);

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.yearContainer}>
            <Ionicons name="calendar" size={24} color={colors.primary} />
            <Text style={[styles.yearText, { color: colors.text }]}>{year}</Text>
          </View>
          {isArchived && (
            <View style={[styles.archivedYearBadge, { backgroundColor: colors.gray200 }]}>
              <Text style={[styles.archivedYearText, { color: colors.textMuted }]}>Archived</Text>
            </View>
          )}
        </View>

        {yearReports.length > 0 ? (
          <View style={styles.reportsContainer}>
            {yearReports.map(renderReportItem)}
          </View>
        ) : (
          <View style={styles.noReportContainer}>
            <Text style={[styles.noReportText, { color: colors.textMuted }]}>
              No reports generated for this year
            </Text>
            
            {!isArchived ? (
              <TouchableOpacity
                style={[
                  styles.generateButton, 
                  { backgroundColor: colors.primary },
                  isGenerating && styles.buttonDisabled
                ]}
                onPress={() => handleGenerateReport(year, 'annual')}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="document-text" size={18} color="#fff" />
                    <Text style={styles.generateText}>Generate Annual Report</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.requestButton, { borderColor: colors.primary }]}
                onPress={() => handleRequestArchived(year)}
              >
                <Ionicons name="mail" size={18} color={colors.primary} />
                <Text style={[styles.requestText, { color: colors.primary }]}>Request via Inbox</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {yearReports.length > 0 && !annualReport && !isArchived && (
          <TouchableOpacity
            style={[
              styles.generateMoreButton, 
              { borderColor: colors.primary },
              isGenerating && styles.buttonDisabled
            ]}
            onPress={() => handleGenerateReport(year, 'annual')}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={[styles.generateMoreText, { color: colors.primary }]}>
                  Generate Annual 1099
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title={t('pages.tax_reports.title')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title={t('pages.tax_reports.title')} />
      
      <View style={[styles.infoCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <Ionicons name="information-circle" size={24} color={colors.primary} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            {user?.role === 'provider' 
              ? 'Provider Tax Documents'
              : 'Payment Records'}
          </Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {user?.role === 'provider' 
              ? 'Generate 1099 equivalent forms for your coaching earnings. Reports for the last 5 years are available for download.'
              : 'Generate payment summaries for your educational expenses. Use these for tax deductions or record-keeping.'}
          </Text>
        </View>
      </View>

      <FlatList
        data={availableYears}
        renderItem={renderYearCard}
        keyExtractor={(item) => item.toString()}
        contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
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
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              Reports will appear here once you have payment transactions
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 18 },
  listContent: { padding: 16, paddingTop: 0 },
  listContentTablet: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  yearContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearText: { fontSize: 22, fontWeight: '700' },
  archivedYearBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  archivedYearText: { fontSize: 11, fontWeight: '600' },
  reportsContainer: { gap: 12 },
  reportItem: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  reportItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportTypeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reportTypeText: { fontSize: 14, fontWeight: '600' },
  reportDate: { fontSize: 12 },
  reportStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  statItem: {},
  statLabel: { fontSize: 11, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '600' },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  downloadText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  archivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  archivedText: { fontSize: 13, fontWeight: '500' },
  noReportContainer: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  noReportText: { fontSize: 14 },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  generateText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  generateMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 12,
  },
  generateMoreText: { fontWeight: '600', fontSize: 13 },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  requestText: { fontWeight: '600', fontSize: 14 },
  buttonDisabled: { opacity: 0.7 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
