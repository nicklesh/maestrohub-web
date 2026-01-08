import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';

interface Booking {
  booking_id: string;
  student_name: string;
  start_at: string;
  end_at: string;
  status: string;
  price_snapshot: number;
}

interface TutorStats {
  total_bookings: number;
  completed_lessons: number;
  total_earnings: number;
  rating_avg: number;
  rating_count: number;
}

export default function TutorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<TutorStats | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Check if tutor has profile
      try {
        const profileRes = await api.get('/tutors/profile');
        setHasProfile(true);
        setStats({
          total_bookings: 0,
          completed_lessons: 0,
          total_earnings: 0,
          rating_avg: profileRes.data.rating_avg || 0,
          rating_count: profileRes.data.rating_count || 0,
        });
      } catch (error) {
        setHasProfile(false);
        setLoading(false);
        return;
      }

      // Load bookings
      const bookingsRes = await api.get('/bookings?role=tutor');
      setBookings(bookingsRes.data);

      // Load billing stats
      try {
        const billingRes = await api.get('/billing/summary');
        setStats((prev) => ({
          ...prev!,
          completed_lessons: billingRes.data.completed_lessons,
          total_earnings: billingRes.data.total_earnings,
        }));
      } catch (e) {
        console.log('Billing not available');
      }
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const upcomingBookings = bookings.filter(
    (b) => ['booked', 'confirmed'].includes(b.status)
  ).slice(0, 5);

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const markComplete = async (bookingId: string) => {
    try {
      await api.post(`/bookings/${bookingId}/complete`);
      loadData();
    } catch (error) {
      console.error('Failed to complete booking:', error);
    }
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

  if (!hasProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.onboardingPrompt}>
          <Ionicons name="school-outline" size={64} color={colors.primary} />
          <Text style={styles.onboardingTitle}>Complete Your Profile</Text>
          <Text style={styles.onboardingText}>
            Create your tutor profile to start receiving bookings.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(tutor)/onboarding')}
          >
            <Text style={styles.primaryButtonText}>Create Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name?.split(' ')[0]}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats?.completed_lessons || 0}</Text>
            <Text style={styles.statLabel}>Lessons</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${stats?.total_earnings || 0}</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={16} color={colors.accent} />
              <Text style={styles.statValue}>
                {stats?.rating_avg ? stats.rating_avg.toFixed(1) : 'New'}
              </Text>
            </View>
            <Text style={styles.statLabel}>
              {stats?.rating_count || 0} reviews
            </Text>
          </View>
        </View>

        {/* Upcoming Bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Lessons</Text>
            <TouchableOpacity onPress={() => router.push('/(tutor)/calendar')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {upcomingBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No upcoming lessons</Text>
            </View>
          ) : (
            upcomingBookings.map((booking) => (
              <View key={booking.booking_id} style={styles.bookingCard}>
                <View style={styles.bookingInfo}>
                  <Text style={styles.bookingDate}>
                    {formatDate(booking.start_at)}
                  </Text>
                  <Text style={styles.bookingTime}>
                    {format(parseISO(booking.start_at), 'h:mm a')} -{' '}
                    {format(parseISO(booking.end_at), 'h:mm a')}
                  </Text>
                  <Text style={styles.studentName}>{booking.student_name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.completeButton}
                  onPress={() => markComplete(booking.booking_id)}
                >
                  <Ionicons name="checkmark" size={20} color={colors.success} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tutor)/calendar')}
            >
              <Ionicons name="calendar" size={24} color={colors.primary} />
              <Text style={styles.actionText}>Availability</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tutor)/settings')}
            >
              <Ionicons name="person" size={24} color={colors.primary} />
              <Text style={styles.actionText}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(tutor)/billing')}
            >
              <Ionicons name="card" size={24} color={colors.primary} />
              <Text style={styles.actionText}>Billing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  onboardingPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 24,
  },
  onboardingText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    padding: 20,
  },
  greeting: {
    fontSize: 14,
    color: colors.textMuted,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  bookingTime: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  studentName: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 4,
  },
  completeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginTop: 8,
  },
});
