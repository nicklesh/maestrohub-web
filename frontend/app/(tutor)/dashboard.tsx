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
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
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
  meeting_link?: string;
  waiting_room_enabled?: boolean;
}

interface TutorStats {
  total_bookings: number;
  completed_lessons: number;
  total_earnings: number;
  rating_avg: number;
  rating_count: number;
}

export default function TutorDashboard() {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState<TutorStats | null>(null);
  
  // Meeting link modal state
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [meetingLink, setMeetingLink] = useState('');
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [savingMeetingLink, setSavingMeetingLink] = useState(false);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;

  const styles = getStyles(colors);

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  const loadData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    try {
      // Check if tutor has profile
      try {
        const profileRes = await api.get('/tutors/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        // Profile exists
        if (profileRes.data && (profileRes.data.bio || profileRes.data.subjects?.length > 0)) {
          setHasProfile(true);
          setStats({
            total_bookings: 0,
            completed_lessons: 0,
            total_earnings: 0,
            rating_avg: profileRes.data.rating_avg || 0,
            rating_count: profileRes.data.rating_count || 0,
          });
        } else {
          // Profile exists but incomplete
          setHasProfile(false);
          setLoading(false);
          return;
        }
      } catch (error: any) {
        // 404 means no profile
        if (error.response?.status === 404) {
          setHasProfile(false);
          setLoading(false);
          return;
        }
        // For 401/403 auth errors, log out
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.error('Auth error, token may be invalid');
          setLoading(false);
          return;
        }
        // For other errors (500, network, etc.), show dashboard with empty state
        console.error('Profile check error:', error.message || error);
        setHasProfile(true); // Assume profile exists to avoid infinite loop
        setStats({
          total_bookings: 0,
          completed_lessons: 0,
          total_earnings: 0,
          rating_avg: 0,
          rating_count: 0,
        });
      }

      // Load bookings
      try {
        const bookingsRes = await api.get('/bookings?role=tutor', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBookings(bookingsRes.data || []);
      } catch (e) {
        console.log('Bookings not available');
        setBookings([]);
      }

      // Load billing stats
      try {
        const billingRes = await api.get('/billing/summary', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats((prev) => ({
          ...prev!,
          completed_lessons: billingRes.data.completed_lessons || 0,
          total_earnings: billingRes.data.total_earnings || 0,
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

  const formatDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return t('pages.coach.dashboard.today');
    if (isTomorrow(date)) return t('pages.coach.dashboard.tomorrow');
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

  const openMeetingLinkModal = (booking: Booking) => {
    setSelectedBooking(booking);
    setMeetingLink(booking.meeting_link || '');
    setWaitingRoomEnabled(booking.waiting_room_enabled !== false);
    setShowMeetingModal(true);
  };

  const saveMeetingLink = async () => {
    if (!selectedBooking) return;
    
    setSavingMeetingLink(true);
    try {
      await api.put(`/bookings/${selectedBooking.booking_id}/meeting-link`, {
        meeting_link: meetingLink || null,
        waiting_room_enabled: waitingRoomEnabled
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setBookings(bookings.map(b => 
        b.booking_id === selectedBooking.booking_id 
          ? { ...b, meeting_link: meetingLink, waiting_room_enabled: waitingRoomEnabled }
          : b
      ));
      
      showSuccess(t('pages.booking_detail.meeting_link_updated'));
      setShowMeetingModal(false);
    } catch (error) {
      console.error('Failed to update meeting link:', error);
      showError(t('pages.booking_detail.meeting_link_update_failed'));
    } finally {
      setSavingMeetingLink(false);
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
          <Text style={[styles.onboardingTitle, isDesktop && styles.onboardingTitleDesktop]}>{t('pages.coach.dashboard.complete_profile')}</Text>
          <Text style={[styles.onboardingText, isDesktop && styles.onboardingTextDesktop]}>
            {t('pages.coach.dashboard.create_profile_desc')}
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, isTablet && styles.primaryButtonTablet]}
            onPress={() => router.push('/(tutor)/onboarding')}
          >
            <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>{t('pages.coach.dashboard.create_profile')}</Text>
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
              <Text style={styles.statLabel}>{t('pages.coach.dashboard.lessons')}</Text>
            </View>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>${stats?.total_earnings || 0}</Text>
              <Text style={styles.statLabel}>{t('pages.coach.dashboard.earned')}</Text>
            </View>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color={colors.accent} />
                <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>
                  {stats?.rating_avg ? stats.rating_avg.toFixed(1) : t('pages.coach.dashboard.new')}
                </Text>
              </View>
              <Text style={styles.statLabel}>
                {stats?.rating_count || 0} {t('pages.coach.dashboard.reviews')}
              </Text>
            </View>
          </View>

          {/* Upcoming Bookings */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>{t('pages.coach.dashboard.upcoming_lessons')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tutor)/calendar')}>
                <Text style={styles.seeAll}>{t('pages.coach.dashboard.see_all')}</Text>
              </TouchableOpacity>
            </View>

            {upcomingBookings.length === 0 ? (
              <View style={[styles.emptyCard, isTablet && styles.emptyCardTablet]}>
                <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('pages.coach.dashboard.no_upcoming_lessons')}</Text>
              </View>
            ) : (
              upcomingBookings.map((booking) => (
                <View key={booking.booking_id} style={[styles.bookingCard, isTablet && styles.bookingCardTablet]}>
                  <View style={styles.bookingInfo}>
                    <Text style={[styles.bookingDate, isDesktop && styles.bookingDateDesktop]}>
                      {formatDateLabel(booking.start_at)}
                    </Text>
                    <Text style={styles.bookingTime}>
                      {format(parseISO(booking.start_at), 'h:mm a')} -{' '}
                      {format(parseISO(booking.end_at), 'h:mm a')}
                    </Text>
                    <Text style={styles.studentName}>{booking.student_name}</Text>
                    {booking.meeting_link && (
                      <Text style={[styles.meetingLinkIndicator, { color: colors.success }]}>
                        <Ionicons name="videocam" size={12} color={colors.success} /> {t('pages.booking_detail.meeting_link')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.bookingActions}>
                    <TouchableOpacity
                      style={[styles.meetingLinkButton]}
                      onPress={() => openMeetingLinkModal(booking)}
                    >
                      <Ionicons name="link" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.completeButton, isTablet && styles.completeButtonTablet]}
                      onPress={() => markComplete(booking.booking_id)}
                    >
                      <Ionicons name="checkmark" size={20} color={colors.success} />
                    </TouchableOpacity>
                  </View>
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

          {/* Sponsorship Promotion Banner */}
          <TouchableOpacity 
            style={[styles.sponsorBanner, isTablet && styles.sponsorBannerTablet]}
            onPress={() => router.push('/(tutor)/sponsorship')}
            activeOpacity={0.8}
          >
            <View style={styles.sponsorBannerGradient}>
              <View style={styles.sponsorBannerContent}>
                <View style={styles.sponsorBannerIcon}>
                  <Ionicons name="star" size={isTablet ? 32 : 28} color="#FFD700" />
                </View>
                <View style={styles.sponsorBannerText}>
                  <Text style={[styles.sponsorBannerTitle, isTablet && styles.sponsorBannerTitleTablet]}>
                    Boost Your Visibility
                  </Text>
                  <Text style={styles.sponsorBannerSubtitle}>
                    Get featured at the top of search results • Reach more students
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </View>
              <View style={styles.sponsorBannerStats}>
                <View style={styles.sponsorStat}>
                  <Text style={styles.sponsorStatValue}>3x</Text>
                  <Text style={styles.sponsorStatLabel}>More Views</Text>
                </View>
                <View style={styles.sponsorStatDivider} />
                <View style={styles.sponsorStat}>
                  <Text style={styles.sponsorStatValue}>$15</Text>
                  <Text style={styles.sponsorStatLabel}>Per Week</Text>
                </View>
                <View style={styles.sponsorStatDivider} />
                <View style={styles.sponsorStat}>
                  <Text style={styles.sponsorStatValue}>Top</Text>
                  <Text style={styles.sponsorStatLabel}>Placement</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Meeting Link Modal */}
      <Modal
        visible={showMeetingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMeetingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('pages.booking_detail.edit_meeting_link')}
              </Text>
              <TouchableOpacity onPress={() => setShowMeetingModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedBooking && (
              <View style={styles.bookingPreview}>
                <Text style={[styles.bookingPreviewDate, { color: colors.text }]}>
                  {formatDate(selectedBooking.start_at)}
                </Text>
                <Text style={[styles.bookingPreviewTime, { color: colors.textMuted }]}>
                  {format(parseISO(selectedBooking.start_at), 'h:mm a')} - {format(parseISO(selectedBooking.end_at), 'h:mm a')}
                </Text>
                <Text style={[styles.bookingPreviewStudent, { color: colors.textMuted }]}>
                  {selectedBooking.student_name}
                </Text>
              </View>
            )}
            
            <TextInput
              style={[styles.meetingLinkInput, { 
                backgroundColor: colors.inputBackground, 
                borderColor: colors.border,
                color: colors.text 
              }]}
              placeholder={t('pages.booking_detail.meeting_link_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={meetingLink}
              onChangeText={setMeetingLink}
              autoCapitalize="none"
              keyboardType="url"
            />
            
            <View style={styles.waitingRoomRow}>
              <Text style={[styles.waitingRoomLabel, { color: colors.text }]}>
                {t('pages.booking_detail.has_waiting_room')}
              </Text>
              <Switch
                value={waitingRoomEnabled}
                onValueChange={setWaitingRoomEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
            
            <TouchableOpacity
              style={[styles.saveMeetingLinkButton, { backgroundColor: colors.primary }]}
              onPress={saveMeetingLink}
              disabled={savingMeetingLink}
            >
              {savingMeetingLink ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveMeetingLinkText}>
                  {t('pages.booking_detail.update_meeting_link')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // Sponsorship Banner Styles
  sponsorBanner: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sponsorBannerTablet: {
    marginHorizontal: 0,
    borderRadius: 20,
  },
  sponsorBannerGradient: {
    backgroundColor: colors.primary,
    padding: 16,
  },
  sponsorBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sponsorBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sponsorBannerText: {
    flex: 1,
  },
  sponsorBannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  sponsorBannerTitleTablet: {
    fontSize: 18,
  },
  sponsorBannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  sponsorBannerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  sponsorStat: {
    alignItems: 'center',
  },
  sponsorStatValue: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '700',
  },
  sponsorStatLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  sponsorStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  // New styles for meeting link feature
  bookingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  meetingLinkButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight || colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  meetingLinkIndicator: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  bookingPreview: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  bookingPreviewDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  bookingPreviewTime: {
    fontSize: 14,
    marginTop: 4,
  },
  bookingPreviewStudent: {
    fontSize: 14,
    marginTop: 4,
  },
  meetingLinkInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    marginBottom: 16,
  },
  waitingRoomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  waitingRoomLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  saveMeetingLinkButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveMeetingLinkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
