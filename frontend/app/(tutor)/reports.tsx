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
import { useRouter } from 'expo-router';
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
  total_earned_cents: number;
  pending_cents: number;
  total_platform_fees_cents: number;
  currency: string;
  currency_symbol: string;
}

interface SponsorshipSummary {
  total_spent_cents: number;
  active_count: number;
  total_purchases: number;
  current_active: {
    plan_name: string;
    weeks: number;
    expires_at: string;
    categories: string[];
  } | null;
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

interface ByConsumer {
  consumer_id: string;
  consumer_name: string;
  consumer_email: string;
  status: string;
  total_sessions: number;
  month_sessions: number;
  rescheduled_sessions: number;
  canceled_sessions: number;
  total_spent_cents: number;
}

export default function TutorReportsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sponsorship, setSponsorship] = useState<SponsorshipSummary | null>(null);
  const [byStudent, setByStudent] = useState<ByStudent[]>([]);
  const [byConsumer, setByConsumer] = useState<ByConsumer[]>([]);
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
      setSponsorship(data.sponsorship);
      setByStudent(data.by_student || []);
      setByConsumer(data.by_consumer || []);
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
        link.download = `maestrohabitat_earnings_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        if (Platform.OS === 'web') {
          showError('Report downloaded successfully');
        } else {
          showSuccess('Report downloaded successfully');
        }
      } else {
        // For iOS/Android, download to file system and share
        const fileName = `maestrohabitat_earnings_${new Date().toISOString().split('T')[0]}.pdf`;
        const fileUri = FileSystem.documentDirectory + fileName;
        
        // Get the base URL from API config
        const baseUrl = api.defaults.baseURL || '';
        const downloadUrl = `${baseUrl}/reports/provider/pdf`;
        
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
              dialogTitle: 'Share Earnings Report',
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
            <View>
              <Text style={[styles.title, isDesktop && styles.titleDesktop]}>{t('pages.coach.reports.title')}</Text>
              <Text style={styles.subtitle}>{t('pages.coach.reports.subtitle')}</Text>
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
              <Text style={styles.summaryLabel}>{t('pages.coach.reports.total_earned')}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardWarning }]}>
              <Ionicons name="hourglass" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{formatCurrency(summary?.pending_cents || 0)}</Text>
              <Text style={styles.summaryLabel}>{t('pages.coach.reports.pending')}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardSuccess }]}>
              <Ionicons name="checkmark-circle" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.completed_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>{t('pages.coach.reports.completed')}</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardInfo }]}>
              <Ionicons name="time" size={28} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.upcoming_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>{t('pages.coach.reports.upcoming')}</Text>
            </View>
          </View>

          {/* By Student Section */}
          {byStudent.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('pages.coach.reports.by_student')}</Text>
              {byStudent.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <View style={styles.listItemLeft}>
                    <View style={[styles.avatar, { backgroundColor: '#8b5cf6' }]}>
                      <Text style={styles.avatarText}>{item.student_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.listItemName}>{item.student_name}</Text>
                      <Text style={styles.listItemSub}>{item.sessions} {t('pages.coach.reports.sessions')}</Text>
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
              <Text style={styles.sectionTitle}>{t('pages.coach.reports.monthly_earnings')}</Text>
              {byMonth.slice(0, 6).map((item, index) => (
                <View key={index} style={styles.monthItem}>
                  <Text style={styles.monthLabel}>{item.month}</Text>
                  <View style={styles.monthStats}>
                    <Text style={styles.monthSessions}>{item.sessions} {t('pages.coach.reports.sessions')}</Text>
                    <Text style={styles.monthAmount}>{formatCurrency(item.earned_cents)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Sponsorship Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('pages.coach.reports.sponsorship_advertising')}</Text>
              <View style={[styles.sectionBadge, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="megaphone" size={14} color={colors.warning} />
              </View>
            </View>
            
            {sponsorship && sponsorship.total_purchases > 0 ? (
              <>
                {/* Sponsorship Stats */}
                <View style={[styles.sponsorshipCard, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
                  <View style={styles.sponsorshipRow}>
                    <View style={styles.sponsorshipStat}>
                      <Ionicons name="cash-outline" size={24} color={colors.warning} />
                      <Text style={[styles.sponsorshipValue, { color: colors.text }]}>
                        {formatCurrency(sponsorship.total_spent_cents)}
                      </Text>
                      <Text style={[styles.sponsorshipLabel, { color: colors.textMuted }]}>{t('pages.coach.reports.total_spent')}</Text>
                    </View>
                    <View style={styles.sponsorshipStatDivider} />
                    <View style={styles.sponsorshipStat}>
                      <Ionicons name="receipt-outline" size={24} color={colors.primary} />
                      <Text style={[styles.sponsorshipValue, { color: colors.text }]}>
                        {sponsorship.total_purchases}
                      </Text>
                      <Text style={[styles.sponsorshipLabel, { color: colors.textMuted }]}>{t('pages.coach.reports.purchases')}</Text>
                    </View>
                    <View style={styles.sponsorshipStatDivider} />
                    <View style={styles.sponsorshipStat}>
                      <Ionicons name="checkmark-circle-outline" size={24} color={sponsorship.active_count > 0 ? colors.success : colors.textMuted} />
                      <Text style={[styles.sponsorshipValue, { color: sponsorship.active_count > 0 ? colors.success : colors.text }]}>
                        {sponsorship.active_count}
                      </Text>
                      <Text style={[styles.sponsorshipLabel, { color: colors.textMuted }]}>{t('pages.coach.reports.active_now')}</Text>
                    </View>
                  </View>
                  
                  {/* Current Active Sponsorship */}
                  {sponsorship.current_active && (
                    <View style={[styles.activeSponsorship, { backgroundColor: colors.success + '15', borderColor: colors.success }]}>
                      <View style={styles.activeSponsorshipHeader}>
                        <Ionicons name="star" size={18} color={colors.success} />
                        <Text style={[styles.activeSponsorshipTitle, { color: colors.success }]}>{t('pages.coach.reports.currently_active')}</Text>
                      </View>
                      <Text style={[styles.activeSponsorshipPlan, { color: colors.text }]}>
                        {sponsorship.current_active.plan_name} ({sponsorship.current_active.weeks} {t('pages.coach.sponsorship.weeks')})
                      </Text>
                      <Text style={[styles.activeSponsorshipExpires, { color: colors.textMuted }]}>
                        {t('pages.coach.sponsorship.expires')}: {new Date(sponsorship.current_active.expires_at).toLocaleDateString()}
                      </Text>
                      {sponsorship.current_active.categories.length > 0 && (
                        <View style={styles.activeSponsorshipCategories}>
                          {sponsorship.current_active.categories.map((cat, i) => (
                            <View key={i} style={[styles.categoryPill, { backgroundColor: colors.primary + '20' }]}>
                              <Text style={[styles.categoryPillText, { color: colors.primary }]}>{cat}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </>
            ) : (
              <View style={[styles.sponsorshipEmpty, { backgroundColor: colors.surface }]}>
                <Ionicons name="megaphone-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.sponsorshipEmptyTitle, { color: colors.text }]}>{t('pages.coach.reports.no_sponsorships')}</Text>
                <Text style={[styles.sponsorshipEmptyText, { color: colors.textMuted }]}>
                  {t('pages.coach.reports.boost_visibility')}
                </Text>
                <TouchableOpacity 
                  style={[styles.sponsorshipCTA, { backgroundColor: colors.warning }]}
                  onPress={() => router.push('/(tutor)/sponsorship')}
                >
                  <Text style={styles.sponsorshipCTAText}>{t('pages.coach.reports.get_sponsored')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

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
  // Sponsorship styles
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionBadge: {
    padding: 6,
    borderRadius: 8,
  },
  sponsorshipCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
  },
  sponsorshipRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  sponsorshipStat: {
    alignItems: 'center',
    flex: 1,
  },
  sponsorshipStatDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
  },
  sponsorshipValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  sponsorshipLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  activeSponsorship: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  activeSponsorshipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  activeSponsorshipTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeSponsorshipPlan: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeSponsorshipExpires: {
    fontSize: 13,
  },
  activeSponsorshipCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sponsorshipEmpty: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  sponsorshipEmptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  sponsorshipEmptyText: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  sponsorshipCTA: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  sponsorshipCTAText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
