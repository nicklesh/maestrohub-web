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
import { useTheme } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { format, parseISO, addDays, startOfDay } from 'date-fns';

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
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState({ total: 0, recommend_pct: 0 });
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  useEffect(() => {
    loadTutor();
  }, [id]);

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

  const handleBook = () => {
    if (!selectedSlot || !tutor) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    // Create full ISO datetime strings
    const startAt = `${dateStr}T${selectedSlot.start_time}:00`;
    const endAt = `${dateStr}T${selectedSlot.end_time}:00`;
    router.push({
      pathname: '/(consumer)/book/[tutorId]',
      params: {
        tutorId: tutor.tutor_id,
        startAt,
        endAt,
      },
    });
  };

  const dates = Array.from({ length: 14 }, (_, i) => addDays(startOfDay(new Date()), i));

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
              {tutor.rating_avg?.toFixed(1) || '0.0'}
            </Text>
            <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
              ({tutor.rating_count || 0} reviews)
            </Text>
          </View>

          <View style={styles.tagsRow}>
            {(tutor.modality || []).map((m) => (
              <View key={m} style={[styles.tag, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={m === 'online' ? 'videocam' : 'location'} size={14} color={colors.primary} />
                <Text style={[styles.tagText, { color: colors.primary }]}>
                  {m === 'online' ? 'Online' : 'In-Person'}
                </Text>
              </View>
            ))}
          </View>

          <Text style={[styles.priceText, { color: colors.primary }]}>
            {tutor.currency_symbol || '$'}{tutor.base_price}/hr
          </Text>
        </View>

        {/* Bio Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <Text style={[styles.bioText, { color: colors.textMuted }]}>{tutor.bio || 'No bio available'}</Text>
        </View>

        {/* Subjects Section */}
        {(tutor.subjects || []).length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Subjects</Text>
            <View style={styles.chipsList}>
              {tutor.subjects.map((s) => (
                <View key={s} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Levels Section */}
        {(tutor.levels || []).length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Levels</Text>
            <View style={styles.chipsList}>
              {tutor.levels.map((l) => (
                <View key={l} style={[styles.chip, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{l.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Policies Section */}
        {tutor.policies && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Policies</Text>
            {tutor.policies.cancel_window_hours && (
              <View style={styles.policyRow}>
                <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.policyText, { color: colors.textMuted }]}>
                  Cancel {tutor.policies.cancel_window_hours}h before for full refund
                </Text>
              </View>
            )}
            {tutor.policies.no_show_policy && (
              <View style={styles.policyRow}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.policyText, { color: colors.textMuted }]}>
                  {tutor.policies.no_show_policy}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Session Packages Section */}
        {packages.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Packages</Text>
              <View style={[styles.saveBadge, { backgroundColor: colors.success + '20' }]}>
                <Text style={[styles.saveBadgeText, { color: colors.success }]}>Save up to {Math.max(...packages.map(p => p.discount_percent))}%</Text>
              </View>
            </View>
            <Text style={[styles.packageHint, { color: colors.textMuted }]}>
              Book multiple sessions and save!
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
                      {pkg.session_count} sessions • Valid {pkg.validity_days} days
                    </Text>
                  </View>
                  <View style={[styles.discountTag, { backgroundColor: colors.success }]}>
                    <Text style={styles.discountTagText}>{pkg.discount_percent}% OFF</Text>
                  </View>
                </View>
                <View style={styles.packagePricing}>
                  <View>
                    <Text style={[styles.perSessionLabel, { color: colors.textMuted }]}>Per session</Text>
                    <Text style={[styles.perSessionPrice, { color: colors.text }]}>
                      {tutor.currency_symbol}{pkg.price_per_session.toFixed(0)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total</Text>
                    <Text style={[styles.totalPrice, { color: colors.primary }]}>
                      {tutor.currency_symbol}{pkg.total_price.toFixed(0)}
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
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Reviews</Text>
              <View style={styles.reviewStats}>
                <Ionicons name="star" size={14} color="#FFB800" />
                <Text style={[styles.reviewStatText, { color: colors.text }]}>
                  {tutor.rating_avg?.toFixed(1)} ({reviewStats.total})
                </Text>
              </View>
            </View>
            {reviewStats.recommend_pct > 0 && (
              <Text style={[styles.recommendText, { color: colors.success }]}>
                {reviewStats.recommend_pct}% would recommend
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
                    <Text style={[styles.coachResponseLabel, { color: colors.primary }]}>Coach's Response:</Text>
                    <Text style={[styles.coachResponseText, { color: colors.text }]}>{review.coach_response}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Date Selection */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Date</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={dates}
            keyExtractor={(item) => item.toISOString()}
            contentContainerStyle={styles.dateList}
            renderItem={({ item }) => {
              const isSelected = format(item, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              return (
                <TouchableOpacity
                  style={[
                    styles.dateCard,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setSelectedDate(item)}
                >
                  <Text style={[styles.dateDay, { color: isSelected ? '#FFFFFF' : colors.textMuted }]}>
                    {format(item, 'EEE')}
                  </Text>
                  <Text style={[styles.dateNum, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                    {format(item, 'd')}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Time Slots */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Times</Text>
          {availableSlots.length === 0 ? (
            <Text style={[styles.noSlotsText, { color: colors.textMuted }]}>No available slots for this date</Text>
          ) : (
            <View style={styles.slotsGrid}>
              {availableSlots.filter(s => s.is_available).map((slot, index) => {
                const isSelected = selectedSlot?.start_time === slot.start_time;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.slotCard,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text style={[styles.slotText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                      {slot.start_time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Book Button */}
      {selectedSlot && (
        <View style={[styles.bookButtonContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.bookButton, { backgroundColor: colors.primary }]}
            onPress={handleBook}
          >
            <Text style={styles.bookButtonText}>Book Now</Text>
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
  dateList: {
    gap: 8,
  },
  dateCard: {
    width: 56,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  dateDay: {
    fontSize: 11,
    fontWeight: '500',
  },
  dateNum: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  noSlotsText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 16,
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
});
