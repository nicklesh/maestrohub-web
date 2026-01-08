import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/services/api';
import { colors } from '../../../src/theme/colors';
import { format, parseISO, isPast } from 'date-fns';

interface Booking {
  booking_id: string;
  tutor_id: string;
  tutor_name: string;
  student_id: string;
  student_name: string;
  start_at: string;
  end_at: string;
  status: string;
  price_snapshot: number;
  policy_snapshot: {
    cancel_window_hours: number;
    no_show_policy: string;
  };
  intake_response: {
    goals: string;
    current_level: string;
    notes?: string;
  };
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  booked: { bg: colors.primaryLight, text: colors.primary },
  confirmed: { bg: colors.successLight, text: colors.success },
  completed: { bg: colors.gray200, text: colors.gray600 },
  canceled_by_consumer: { bg: colors.errorLight, text: colors.error },
  canceled_by_provider: { bg: colors.errorLight, text: colors.error },
};

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    loadBooking();
  }, [id]);

  const loadBooking = async () => {
    try {
      const response = await api.get(`/bookings/${id}`);
      setBooking(response.data);
    } catch (error) {
      console.error('Failed to load booking:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCanceling(true);
            try {
              await api.post(`/bookings/${id}/cancel`);
              loadBooking();
              Alert.alert('Canceled', 'Your booking has been canceled.');
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel booking');
            } finally {
              setCanceling(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      await api.post(`/bookings/${id}/review`, {
        rating,
        comment: reviewComment.trim() || undefined,
      });
      Alert.alert('Thank you!', 'Your review has been submitted.');
      setShowReview(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
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

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Booking not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusStyle = STATUS_COLORS[booking.status] || STATUS_COLORS.booked;
  const statusText = booking.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const isUpcoming = !isPast(parseISO(booking.start_at)) && ['booked', 'confirmed'].includes(booking.status);
  const canReview = booking.status === 'completed';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <View style={styles.backButton} />
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusText}</Text>
          </View>
        </View>

        {/* Date/Time Card */}
        <View style={styles.card}>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateContainer}>
              <Ionicons name="calendar-outline" size={24} color={colors.primary} />
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Date</Text>
                <Text style={styles.dateValue}>
                  {format(parseISO(booking.start_at), 'EEEE, MMMM d, yyyy')}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.dateTimeRow}>
            <View style={styles.dateContainer}>
              <Ionicons name="time-outline" size={24} color={colors.primary} />
              <View style={styles.dateInfo}>
                <Text style={styles.dateLabel}>Time</Text>
                <Text style={styles.dateValue}>
                  {format(parseISO(booking.start_at), 'h:mm a')} - {format(parseISO(booking.end_at), 'h:mm a')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tutor Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tutor</Text>
          <TouchableOpacity
            style={styles.personRow}
            onPress={() => router.push(`/(consumer)/tutor/${booking.tutor_id}`)}
          >
            <View style={styles.personAvatar}>
              <Text style={styles.personInitial}>
                {booking.tutor_name?.charAt(0)?.toUpperCase() || 'T'}
              </Text>
            </View>
            <Text style={styles.personName}>{booking.tutor_name}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Student Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Student</Text>
          <View style={styles.personRow}>
            <View style={[styles.personAvatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.personInitial}>
                {booking.student_name?.charAt(0)?.toUpperCase() || 'S'}
              </Text>
            </View>
            <Text style={styles.personName}>{booking.student_name}</Text>
          </View>
        </View>

        {/* Intake Info */}
        {booking.intake_response && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lesson Goals</Text>
            <Text style={styles.intakeText}>{booking.intake_response.goals}</Text>
            <Text style={styles.intakeLabel}>Level: {booking.intake_response.current_level}</Text>
            {booking.intake_response.notes && (
              <Text style={styles.intakeText}>{booking.intake_response.notes}</Text>
            )}
          </View>
        )}

        {/* Price */}
        <View style={styles.card}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total Paid</Text>
            <Text style={styles.priceValue}>${booking.price_snapshot}</Text>
          </View>
        </View>

        {/* Actions */}
        {isUpcoming && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={canceling}
          >
            {canceling ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                <Text style={styles.cancelButtonText}>Cancel Booking</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Review Section */}
        {canReview && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Leave a Review</Text>
            {showReview ? (
              <View>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRating(star)}>
                      <Ionicons
                        name={star <= rating ? 'star' : 'star-outline'}
                        size={32}
                        color={colors.accent}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Share your experience (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity
                  style={styles.submitReviewButton}
                  onPress={handleSubmitReview}
                  disabled={submittingReview}
                >
                  {submittingReview ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitReviewText}>Submit Review</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.writeReviewButton}
                onPress={() => setShowReview(true)}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={styles.writeReviewText}>Write a Review</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateTimeRow: {
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginTop: 2,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  personInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  personName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  intakeText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  intakeLabel: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 16,
    color: colors.text,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  reviewInput: {
    backgroundColor: colors.gray100,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitReviewButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  submitReviewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    gap: 8,
  },
  writeReviewText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
});
