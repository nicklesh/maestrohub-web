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
import { useTheme } from '@/src/context/ThemeContext';
import { api } from '@/src/services/api';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface ReportSummary {
  total_sessions: number;
  completed_sessions: number;
  upcoming_sessions: number;
  canceled_sessions: number;
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
    try {
      const response = await api.get('/reports/consumer/pdf', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      if (Platform.OS === 'web') {
        // Web: Create download link
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `maestrohub_report_${new Date().toISOString().split('T')[0]}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
      } else {
        // Native: Save and share
        const filename = `${FileSystem.documentDirectory}maestrohub_report.pdf`;
        await FileSystem.writeAsStringAsync(filename, response.data, {
          encoding: FileSystem.EncodingType.Base64
        });
        await Sharing.shareAsync(filename);
      }
      Alert.alert('Success', 'Report downloaded successfully');
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Reports</Text>
            <TouchableOpacity 
              style={[styles.downloadButton, { backgroundColor: colors.primary }, downloading && styles.downloadButtonDisabled]}
              onPress={downloadPDF}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color={colors.white} />
                  <Text style={styles.downloadButtonText}>PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View style={[styles.summaryGrid, isTablet && styles.summaryGridTablet]}>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardPrimary }]}>
              <Ionicons name="layers-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.total_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>Total Sessions</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardSuccess }]}>
              <Ionicons name="checkmark-done-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.completed_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardWarning }]}>
              <Ionicons name="hourglass-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{summary?.upcoming_sessions || 0}</Text>
              <Text style={styles.summaryLabel}>Upcoming</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardInfo }]}>
              <Ionicons name="receipt-outline" size={24} color={colors.white} />
              <Text style={styles.summaryValue}>{formatCurrency(summary?.total_spent_cents || 0)}</Text>
              <Text style={styles.summaryLabel}>Total Spent</Text>
            </View>
          </View>

          {/* By Tutor Section */}
          {byTutor.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Sessions by Tutor</Text>
              {byTutor.map((item, index) => (
                <View key={index} style={[styles.listItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.listItemLeft}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                      <Text style={styles.avatarText}>{item.tutor_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={[styles.listItemName, { color: colors.text }]}>{item.tutor_name}</Text>
                      <Text style={[styles.listItemSub, { color: colors.textMuted }]}>{item.sessions} sessions</Text>
                    </View>
                  </View>
                  <Text style={[styles.listItemAmount, { color: colors.primary }]}>{formatCurrency(item.spent_cents)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* By Student Section */}
          {byStudent.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Sessions by Student</Text>
              {byStudent.map((item, index) => (
                <View key={index} style={[styles.listItem, { borderBottomColor: colors.border }]}>
                  <View style={styles.listItemLeft}>
                    <View style={[styles.avatar, { backgroundColor: '#8b5cf6' }]}>
                      <Text style={styles.avatarText}>{item.student_name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={[styles.listItemName, { color: colors.text }]}>{item.student_name}</Text>
                      <Text style={[styles.listItemSub, { color: colors.textMuted }]}>{item.sessions} sessions</Text>
                    </View>
                  </View>
                  <Text style={[styles.listItemAmount, { color: colors.primary }]}>{formatCurrency(item.spent_cents)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Monthly Breakdown */}
          {byMonth.length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Monthly Breakdown</Text>
              {byMonth.slice(0, 6).map((item, index) => (
                <View key={index} style={[styles.monthItem, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.monthLabel, { color: colors.text }]}>{item.month}</Text>
                  <View style={styles.monthStats}>
                    <Text style={[styles.monthSessions, { color: colors.textMuted }]}>{item.sessions} sessions</Text>
                    <Text style={[styles.monthAmount, { color: colors.primary }]}>{formatCurrency(item.spent_cents)}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
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
  },
  listItemSub: {
    fontSize: 12,
    marginTop: 1,
  },
  listItemAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  monthLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  monthStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monthSessions: {
    fontSize: 12,
  },
  monthAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
});
