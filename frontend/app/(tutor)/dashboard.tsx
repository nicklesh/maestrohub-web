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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { api } from '@/src/services/api';
import AppHeader from '@/src/components/AppHeader';
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
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<TutorStats | null>(null);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;

  const styles = getStyles(colors);

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
        <AppHeader />
        <View style={[styles.onboardingPrompt, contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined]}>
          <Ionicons name="school-outline" size={isTablet ? 80 : 64} color={colors.primary} />
          <Text style={[styles.onboardingTitle, isDesktop && styles.onboardingTitleDesktop]}>Complete Your Profile</Text>
          <Text style={[styles.onboardingText, isDesktop && styles.onboardingTextDesktop]}>
            Create your tutor profile to start receiving bookings.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, isTablet && styles.primaryButtonTablet]}
            onPress={() => router.push('/(tutor)/onboarding')}
          >
            <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>Create Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Stats */}
          <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>{stats?.completed_lessons || 0}</Text>
              <Text style={styles.statLabel}>Lessons</Text>
            </View>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>${stats?.total_earnings || 0}</Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color={colors.accent} />
                <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>
                  {stats?.rating_avg ? stats.rating_avg.toFixed(1) : 'New'}
                </Text>
              </View>
              <Text style={styles.statLabel}>
                {stats?.rating_count || 0} reviews
              </Text>
            </View>
          </View>

          {/* Upcoming Bookings */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Upcoming Lessons</Text>
              <TouchableOpacity onPress={() => router.push('/(tutor)/calendar')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            {upcomingBookings.length === 0 ? (
              <View style={[styles.emptyCard, isTablet && styles.emptyCardTablet]}>
                <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No upcoming lessons</Text>
              </View>
            ) : (
              upcomingBookings.map((booking) => (
                <View key={booking.booking_id} style={[styles.bookingCard, isTablet && styles.bookingCardTablet]}>
                  <View style={styles.bookingInfo}>
                    <Text style={[styles.bookingDate, isDesktop && styles.bookingDateDesktop]}>
                      {formatDate(booking.start_at)}
                    </Text>
                    <Text style={styles.bookingTime}>
                      {format(parseISO(booking.start_at), 'h:mm a')} -{' '}
                      {format(parseISO(booking.end_at), 'h:mm a')}
                    </Text>
                    <Text style={styles.studentName}>{booking.student_name}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.completeButton, isTablet && styles.completeButtonTablet]}
                    onPress={() => markComplete(booking.booking_id)}
                  >
                    <Ionicons name="checkmark" size={20} color={colors.success} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Quick Actions */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Quick Actions</Text>
            <View style={[styles.actionsGrid, isDesktop && styles.actionsGridDesktop]}>
              <TouchableOpacity
                style={[styles.actionCard, isTablet && styles.actionCardTablet]}
                onPress={() => router.push('/(tutor)/calendar')}
              >
                <Ionicons name="calendar" size={isTablet ? 28 : 24} color={colors.primary} />
                <Text style={[styles.actionText, isDesktop && styles.actionTextDesktop]}>Availability</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, isTablet && styles.actionCardTablet]}
                onPress={() => router.push('/(tutor)/settings')}
              >
                <Ionicons name="person" size={isTablet ? 28 : 24} color={colors.primary} />
                <Text style={[styles.actionText, isDesktop && styles.actionTextDesktop]}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionCard, isTablet && styles.actionCardTablet]}
                onPress={() => router.push('/(tutor)/billing')}
              >
                <Ionicons name="card" size={isTablet ? 28 : 24} color={colors.primary} />
                <Text style={[styles.actionText, isDesktop && styles.actionTextDesktop]}>Billing</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  onboardingPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    alignSelf: 'center',
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 24,
  },
  onboardingTitleDesktop: {
    fontSize: 28,
  },
  onboardingText: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  onboardingTextDesktop: {
    fontSize: 18,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonTablet: {
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonTextTablet: {
    fontSize: 18,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  scrollContentTablet: {
    paddingHorizontal: 24,
  },
  contentWrapper: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  statsGridTablet: {
    paddingHorizontal: 0,
    gap: 16,
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
  statCardTablet: {
    borderRadius: 20,
    padding: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  statValueDesktop: {
    fontSize: 28,
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
  sectionTablet: {
    paddingHorizontal: 0,
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
  sectionTitleDesktop: {
    fontSize: 20,
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
  emptyCardTablet: {
    borderRadius: 20,
    padding: 40,
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
  bookingCardTablet: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  bookingDateDesktop: {
    fontSize: 18,
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
  completeButtonTablet: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  actionsGridDesktop: {
    gap: 16,
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
  actionCardTablet: {
    borderRadius: 16,
    padding: 24,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    marginTop: 8,
  },
  actionTextDesktop: {
    fontSize: 15,
  },
});
