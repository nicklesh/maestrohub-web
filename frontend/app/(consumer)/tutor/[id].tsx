import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/services/api';
import { colors } from '../../../src/theme/colors';
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
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

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
              style={[styles.dateItem, isSelected && styles.dateItemSelected]}
              onPress={() => {
                setSelectedDate(item);
                setSelectedSlot(null);
              }}
            >
              <Text style={[styles.dateDayName, isSelected && styles.dateTextSelected]}>
                {format(item, 'EEE')}
              </Text>
              <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>
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
      <View style={styles.slotsGrid}>
        {daySlots.map((slot) => {
          const isSelected = selectedSlot?.start_at === slot.start_at;
          return (
            <TouchableOpacity
              key={slot.start_at}
              style={[styles.slotItem, isSelected && styles.slotItemSelected]}
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {tutor.user_name?.charAt(0)?.toUpperCase() || 'T'}
            </Text>
          </View>
          <Text style={styles.tutorName}>{tutor.user_name}</Text>
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
          <Text style={styles.priceText}>${tutor.base_price}/hr</Text>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bioText}>{tutor.bio}</Text>
        </View>

        {/* Subjects */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subjects</Text>
          <View style={styles.chipsList}>
            {tutor.subjects.map((s) => (
              <View key={s} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Levels */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Levels Taught</Text>
          <View style={styles.chipsList}>
            {tutor.levels.map((l) => (
              <View key={l} style={styles.chip}>
                <Text style={styles.chipText}>{l.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Policies */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Policies</Text>
          <View style={styles.policyItem}>
            <Ionicons name="time-outline" size={18} color={colors.textMuted} />
            <Text style={styles.policyText}>
              Cancel {tutor.policies.cancel_window_hours}h before for full refund
            </Text>
          </View>
          <View style={styles.policyItem}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.policyText}>{tutor.policies.no_show_policy}</Text>
          </View>
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Book a Session</Text>
          {renderDateSelector()}
          {renderSlots()}
        </View>

        {/* Reviews */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
          {reviews.length === 0 ? (
            <Text style={styles.noReviewsText}>No reviews yet</Text>
          ) : (
            reviews.slice(0, 5).map((review) => (
              <View key={review.review_id} style={styles.reviewCard}>
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
      </ScrollView>

      {/* Book Button */}
      <View style={styles.bookBar}>
        <View style={styles.bookBarInfo}>
          <Text style={styles.bookBarPrice}>${tutor.base_price}</Text>
          <Text style={styles.bookBarDuration}>/ {tutor.duration_minutes} min</Text>
        </View>
        <TouchableOpacity
          style={[styles.bookButton, !selectedSlot && styles.bookButtonDisabled]}
          onPress={handleBook}
          disabled={!selectedSlot}
        >
          <Text style={styles.bookButtonText}>
            {selectedSlot ? 'Book Now' : 'Select a Time'}
          </Text>
        </TouchableOpacity>
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
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '600',
    color: colors.primary,
  },
  tutorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
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
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 22,
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
  dateTextSelected: {
    color: '#fff',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
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
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
  bookButtonDisabled: {
    backgroundColor: colors.gray300,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
