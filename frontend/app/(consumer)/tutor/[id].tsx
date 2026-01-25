import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { format, addDays, startOfDay } from 'date-fns';
import { parseToLocalTime } from '@/src/utils/dateLocalization';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Tutor {
  tutor_id: string;
  bio: string;
  subjects: string[];
  levels: string[];
  modality: string[];
  base_price: number;
  duration_minutes: number;
  rating_avg: number;
  rating_count: number;
  currency_symbol: string;
  user_name: string;
  policies?: {
    cancel_window_hours?: number;
    no_show_policy?: string;
    late_arrival_policy?: string;
  };
}

interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  available?: boolean;
  is_booked?: boolean;
  is_held?: boolean;
}

interface SessionPackage {
  package_id: string;
  name: string;
  session_count: number;
  price_per_session: number;
  total_price: number;
  discount_percent: number;
  validity_days: number;
}

interface Review {
  review_id: string;
  consumer_name: string;
  overall_rating: number;
  comment?: string;
  would_recommend: boolean;
  created_at: string;
  coach_response?: string;
}

export default function TutorDetailScreen() {
  const router = useRouter();
  const { id, bookingId, mode, source } = useLocalSearchParams();  // bookingId and mode for update flow, source for view only
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { t, formatNumber, formatDate } = useTranslation();
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState({ total: 0, recommend_pct: 0 });
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [currentBooking, setCurrentBooking] = useState<{ start_at: string; end_at: string } | null>(null);
  
  // Check navigation mode
  // - From search: no special params → show booking UI
  // - From reschedule: mode='update' + bookingId → show slots with "Update Session"
  // - From booking details coach name: source='booking' → view only, no booking UI
  const isUpdateMode = mode === 'update' && bookingId;
  const isViewOnly = source === 'booking';
  const showBookingUI = !isViewOnly;

  // Helper functions for translations
  const getLevelName = (level: string): string => {
    const key = `levels.${level.toLowerCase().replace(/\s+/g, '_')}`;
    const translated = t(key);
    return translated === key ? level : translated;
  };

  const getSubjectName = (subject: string): string => {
    const key = `subjects.${subject.toLowerCase().replace(/\s+/g, '_')}`;
    const translated = t(key);
    return translated === key ? subject : translated;
  };

  const getCategoryName = (category: string): string => {
    const key = `categories.${category.toLowerCase().replace(/\s+/g, '_')}`;
    const translated = t(key);
    return translated === key ? category : translated;
  };

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  useEffect(() => {
    // Reset selected slot when component loads or id changes
    setSelectedSlot(null);
    setSelectedDate(new Date());
    setCurrentBooking(null);
    loadTutor();
    
    // If in update mode, load the current booking to show its slot
    if (isUpdateMode && bookingId) {
      loadCurrentBooking();
    }
  }, [id, bookingId]);

  const loadCurrentBooking = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await api.get(`/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const booking = response.data;
      setCurrentBooking({ start_at: booking.start_at, end_at: booking.end_at });
      
      // Set the selected date to the booking's date
      const bookingDate = parseToLocalTime(booking.start_at);
      setSelectedDate(startOfDay(bookingDate));
    } catch (error) {
      console.error('Failed to load current booking:', error);
    }
  };

  useEffect(() => {
    if (tutor) {
      loadSlots();
    }
  }, [tutor, selectedDate]);

  const loadTutor = async () => {
    try {
      const response = await api.get(`/tutors/${id}`);
      setTutor(response.data);
      
      // Load packages and reviews for this tutor
      try {
        const [pkgRes, reviewRes] = await Promise.all([
          api.get(`/tutors/${id}/packages`),
          api.get(`/tutors/${id}/reviews`)
        ]);
        setPackages(pkgRes.data.packages || []);
        setReviews(reviewRes.data.reviews || []);
        setReviewStats({
          total: reviewRes.data.stats?.total_reviews || 0,
          recommend_pct: reviewRes.data.stats?.recommend_percentage || 0,
        });
      } catch (e) {
        // Silent fail for optional data
        console.log('Optional data not loaded:', e);
      }
    } catch (error) {
      console.error('Failed to load tutor:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    if (!tutor) return;
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await api.get(`/tutors/${tutor.tutor_id}/availability?date=${dateStr}`);
      setAvailableSlots(response.data?.slots || []);
    } catch (error) {
      console.error('Failed to load slots:', error);
      setAvailableSlots([]);
    }
  };

  const { token } = useAuth();
  const { showSuccess, showError } = useToast();
  const [updating, setUpdating] = useState(false);

  const handleBook = async () => {
    if (!selectedSlot || !tutor) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const startAt = `${dateStr}T${selectedSlot.start_time}:00`;
    const endAt = `${dateStr}T${selectedSlot.end_time}:00`;
    
    // If in update mode, directly update the booking time slot (no payment needed)
    if (isUpdateMode && bookingId) {
      setUpdating(true);
      try {
        await api.put(`/bookings/${bookingId}/timeslot`, {
          start_at: startAt,
          end_at: endAt,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        showSuccess(t('messages.success.booking_updated'));
        router.replace('/(consumer)/bookings');
      } catch (error: any) {
        console.error('Failed to update booking:', error);
        const errorMsg = error.response?.data?.detail || t('messages.error.update_failed');
        showError(errorMsg);
      } finally {
        setUpdating(false);
      }
      return;
    }
    
    // New booking flow - go to booking wizard with full payment process
    router.push({
      pathname: '/(consumer)/book/[tutorId]',
      params: {
        tutorId: tutor.tutor_id,
        startAt,
        endAt,
      },
    });
  };

  // Generate dates with booking date first if in update mode
  const generateDates = () => {
    const baseDates = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));
    
    if (currentBooking) {
      const bookingDate = startOfDay(parseToLocalTime(currentBooking.start_at));
      // Check if booking date is already in the list
      const existingIndex = baseDates.findIndex(d => 
        format(d, 'yyyy-MM-dd') === format(bookingDate, 'yyyy-MM-dd')
      );
      
      if (existingIndex === -1) {
        // Booking date not in list, add it at the beginning
        return [bookingDate, ...baseDates];
      } else if (existingIndex > 0) {
        // Move booking date to the front
        const reordered = [...baseDates];
        reordered.splice(existingIndex, 1);
        return [bookingDate, ...reordered];
      }
    }
    return baseDates;
  };
  
  const dates = generateDates();

  // Helper to convert UTC time string (HH:MM) to local time
  const convertSlotTimeToLocal = (utcTimeStr: string, dateContext: Date): string => {
    // Parse the time and combine with the selected date
    const [hours, minutes] = utcTimeStr.split(':').map(Number);
    const utcDate = new Date(Date.UTC(
      dateContext.getFullYear(),
      dateContext.getMonth(),
      dateContext.getDate(),
      hours,
      minutes
    ));
    // Format in local time
    return format(utcDate, 'h:mm a');
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

  if (!tutor) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text }}>Coach not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {tutor.user_name?.charAt(0) || 'T'}
            </Text>
          </View>
          <Text style={[styles.tutorName, { color: colors.text }]}>{tutor.user_name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#FFB800" />
            <Text style={[styles.ratingText, { color: colors.text }]}>
              {formatNumber(tutor.rating_avg?.toFixed(1) || '0.0')}
            </Text>
            <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
              ({formatNumber(tutor.rating_count || 0)} {t('pages.tutor_detail.reviews')})
            </Text>
          </View>

          <View style={styles.tagsRow}>
            {(tutor.modality || []).map((m) => (
              <View key={m} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={m === 'online' ? 'videocam' : 'location'} size={14} color={colors.primary} />
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  {m === 'online' ? t('modality.online') : m === 'hybrid' ? t('modality.hybrid') : t('modality.in_person')}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.priceText, { color: colors.primary }]}>
            {tutor.currency_symbol || '$'}{formatNumber(tutor.base_price)}{t('pages.tutor_detail.per_hour')}
          </Text>
        </View>

        {/* Bio Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.tutor_detail.about')}</Text>
          <Text style={[styles.bioText, { color: colors.textMuted }]}>{tutor.bio || t('pages.tutor_detail.no_reviews')}</Text>
        </View>

        {/* Subjects Section */}
        {(tutor.subjects || []).length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.tutor_detail.subjects')}</Text>
            <View style={styles.chipsList}>
              {tutor.subjects.map((s) => (
                <View key={s} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{getSubjectName(s)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Levels Section */}
        {(tutor.levels || []).length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.tutor_detail.levels')}</Text>
            <View style={styles.chipsList}>
              {tutor.levels.map((l) => (
                <View key={l} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{getLevelName(l)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Policies Section */}
        {tutor.policies && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.tutor_detail.policies')}</Text>
            {tutor.policies.cancel_window_hours && (
              <View style={styles.policyRow}>
                <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.policyText, { color: colors.textMuted }]}>
                  {t('pages.tutor_detail.hours_notice', { hours: tutor.policies.cancel_window_hours })}
                </Text>
              </View>
            )}
            {tutor.policies.no_show_policy && (
              <View style={styles.policyRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.policyText, { color: colors.textMuted }]}>
                  {tutor.policies.no_show_policy === 'Full charge for no-shows' 
                    ? t('pages.tutor_detail.full_charge_no_shows') 
                    : tutor.policies.no_show_policy}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Session Packages Section */}
        {packages.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.tutor_detail.session_packages')}</Text>
              <View style={[styles.saveBadge, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.saveBadgeText, { color: colors.success }]}>{t('pages.tutor_detail.save_up_to', { percent: Math.max(...packages.map(p => p.discount_percent)) })}</Text>
              </View>
            </View>
            <Text style={[styles.packageHint, { color: colors.textMuted }]}>
              {t('pages.tutor_detail.book_multiple_save')}
            </Text>
            {packages.map((pkg) => (
              <TouchableOpacity
                key={pkg.package_id}
                style={[styles.packageCard, { backgroundColor: colors.background, borderColor: colors.success }]}
                onPress={() => router.push({
                  pathname: '/(consumer)/book/[tutorId]',
                  params: { tutorId: tutor.tutor_id, packageId: pkg.package_id }
                })}
              >
                <View style={styles.packageHeader}>
                  <View>
                    <Text style={[styles.packageName, { color: colors.text }]}>{pkg.name}</Text>
                    <Text style={[styles.packageSessions, { color: colors.textMuted }]}>
                      {t('pages.tutor_detail.sessions_valid', { sessions: formatNumber(pkg.session_count), days: formatNumber(pkg.validity_days) })}
                    </Text>
                  </View>
                  <View style={[styles.discountTag, { backgroundColor: colors.success }]}>
                    <Text style={styles.discountTagText}>{formatNumber(pkg.discount_percent)}% {t('pages.tutor_detail.off')}</Text>
                  </View>
                </View>
                <View style={styles.packagePricing}>
                  <View>
                    <Text style={[styles.perSessionLabel, { color: colors.textMuted }]}>{t('pages.tutor_detail.per_session')}</Text>
                    <Text style={[styles.perSessionPrice, { color: colors.text }]}>
                      {tutor.currency_symbol}{formatNumber(pkg.price_per_session.toFixed(0))}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.totalLabel, { color: colors.textMuted }]}>{t('pages.tutor_detail.total')}</Text>
                    <Text style={[styles.totalPrice, { color: colors.primary }]}>
                      {tutor.currency_symbol}{formatNumber(pkg.total_price.toFixed(0))}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.tutor_detail.reviews')}</Text>
              <View style={styles.reviewStats}>
                <Ionicons name="star" size={14} color="#FFB800" />
                <Text style={[styles.reviewStatText, { color: colors.text }]}>
                  {formatNumber(tutor.rating_avg?.toFixed(1) || '0')} ({formatNumber(reviewStats.total)} {reviewStats.total === 1 ? t('pages.tutor_detail.review') : t('pages.tutor_detail.reviews')})
                </Text>
              </View>
            </View>
            {reviewStats.recommend_pct > 0 && (
              <Text style={[styles.recommendText, { color: colors.success }]}>
                {t('pages.tutor_detail.would_recommend', { percent: formatNumber(reviewStats.recommend_pct) })}
              </Text>
            )}
            {reviews.slice(0, 3).map((review) => (
              <View key={review.review_id} style={[styles.reviewCard, { borderColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  <View style={[styles.reviewAvatar, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.reviewAvatarText, { color: colors.primary }]}>
                      {review.consumer_name.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reviewerName, { color: colors.text }]}>{review.consumer_name}</Text>
                    <View style={styles.reviewRating}>
                      {[1,2,3,4,5].map(i => (
                        <Ionicons 
                          key={i} 
                          name={i <= review.overall_rating ? 'star' : 'star-outline'} 
                          size={12} 
                          color={i <= review.overall_rating ? '#FFB800' : colors.gray300} 
                        />
                      ))}
                    </View>
                  </View>
                </View>
                {review.comment && (
                  <Text style={[styles.reviewComment, { color: colors.textMuted }]}>"{review.comment}"</Text>
                )}
                {review.coach_response && (
                  <View style={[styles.coachResponse, { backgroundColor: colors.primary + '10' }]}>
                    <Text style={[styles.coachResponseLabel, { color: colors.primary }]}>{t('pages.tutor_detail.coach_response')}</Text>
                    <Text style={[styles.coachResponseText, { color: colors.text }]}>{review.coach_response}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Date Selection - Only show when booking UI is enabled */}
        {showBookingUI && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.tutor_detail.select_date')}</Text>
            
            {/* Month/Year Header */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity 
                onPress={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setMonth(newDate.getMonth() - 1);
                  if (newDate >= startOfDay(new Date())) {
                    setSelectedDate(newDate);
                  }
                }}
                style={[styles.calendarNavButton, { backgroundColor: colors.background }]}
              >
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthTitle, { color: colors.text }]}>
                {formatDate(selectedDate, 'MMMM yyyy')}
              </Text>
              <TouchableOpacity 
                onPress={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setMonth(newDate.getMonth() + 1);
                  setSelectedDate(newDate);
                }}
                style={[styles.calendarNavButton, { backgroundColor: colors.background }]}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            {/* Day Labels */}
            <View style={styles.calendarWeekHeader}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <Text key={day} style={[styles.calendarDayLabel, { color: colors.textMuted }]}>
                  {day}
                </Text>
              ))}
            </View>
            
            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {(() => {
                const today = startOfDay(new Date());
                const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                const lastDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
                const startPadding = firstDayOfMonth.getDay();
                const totalDays = lastDayOfMonth.getDate();
                
                const calendarDays = [];
                
                // Add empty cells for days before the 1st
                for (let i = 0; i < startPadding; i++) {
                  calendarDays.push(
                    <View key={`empty-${i}`} style={styles.calendarDayCell} />
                  );
                }
                
                // Add days of the month
                for (let day = 1; day <= totalDays; day++) {
                  const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
                  const isSelected = format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                  const isPast = date < today;
                  const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                  const isBookingDate = currentBooking && format(date, 'yyyy-MM-dd') === format(parseToLocalTime(currentBooking.start_at), 'yyyy-MM-dd');
                  
                  calendarDays.push(
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.calendarDayCell,
                        styles.calendarDayButton,
                        { borderColor: colors.border },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                        isPast && { opacity: 0.4 },
                        isToday && !isSelected && { borderColor: colors.primary, borderWidth: 2 },
                        isBookingDate && !isSelected && { backgroundColor: colors.warning + '30' }
                      ]}
                      onPress={() => !isPast && setSelectedDate(date)}
                      disabled={isPast}
                    >
                      <Text style={[
                        styles.calendarDayText,
                        { color: isSelected ? '#FFFFFF' : colors.text },
                        isPast && { color: colors.textMuted }
                      ]}>
                        {day}
                      </Text>
                      {isBookingDate && !isSelected && (
                        <View style={[styles.bookingDot, { backgroundColor: colors.warning }]} />
                      )}
                    </TouchableOpacity>
                  );
                }
                
                return calendarDays;
              })()}
            </View>
          </View>
        )}

        {/* Time Slots - Only show when booking UI is enabled */}
        {showBookingUI && (
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          {/* Show current booked slot if in update mode */}
          {isUpdateMode && currentBooking && (
            <View style={[styles.currentBookingCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
              <Text style={[styles.currentBookingLabel, { color: colors.primary }]}>
                {t('pages.tutor_detail.current_booking')}
              </Text>
              <Text style={[styles.currentBookingTime, { color: colors.text }]}>
                {formatDate(parseToLocalTime(currentBooking.start_at), 'EEEE, MMMM d, yyyy')}
              </Text>
              <Text style={[styles.currentBookingTime, { color: colors.text }]}>
                {formatDate(parseToLocalTime(currentBooking.start_at), 'h:mm a')} - {formatDate(parseToLocalTime(currentBooking.end_at), 'h:mm a')}
              </Text>
            </View>
          )}
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.tutor_detail.available_slots')}</Text>
          {availableSlots.length === 0 ? (
            <Text style={[styles.noSlotsText, { color: colors.textMuted }]}>{t('pages.tutor_detail.no_slots')}</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {availableSlots.map((slot, index) => {
                const isSelected = selectedSlot?.start_time === slot.start_time && slot.is_available;
                const isUnavailable = !slot.is_available || slot.is_booked || slot.is_held;
                // Convert to local time for display
                const localTime = convertSlotTimeToLocal(slot.start_time, selectedDate);
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.slotCard,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      isUnavailable && { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, opacity: 0.5 }
                    ]}
                    onPress={() => !isUnavailable && setSelectedSlot(slot)}
                    disabled={isUnavailable}
                  >
                    <Text style={[
                      styles.slotText, 
                      { color: isSelected ? '#FFFFFF' : isUnavailable ? colors.textMuted : colors.text },
                      isUnavailable && { textDecorationLine: 'line-through' }
                    ]}>
                      {localTime}
                    </Text>
                    {isUnavailable && (
                      <Text style={[styles.bookedLabel, { color: colors.textMuted }]}>
                        {t('pages.tutor_detail.booked')}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
        )}
      </ScrollView>

      {/* Book/Update Button - Only show when booking UI is enabled */}
      {showBookingUI && selectedSlot && (
        <View style={[styles.bookButtonContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: colors.primary }, updating && styles.bookButtonDisabled]}
            onPress={handleBook}
            disabled={updating}
          >
            {updating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.bookButtonText}>
                {isUpdateMode ? t('pages.tutor_detail.update_session') : t('pages.tutor_detail.book_session')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    paddingBottom: 100,
  },
  profileCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
  },
  tutorName: {
    fontSize: 22,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 13,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceText: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chipsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    textTransform: 'capitalize',
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  policyText: {
    fontSize: 13,
    flex: 1,
  },
  // Calendar Styles
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarNavButton: {
    padding: 8,
    borderRadius: 8,
  },
  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayButton: {
    margin: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '500',
  },
  bookingDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  noSlotsText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
  },
  currentBookingCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  currentBookingLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  currentBookingTime: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  slotText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bookedLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  bookButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  bookButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Package styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  saveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  saveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  packageHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  packageCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  packageName: {
    fontSize: 15,
    fontWeight: '600',
  },
  packageSessions: {
    fontSize: 12,
    marginTop: 2,
  },
  discountTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  discountTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  packagePricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  perSessionLabel: {
    fontSize: 11,
  },
  perSessionPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalLabel: {
    fontSize: 11,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Review styles
  reviewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewStatText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recommendText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  reviewCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewRating: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  reviewComment: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 18,
  },
  coachResponse: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
  },
  coachResponseLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  coachResponseText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bookButtonDisabled: {
    opacity: 0.6,
  },
});
