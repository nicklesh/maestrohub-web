import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Kid {
  student_id: string;
  name: string;
  age?: number;
  grade?: string;
  email?: string;
}

interface Booking {
  booking_id: string;
  start_at: string;
  duration_minutes: number;
  status: string;
  tutor_name: string;
  subject: string;
}

interface Payment {
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function KidDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [kid, setKid] = useState<Kid | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedule' | 'payments'>('schedule');
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  const loadData = useCallback(async () => {
    try {
      const [scheduleRes, paymentsRes] = await Promise.all([
        api.get(`/students/${id}/schedule`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        api.get(`/students/${id}/payments`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setKid(scheduleRes.data.student);
      setBookings(scheduleRes.data.bookings || []);
      setPayments(paymentsRes.data.payments || []);
      setTotalPaid(paymentsRes.data.total_paid || 0);
      setPendingAmount(paymentsRes.data.pending_amount || 0);
    } catch (error) {
      console.error('Failed to load kid data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredBookings = bookings.filter((booking) => {
    const bookingDate = new Date(booking.start_at);
    const now = new Date();
    
    // Filter based on booking date only
    // Upcoming: future date bookings (including canceled future bookings)
    // Past: past date bookings (including canceled past bookings)
    if (filter === 'upcoming') {
      return bookingDate >= now;
    }
    return bookingDate < now;
  });

  const getStatusDisplay = (status: string) => {
    if (status === 'canceled_by_consumer') return t('pages.bookings.cancelled');
    if (status === 'canceled_by_provider') return t('pages.bookings.cancelled');
    if (status === 'booked') return t('pages.bookings.booked');
    if (status === 'completed') return t('pages.bookings.completed');
    if (status === 'pending') return t('pages.bookings.pending');
    return status;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return colors.success;
      case 'completed': return colors.primary;
      case 'pending': return colors.warning;
      case 'cancelled': return colors.error;
      default: return colors.textMuted;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {/* Kid Header */}
        <View style={[styles.kidHeader, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{kid?.name?.charAt(0) || 'K'}</Text>
          </View>
          <View style={styles.kidInfo}>
            <Text style={[styles.kidName, { color: colors.text }]}>{kid?.name}</Text>
            {kid?.grade && (
              <Text style={[styles.kidGrade, { color: colors.textMuted }]}>{kid.grade}</Text>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>${totalPaid.toFixed(2)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('pages.kids.total_paid')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>${pendingAmount.toFixed(2)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('pages.kids.pending')}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{bookings.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('pages.kids.sessions')}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'schedule' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('schedule')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'schedule' ? colors.primary : colors.textMuted }]}>
              {t('pages.kids.schedule')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'payments' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('payments')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'payments' ? colors.primary : colors.textMuted }]}>
              {t('pages.kids.payments')}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'schedule' && (
          <>
            {/* Filter */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterBtn, filter === 'upcoming' && { backgroundColor: colors.primary }]}
                onPress={() => setFilter('upcoming')}
              >
                <Text style={[styles.filterText, { color: filter === 'upcoming' ? '#FFFFFF' : colors.text }]}>
                  {t('pages.kids.upcoming')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, filter === 'past' && { backgroundColor: colors.primary }]}
                onPress={() => setFilter('past')}
              >
                <Text style={[styles.filterText, { color: filter === 'past' ? '#FFFFFF' : colors.text }]}>
                  {t('pages.kids.past')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bookings List */}
            {filteredBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {filter === 'upcoming' ? t('pages.kids.no_upcoming_sessions') : t('pages.kids.no_past_sessions')}
                </Text>
              </View>
            ) : (
              filteredBookings.map((booking) => {
                const isCanceled = booking.status.includes('canceled');
                return (
                  <View key={booking.booking_id} style={[styles.bookingCard, { backgroundColor: colors.surface }, isCanceled && { opacity: 0.7 }]}>
                    <View style={styles.bookingHeader}>
                      <View>
                        <Text style={[styles.bookingSubject, { color: colors.text }]}>{booking.subject}</Text>
                        <Text style={[styles.bookingTutor, { color: colors.textMuted }]}>with {booking.tutor_name}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                        <Text style={[styles.statusText, { color: getStatusColor(booking.status) }]}>
                          {getStatusDisplay(booking.status)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.bookingFooter}>
                    <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.bookingTime, { color: colors.textMuted }]}>
                      {formatDate(booking.start_at)} · {booking.duration_minutes} min
                    </Text>
                  </View>
                </View>
                );
              })
            )}
          </>
        )}

        {activeTab === 'payments' && (
          <>
            {payments.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('pages.kid_detail.no_payments')}</Text>
              </View>
            ) : (
              payments.map((payment) => (
                <View key={payment.payment_id} style={[styles.paymentCard, { backgroundColor: colors.surface }]}>
                  <View style={styles.paymentRow}>
                    <View>
                      <Text style={[styles.paymentAmount, { color: colors.text }]}>
                        ${payment.amount.toFixed(2)}
                      </Text>
                      <Text style={[styles.paymentDate, { color: colors.textMuted }]}>
                        {formatDate(payment.created_at)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                        {payment.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  kidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '600', fontSize: 24 },
  kidInfo: { marginLeft: 16 },
  kidName: { fontSize: 20, fontWeight: '600' },
  kidGrade: { fontSize: 14, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4 },
  tabRow: {
    flexDirection: 'row',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterText: { fontSize: 13, fontWeight: '500' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: { fontSize: 14, marginTop: 12 },
  bookingCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bookingSubject: { fontSize: 16, fontWeight: '600' },
  bookingTutor: { fontSize: 13, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '500', textTransform: 'capitalize' },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  bookingTime: { fontSize: 13 },
  paymentCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentAmount: { fontSize: 18, fontWeight: '600' },
  paymentDate: { fontSize: 13, marginTop: 2 },
});
