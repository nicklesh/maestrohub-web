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
import { colors } from '@/src/theme/colors';
import { format, parseISO, addDays, startOfDay } from 'date-fns';

interface TutorProfile {
  tutor_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  bio: string;
  categories: string[];
  subjects: string[];
  levels: string[];
  modality: string[];
  base_price: number;
  duration_minutes: number;
  rating_avg: number;
  rating_count: number;
  policies: {
    cancel_window_hours: number;
    no_show_policy: string;
    late_arrival_policy: string;
  };
}

interface Review {
  review_id: string;
  student_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}

interface TimeSlot {
  start_at: string;
  end_at: string;
  available: boolean;
}

export default function TutorProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;

  useEffect(() => {
    loadTutorData();
  }, [id]);

  useEffect(() => {
    if (tutor) {
      loadSlots();
    }
  }, [tutor, selectedDate]);

  const loadTutorData = async () => {
    try {
      const [tutorRes, reviewsRes] = await Promise.all([
        api.get(`/tutors/${id}`),
        api.get(`/tutors/${id}/reviews`),
      ]);
      setTutor(tutorRes.data);
      setReviews(reviewsRes.data.reviews);
    } catch (error) {
      console.error('Failed to load tutor:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async () => {
    try {
      const fromDate = startOfDay(selectedDate).toISOString();
      const toDate = addDays(startOfDay(selectedDate), 1).toISOString();
      const response = await api.get(`/tutors/${id}/availability`, {
        params: { from_date: fromDate, to_date: toDate },
      });
      setSlots(response.data.slots);
    } catch (error) {
      console.error('Failed to load slots:', error);
    }
  };

  const handleBook = () => {
    if (selectedSlot) {
      router.push({
        pathname: '/(consumer)/book/[tutorId]',
        params: {
          tutorId: id,
          startAt: selectedSlot.start_at,
          endAt: selectedSlot.end_at,
        },
      });
    }
  };

  const renderDateSelector = () => {
    const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
    
    return (
      <FlatList
        data={dates}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateList}
        renderItem={({ item }) => {
          const isSelected = format(item, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          return (
            <TouchableOpacity
              style={[
                styles.dateItem,
                isTablet && styles.dateItemTablet,
                isSelected && styles.dateItemSelected,
              ]}
              onPress={() => {
                setSelectedDate(item);
                setSelectedSlot(null);
              }}
            >
              <Text style={[styles.dateDayName, isSelected && styles.dateTextSelected]}>
                {format(item, 'EEE')}
              </Text>
              <Text style={[styles.dateDay, isTablet && styles.dateDayTablet, isSelected && styles.dateTextSelected]}>
                {format(item, 'd')}
              </Text>
            </TouchableOpacity>
          );
        }}
        keyExtractor={(item) => item.toISOString()}
      />
    );
  };

  const renderSlots = () => {
    const daySlots = slots.filter((slot) => {
      const slotDate = parseISO(slot.start_at);
      return format(slotDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    });

    if (daySlots.length === 0) {
      return (
        <View style={styles.noSlots}>
          <Ionicons name="calendar-outline" size={32} color={colors.textMuted} />
          <Text style={styles.noSlotsText}>No available slots on this day</Text>
        </View>
      );
    }

    return (
      <View style={[styles.slotsGrid, isTablet && styles.slotsGridTablet]}>
        {daySlots.map((slot) => {
          const isSelected = selectedSlot?.start_at === slot.start_at;
          return (
            <TouchableOpacity
              key={slot.start_at}
              style={[
                styles.slotItem,
                isTablet && styles.slotItemTablet,
                isSelected && styles.slotItemSelected,
              ]}
              onPress={() => setSelectedSlot(slot)}
            >
              <Text style={[styles.slotText, isSelected && styles.slotTextSelected]}>
                {format(parseISO(slot.start_at), 'h:mm a')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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

  if (!tutor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Tutor not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentTablet,
        ]}
      >
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Profile Card */}
          <View style={[styles.profileCard, isTablet && styles.profileCardTablet]}>
            <View style={[styles.avatar, isDesktop && styles.avatarDesktop]}>
              <Text style={[styles.avatarText, isDesktop && styles.avatarTextDesktop]}>
                {tutor.user_name?.charAt(0)?.toUpperCase() || 'T'}
              </Text>
            </View>
            <Text style={[styles.tutorName, isDesktop && styles.tutorNameDesktop]}>{tutor.user_name}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={18} color={colors.accent} />
              <Text style={styles.ratingText}>
                {tutor.rating_avg > 0
                  ? `${tutor.rating_avg.toFixed(1)} (${tutor.rating_count} reviews)`
                  : 'New Tutor'}
              </Text>
            </View>
            <View style={styles.tagsRow}>
              {tutor.modality.map((m) => (
                <View key={m} style={styles.tag}>
                  <Ionicons
                    name={m === 'online' ? 'videocam' : 'location'}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.tagText}>{m === 'online' ? 'Online' : 'In-Person'}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.priceText, isDesktop && styles.priceTextDesktop]}>${tutor.base_price}/hr</Text>
          </View>

          {/* Two Column Layout for Tablet/Desktop */}
          <View style={isTablet ? styles.twoColumnLayout : undefined}>
            <View style={isTablet ? styles.leftColumn : undefined}>
              {/* About */}
              <View style={[styles.section, isTablet && styles.sectionTablet]}>
                <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>About</Text>
                <Text style={[styles.bioText, isDesktop && styles.bioTextDesktop]}>{tutor.bio}</Text>
              </View>

              {/* Subjects */}
              <View style={[styles.section, isTablet && styles.sectionTablet]}>
                <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Subjects</Text>
                <View style={styles.chipsList}>
                  {tutor.subjects.map((s) => (
                    <View key={s} style={[styles.chip, isTablet && styles.chipTablet]}>
                      <Text style={styles.chipText}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Levels */}
              {tutor.levels && tutor.levels.length > 0 && (
                <View style={[styles.section, isTablet && styles.sectionTablet]}>
                  <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Levels Taught</Text>
                  <View style={styles.chipsList}>
                    {tutor.levels.map((l) => (
                      <View key={l} style={[styles.chip, isTablet && styles.chipTablet]}>
                        <Text style={styles.chipText}>{l.replace('_', ' ')}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Policies */}
              {tutor.policies && (
                <View style={[styles.section, isTablet && styles.sectionTablet]}>
                  <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Policies</Text>
                  {tutor.policies.cancel_window_hours && (
                    <View style={styles.policyItem}>
                      <Ionicons name="time-outline" size={18} color={colors.textMuted} />
                      <Text style={styles.policyText}>
                        Cancel {tutor.policies.cancel_window_hours}h before for full refund
                      </Text>
                    </View>
                  )}
                  {tutor.policies.no_show_policy && (
                    <View style={styles.policyItem}>
                      <Ionicons name="alert-circle-outline" size={18} color={colors.textMuted} />
                      <Text style={styles.policyText}>{tutor.policies.no_show_policy}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={isTablet ? styles.rightColumn : undefined}>
              {/* Availability */}
              <View style={[styles.section, isTablet && styles.sectionTablet, isTablet && styles.bookingCard]}>
                <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Book a Session</Text>
                {renderDateSelector()}
                {renderSlots()}
              </View>

              {/* Reviews */}
              <View style={[styles.section, isTablet && styles.sectionTablet]}>
                <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Reviews ({reviews.length})</Text>
                {reviews.length === 0 ? (
                  <Text style={styles.noReviewsText}>No reviews yet</Text>
                ) : (
                  reviews.slice(0, 5).map((review) => (
                    <View key={review.review_id} style={[styles.reviewCard, isTablet && styles.reviewCardTablet]}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewerName}>{review.student_name}</Text>
                        <View style={styles.reviewRating}>
                          <Ionicons name="star" size={14} color={colors.accent} />
                          <Text style={styles.reviewRatingText}>{review.rating}</Text>
                        </View>
                      </View>
                      {review.comment && (
                        <Text style={styles.reviewComment}>{review.comment}</Text>
                      )}
                      <Text style={styles.reviewDate}>
                        {format(parseISO(review.created_at), 'MMM d, yyyy')}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Book Button */}
      <View style={[styles.bookBar, isTablet && styles.bookBarTablet]}>
        <View style={[styles.bookBarInner, contentMaxWidth ? { maxWidth: contentMaxWidth, width: '100%' } : undefined]}>
          <View style={styles.bookBarInfo}>
            <Text style={[styles.bookBarPrice, isDesktop && styles.bookBarPriceDesktop]}>${tutor.base_price}</Text>
            <Text style={styles.bookBarDuration}>/ {tutor.duration_minutes} min</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.bookButton,
              isTablet && styles.bookButtonTablet,
              !selectedSlot && styles.bookButtonDisabled,
            ]}
            onPress={handleBook}
            disabled={!selectedSlot}
          >
            <Text style={[styles.bookButtonText, isTablet && styles.bookButtonTextTablet]}>
              {selectedSlot ? 'Book Now' : 'Select a Time'}
            </Text>
          </TouchableOpacity>
        </View>
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
  scrollContent: {
    paddingBottom: 100,
  },
  scrollContentTablet: {
    paddingHorizontal: 24,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    padding: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  profileCardTablet: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 32,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarDesktop: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: colors.primary,
  },
  avatarTextDesktop: {
    fontSize: 48,
  },
  tutorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  tutorNameDesktop: {
    fontSize: 28,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  ratingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  priceText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 16,
  },
  priceTextDesktop: {
    fontSize: 32,
  },
  twoColumnLayout: {
    flexDirection: 'row',
    gap: 24,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTablet: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 1,
  },
  bookingCard: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  sectionTitleDesktop: {
    fontSize: 20,
  },
  bioText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
  },
  bioTextDesktop: {
    fontSize: 16,
    lineHeight: 26,
  },
  chipsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipTablet: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
    textTransform: 'capitalize',
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  policyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  dateList: {
    gap: 8,
    marginBottom: 16,
  },
  dateItem: {
    width: 56,
    height: 64,
    backgroundColor: colors.surface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  dateItemTablet: {
    width: 64,
    height: 72,
  },
  dateItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateDayName: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  dateDayTablet: {
    fontSize: 20,
  },
  dateTextSelected: {
    color: '#fff',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotsGridTablet: {
    gap: 12,
  },
  slotItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotItemTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  slotItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  slotText: {
    fontSize: 14,
    color: colors.text,
  },
  slotTextSelected: {
    color: '#fff',
  },
  noSlots: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  noSlotsText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewCardTablet: {
    backgroundColor: colors.gray100,
    borderWidth: 0,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  reviewRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewRatingText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  reviewComment: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 8,
  },
  noReviewsText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  bookBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bookBarTablet: {
    paddingHorizontal: 24,
  },
  bookBarInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookBarInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bookBarPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  bookBarPriceDesktop: {
    fontSize: 28,
  },
  bookBarDuration: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 4,
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  bookButtonTablet: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 14,
  },
  bookButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bookButtonTextTablet: {
    fontSize: 18,
  },
});
