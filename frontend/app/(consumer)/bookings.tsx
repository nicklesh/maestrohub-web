import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { format, parseISO, isPast } from 'date-fns';

interface KidNotification {
  notification_id: string;
  notification_type: string;
  sent_to: string;
  sent_at: string;
  status: string;
}

interface Booking {
  booking_id: string;
  tutor_id: string;
  tutor_name: string;
  student_name: string;
  start_at: string;
  end_at: string;
  status: string;
  price_snapshot: number;
  currency?: string;
  currency_symbol?: string;
  kid_notifications?: KidNotification[];
}

export default function BookingsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'booked':
        return { bg: colors.primaryLight, text: colors.primary };
      case 'confirmed':
        return { bg: colors.successLight, text: colors.success };
      case 'completed':
        return { bg: colors.gray200, text: colors.gray600 };
      case 'canceled_by_consumer':
      case 'canceled_by_provider':
        return { bg: colors.errorLight, text: colors.error };
      default:
        return { bg: colors.gray200, text: colors.gray600 };
    }
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
      setBookings(response.data || []);
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

  const filteredBookings = bookings.filter((booking) => {
    const bookingDate = parseISO(booking.start_at);
    const isBookingPast = isPast(bookingDate);
    
    // Filter based on booking date only
    // Upcoming: future date bookings (including canceled future bookings)
    // Past: past date bookings (including canceled past bookings)
    if (filter === 'upcoming') {
      return !isBookingPast;
    }
    return isBookingPast;
  });

  const getStatusDisplay = (status: string) => {
    if (status === 'canceled_by_consumer') return 'Canceled by you';
    if (status === 'canceled_by_provider') return 'Canceled by coach';
    return status.replace(/_/g, ' ');
  };

  const renderBookingCard = ({ item }: { item: Booking }) => {
    const statusColors = getStatusColors(item.status);
    const startDate = parseISO(item.start_at);
    const endDate = parseISO(item.end_at);
    const isCanceled = item.status.includes('canceled');
    const currencySymbol = item.currency_symbol || '$';
    const hasKidNotifications = item.kid_notifications && item.kid_notifications.length > 0;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isTablet && styles.cardTablet,
          isDesktop && { flex: 0.48, marginHorizontal: 4 },
          isCanceled && { opacity: 0.7 }
        ]}
        onPress={() => router.push(`/(consumer)/booking/${item.booking_id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {getStatusDisplay(item.status)}
              </Text>
            </View>
            {hasKidNotifications && (
              <View style={[styles.notifIndicator, { backgroundColor: colors.successLight }]}>
                <Ionicons name="notifications" size={12} color={colors.success} />
                <Text style={[styles.notifIndicatorText, { color: colors.success }]}>
                  Kid notified
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.price, { color: isCanceled ? colors.textMuted : colors.text }]}>
            {currencySymbol}{item.price_snapshot}
          </Text>
        </View>

        <Text style={[styles.tutorName, { color: colors.text }]}>{item.tutor_name}</Text>
        <Text style={[styles.studentName, { color: colors.textMuted }]}>
          Student: {item.student_name}
        </Text>

        <View style={[styles.timeRow, { borderTopColor: colors.border }]}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {format(startDate, 'MMM d, yyyy')}
          </Text>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <Text style={[styles.title, { color: colors.text }, isDesktop && styles.titleDesktop]}>My Bookings</Text>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.tabs, isTablet && styles.tabsTablet]}>
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: filter === 'upcoming' ? colors.primary : colors.surface, borderColor: colors.border },
              isTablet && styles.tabTablet
            ]}
            onPress={() => setFilter('upcoming')}
          >
            <Text style={[styles.tabText, { color: filter === 'upcoming' ? '#FFFFFF' : colors.text }, isTablet && styles.tabTextTablet]}>
              Upcoming
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: filter === 'past' ? colors.primary : colors.surface, borderColor: colors.border },
              isTablet && styles.tabTablet
            ]}
            onPress={() => setFilter('past')}
          >
            <Text style={[styles.tabText, { color: filter === 'past' ? '#FFFFFF' : colors.text }, isTablet && styles.tabTextTablet]}>
              Past
            </Text>
          </TouchableOpacity>
        </View>

        {filteredBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No {filter} bookings
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredBookings}
            renderItem={renderBookingCard}
            keyExtractor={(item) => item.booking_id}
            numColumns={numColumns}
            key={numColumns}
            contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
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
    borderWidth: 1,
  },
  tabTablet: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextTablet: {
    fontSize: 15,
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  listContentDesktop: {
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  notifIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
  },
  notifIndicatorText: {
    fontSize: 10,
    fontWeight: '600',
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 14,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  timeText: {
    fontSize: 13,
    marginRight: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
