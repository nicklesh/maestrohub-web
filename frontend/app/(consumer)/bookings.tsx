import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';
import { format, parseISO, isPast } from 'date-fns';

interface Booking {
  booking_id: string;
  tutor_id: string;
  tutor_name: string;
  student_name: string;
  start_at: string;
  end_at: string;
  status: string;
  price_snapshot: number;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  booked: { bg: colors.primaryLight, text: colors.primary },
  confirmed: { bg: colors.successLight, text: colors.success },
  completed: { bg: colors.gray200, text: colors.gray600 },
  canceled_by_consumer: { bg: colors.errorLight, text: colors.error },
  canceled_by_provider: { bg: colors.errorLight, text: colors.error },
};

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const response = await api.get('/bookings?role=consumer');
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const filteredBookings = bookings.filter((b) => {
    const isUpcoming = !isPast(parseISO(b.start_at)) && !['completed', 'canceled_by_consumer', 'canceled_by_provider'].includes(b.status);
    return filter === 'upcoming' ? isUpcoming : !isUpcoming;
  });

  const renderBookingCard = ({ item }: { item: Booking }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.booked;
    const statusText = item.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => router.push(`/(consumer)/booking/${item.booking_id}`)}
      >
        <View style={styles.bookingHeader}>
          <View style={styles.dateContainer}>
            <Text style={styles.dateDay}>{format(parseISO(item.start_at), 'dd')}</Text>
            <Text style={styles.dateMonth}>{format(parseISO(item.start_at), 'MMM')}</Text>
          </View>
          <View style={styles.bookingInfo}>
            <Text style={styles.tutorName}>{item.tutor_name}</Text>
            <Text style={styles.studentName}>Student: {item.student_name}</Text>
            <Text style={styles.timeText}>
              {format(parseISO(item.start_at), 'h:mm a')} - {format(parseISO(item.end_at), 'h:mm a')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusText}</Text>
          </View>
        </View>
        <View style={styles.bookingFooter}>
          <Text style={styles.priceText}>${item.price_snapshot}</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, filter === 'upcoming' && styles.tabActive]}
          onPress={() => setFilter('upcoming')}
        >
          <Text style={[styles.tabText, filter === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'past' && styles.tabActive]}
          onPress={() => setFilter('past')}
        >
          <Text style={[styles.tabText, filter === 'past' && styles.tabTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {filteredBookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>
            No {filter} bookings
          </Text>
          <Text style={styles.emptyText}>
            {filter === 'upcoming'
              ? 'Book a tutor to get started!'
              : 'Your past bookings will appear here.'}
          </Text>
          {filter === 'upcoming' && (
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push('/(consumer)/search')}
            >
              <Text style={styles.ctaButtonText}>Find a Tutor</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          renderItem={renderBookingCard}
          keyExtractor={(item) => item.booking_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dateContainer: {
    width: 50,
    height: 50,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  dateMonth: {
    fontSize: 12,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  bookingInfo: {
    flex: 1,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  studentName: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  timeText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
  ctaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
