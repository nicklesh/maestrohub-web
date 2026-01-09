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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useTheme } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
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

export default function BookingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    booked: { bg: colors.primaryLight, text: colors.primary },
    confirmed: { bg: colors.successLight, text: colors.success },
    completed: { bg: colors.gray200, text: colors.gray600 },
    canceled_by_consumer: { bg: colors.errorLight, text: colors.error },
    canceled_by_provider: { bg: colors.errorLight, text: colors.error },
  };

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;
  const numColumns = isDesktop ? 2 : 1;

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

  const renderBookingCard = ({ item, index }: { item: Booking; index: number }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.booked;
    const statusText = item.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    return (
      <TouchableOpacity
        style={[
          styles.bookingCard,
          isTablet && styles.bookingCardTablet,
          isDesktop && {
            marginRight: index % 2 === 0 ? 8 : 0,
            marginLeft: index % 2 === 1 ? 8 : 0,
            flex: 1,
          },
        ]}
        onPress={() => router.push(`/(consumer)/booking/${item.booking_id}`)}
      >
        <View style={styles.bookingHeader}>
          <View style={[styles.dateContainer, isTablet && styles.dateContainerTablet]}>
            <Text style={[styles.dateDay, isTablet && styles.dateDayTablet]}>{format(parseISO(item.start_at), 'dd')}</Text>
            <Text style={styles.dateMonth}>{format(parseISO(item.start_at), 'MMM')}</Text>
          </View>
          <View style={styles.bookingInfo}>
            <Text style={[styles.tutorName, isDesktop && styles.tutorNameDesktop]}>{item.tutor_name}</Text>
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
          <Text style={[styles.priceText, isDesktop && styles.priceTextDesktop]}>${item.price_snapshot}</Text>
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
      <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>My Bookings</Text>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.tabs, isTablet && styles.tabsTablet]}>
          <TouchableOpacity
            style={[styles.tab, isTablet && styles.tabTablet, filter === 'upcoming' && styles.tabActive]}
            onPress={() => setFilter('upcoming')}
          >
            <Text style={[styles.tabText, isTablet && styles.tabTextTablet, filter === 'upcoming' && styles.tabTextActive]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, isTablet && styles.tabTablet, filter === 'past' && styles.tabActive]}
            onPress={() => setFilter('past')}
          >
            <Text style={[styles.tabText, isTablet && styles.tabTextTablet, filter === 'past' && styles.tabTextActive]}>
              Past
            </Text>
          </TouchableOpacity>
        </View>

        {filteredBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={isTablet ? 80 : 64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, isDesktop && styles.emptyTitleDesktop]}>
              No {filter} bookings
            </Text>
            <Text style={[styles.emptyText, isDesktop && styles.emptyTextDesktop]}>
              {filter === 'upcoming'
                ? 'Book a tutor to get started!'
                : 'Your past bookings will appear here.'}
            </Text>
            {filter === 'upcoming' && (
              <TouchableOpacity
                style={[styles.ctaButton, isTablet && styles.ctaButtonTablet]}
                onPress={() => router.push('/(consumer)/search')}
              >
                <Text style={[styles.ctaButtonText, isTablet && styles.ctaButtonTextTablet]}>Find a Tutor</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredBookings}
            renderItem={renderBookingCard}
            keyExtractor={(item) => item.booking_id}
            contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
            numColumns={numColumns}
            key={numColumns}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
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
  contentWrapper: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  headerTablet: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  titleDesktop: {
    fontSize: 32,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  tabsTablet: {
    paddingHorizontal: 24,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabTablet: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
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
  tabTextTablet: {
    fontSize: 16,
  },
  tabTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  listContentTablet: {
    padding: 24,
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
  bookingCardTablet: {
    borderRadius: 20,
    padding: 20,
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
  dateContainerTablet: {
    width: 60,
    height: 60,
    borderRadius: 14,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  dateDayTablet: {
    fontSize: 22,
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
  tutorNameDesktop: {
    fontSize: 18,
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
  priceTextDesktop: {
    fontSize: 18,
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
  emptyTitleDesktop: {
    fontSize: 22,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTextDesktop: {
    fontSize: 16,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
  },
  ctaButtonTablet: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ctaButtonTextTablet: {
    fontSize: 18,
  },
});
