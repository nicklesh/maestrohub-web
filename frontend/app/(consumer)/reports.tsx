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
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

interface ReportSummary {
  total_sessions: number;
  completed_sessions: number;
  upcoming_sessions: number;
  canceled_sessions: number;
  rescheduled_sessions: number;
  canceled_amount_cents: number;
  total_spent_cents: number;
  currency: string;
  currency_symbol: string;
}

interface ByTutor {
  tutor_id: string;
  tutor_name: string;
  sessions: number;
  spent_cents: number;
}

interface ByStudent {
  student_id: string;
  student_name: string;
  sessions: number;
  spent_cents: number;
}

interface ByMonth {
  month: string;
  sessions: number;
  spent_cents: number;
}

export default function ConsumerReportsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [byTutor, setByTutor] = useState<ByTutor[]>([]);
  const [byStudent, setByStudent] = useState<ByStudent[]>([]);
  const [byMonth, setByMonth] = useState<ByMonth[]>([]);

  const containerMaxWidth = isDesktop ? 1200 : isTablet ? 900 : undefined;
  const styles = getStyles(colors);

  const fetchReport = async () => {
    try {
      const response = await api.get('/reports/consumer', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = response.data;
      setSummary(data.summary);
      setByTutor(data.by_tutor || []);
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
    const lang = locale === 'hi_IN' ? 'hi' : 'en';
    try {
      if (Platform.OS === 'web') {
        // Use fetch with authorization header for authenticated download
        const response = await api.get(`/reports/consumer/pdf?lang=${lang}`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });
        
        // Create blob and download
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `maestrohabitat_report_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        if (Platform.OS === 'web') {
          showSuccess(t('pages.reports.download_success'));
        } else {
          showSuccess(t('pages.reports.download_success'));
        }
      } else {
        // For iOS/Android, download to file system and share
        const fileName = `maestrohabitat_report_${new Date().toISOString().split('T')[0]}.pdf`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        // Get the base URL from API config
        const baseUrl = api.defaults.baseURL || '';
        const downloadUrl = `${baseUrl}/reports/consumer/pdf?lang=${lang}`;
        
        // Download the file with authorization
        const downloadResult = await FileSystem.downloadAsync(
          downloadUrl,
          fileUri,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        if (downloadResult.status === 200) {
          // Check if sharing is available
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(downloadResult.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Share Report',
              UTI: 'com.adobe.pdf',
            });
          } else {
            showInfo(`Report saved to ${fileName}`, 'Success');
          }
        } else {
          throw new Error('Download failed');
        }
      }
    } catch (error) {
      console.error('PDF download error:', error);
      if (Platform.OS === 'web') {
        showError('Failed to download report. Please try again.');
      } else {
        showError('Failed to download report. Please try again.');
      }
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
            <Text style={[styles.title, { color: colors.text }]}>{t('pages.reports.title')}</Text>
            <TouchableOpacity 
              style={[styles.downloadButton, downloading && styles.downloadButtonDisabled]}
              onPress={downloadPDF}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={colors.white} />
                  <Text style={styles.downloadButtonText}>{t('pages.reports.download_pdf')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={[styles.summaryGrid, isTablet && styles.summaryGridTablet]}>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardPrimary }]}>
              <Ionicons name="layers-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.total_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>{t('pages.reports.total_sessions')}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardSuccess }]}>
              <Ionicons name="checkmark-done-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.completed_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>{t('pages.reports.completed')}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardWarning }]}>
              <Ionicons name="hourglass-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.upcoming_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>{t('pages.reports.upcoming')}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardInfo }]}>
              <Ionicons name="receipt-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{formatCurrency(summary?.total_spent_cents || 0)}</Text>
              <Text style={styles.summaryLabel}>{t('pages.reports.total_spent')}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.warning || '#FB8C00' }]}>
              <Ionicons name="refresh-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.rescheduled_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>{t('pages.reports.rescheduled') || 'Rescheduled'}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.error || '#EF4444' }]}>
              <Ionicons name="close-circle-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.canceled_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>{t('pages.reports.cancelled') || 'Cancelled'}</Text>
            </View>
          </View>

          {/* By Tutor Section */}
          {byTutor.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('pages.reports.sessions_by_coach')}</Text>
              {byTutor.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.avatarText}>{item.tutor_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.listItemName}>{item.tutor_name}</Text>
                      <Text style={styles.listItemSub}>{item.sessions} {t('pages.reports.sessions')}</Text>
                    </View>
                  </View>
                  <Text style={styles.listItemAmount}>{formatCurrency(item.spent_cents)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* By Student Section */}
          {byStudent.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('pages.reports.sessions_by_student')}</Text>
              {byStudent.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <View style={[styles.avatar, { backgroundColor: '#8b5cf6' }]}>
                      <Text style={styles.avatarText}>{item.student_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.listItemName}>{item.student_name}</Text>
                      <Text style={styles.listItemSub}>{item.sessions} {t('pages.reports.sessions')}</Text>
                    </View>
                  </View>
                  <Text style={styles.listItemAmount}>{formatCurrency(item.spent_cents)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Monthly Breakdown */}
          {byMonth.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('pages.reports.monthly_breakdown')}</Text>
              {byMonth.slice(0, 6).map((item, index) => (
                <View key={index} style={styles.monthItem}>
                  <Text style={styles.monthLabel}>{item.month}</Text>
                  <View style={styles.monthStats}>
                    <Text style={styles.monthSessions}>{item.sessions} {t('pages.reports.sessions')}</Text>
                    <Text style={styles.monthAmount}>{formatCurrency(item.spent_cents)}</Text>
                  </View>
                </View>
              ))}
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
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  downloadButtonDisabled: {
    opacity: 0.6,
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  summaryGridTablet: {
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 6,
  },
  summaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    color: colors.text,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  listItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  listItemSub: {
    fontSize: 12,
    marginTop: 1,
    color: colors.textMuted,
  },
  listItemAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  monthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  monthStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthSessions: {
    fontSize: 12,
    color: colors.textMuted,
  },
  monthAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
