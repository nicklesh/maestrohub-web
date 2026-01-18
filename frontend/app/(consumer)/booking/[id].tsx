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
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { format, parseISO, isPast } from 'date-fns';

interface KidNotification {
  notification_id: string;
  notification_type: string;
  sent_to: string;
  sent_at: string;
  status: string;
}

interface StudentNotifySettings {
  notify_enabled: boolean;
  email?: string;
  phone?: string;
}

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
  currency?: string;
  currency_symbol?: string;
  policy_snapshot: {
    cancel_window_hours: number;
    no_show_policy: string;
  };
  intake_response: {
    goals: string;
    current_level: string;
    notes?: string;
  };
  kid_notifications?: KidNotification[];
  student_notify_settings?: StudentNotifySettings;
}

export default function BookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { t } = useTranslation();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reportingNoShow, setReportingNoShow] = useState(false);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;

  // Dynamic styles
  const styles = getStyles(colors);

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

  useEffect(() => {
    loadBooking();
  }, [id]);

  const loadBooking = async () => {
    try {
      const response = await api.get(`/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBooking(response.data);
    } catch (error) {
      console.error('Failed to load booking:', error);
      if (Platform.OS === 'web') {
        showError('Failed to load booking details');
      } else {
        showError('Failed to load booking details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to cancel this booking?');
      if (confirmed) {
        performCancel();
      }
    } else {
      showInfo('Are you sure you want to cancel this booking?', 'Cancel Booking');
    }
  };

  const performCancel = async () => {
    setCanceling(true);
    try {
      await api.post(`/bookings/${id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      loadBooking();
      if (Platform.OS === 'web') {
        showError('Your booking has been canceled.');
      } else {
        showInfo('Your booking has been canceled.', 'Canceled');
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to cancel booking';
      if (Platform.OS === 'web') {
        showInfo(errorMsg);
      } else {
        showInfo(errorMsg, 'Error');
      }
    } finally {
      setCanceling(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      await api.post(`/bookings/${id}/review`, {
        rating,
        comment: reviewComment.trim() || undefined,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Platform.OS === 'web') {
        showError('Thank you! Your review has been submitted.');
      } else {
        showInfo('Your review has been submitted.', 'Thank you!');
      }
      setShowReview(false);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to submit review';
      if (Platform.OS === 'web') {
        showInfo(errorMsg);
      } else {
        showInfo(errorMsg, 'Error');
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReportNoShow = async () => {
    const confirmMsg = "Are you sure you want to report that the coach didn't show up? This will be reviewed and you'll receive a full refund if confirmed.";
    
    const doReport = async () => {
      setReportingNoShow(true);
      try {
        await api.post(`/bookings/${id}/no-show?who=coach`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Platform.OS === 'web') {
          showInfo('No-show reported. We\'ll review this and process your refund.');
        } else {
          showInfo('No-show reported. We\'ll review this and process your refund.', 'Reported');
        }
        loadBooking();
      } catch (error: any) {
        const errorMsg = error.response?.data?.detail || 'Failed to report no-show';
        if (Platform.OS === 'web') {
          showInfo(errorMsg);
        } else {
          showInfo(errorMsg, 'Error');
        }
      } finally {
        setReportingNoShow(false);
      }
    };

    const confirmed = Platform.OS === 'web' 
      ? window.confirm(confirmMsg)
      : true; // On native, proceed with the action
    
    if (confirmed) {
      await doReport();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBack title="Booking Details" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBack title="Booking Details" />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text }}>Booking not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusStyle = getStatusColors(booking.status);
  const statusText = booking.status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  const isUpcoming = !isPast(parseISO(booking.start_at)) && ['booked', 'confirmed'].includes(booking.status);
  const canReview = booking.status === 'completed';
  // Can report no-show if session time has passed and status is still booked/confirmed
  const canReportNoShow = isPast(parseISO(booking.start_at)) && ['booked', 'confirmed'].includes(booking.status);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title="Booking Details" />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentTablet,
        ]}
      >
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Status Badge */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusText}</Text>
            </View>
          </View>

          {/* Date/Time Card */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>Date</Text>
                  <Text style={[styles.dateValue, isDesktop && styles.dateValueDesktop]}>
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
                  <Text style={[styles.dateValue, isDesktop && styles.dateValueDesktop]}>
                    {format(parseISO(booking.start_at), 'h:mm a')} - {format(parseISO(booking.end_at), 'h:mm a')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tutor Info */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
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
              <Text style={[styles.personName, isDesktop && styles.personNameDesktop]}>{booking.tutor_name}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Student Info */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <Text style={styles.cardTitle}>Student</Text>
            <View style={styles.personRow}>
              <View style={[styles.personAvatar, styles.studentAvatar]}>
                <Text style={styles.studentInitial}>
                  {booking.student_name?.charAt(0)?.toUpperCase() || 'S'}
                </Text>
              </View>
              <Text style={[styles.personName, isDesktop && styles.personNameDesktop]}>{booking.student_name}</Text>
            </View>
          </View>

          {/* Kid Notification Status */}
          {booking.student_notify_settings && (
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.notificationHeader}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                <Text style={[styles.cardTitle, { marginBottom: 0, marginLeft: 8 }]}>Kid Notifications</Text>
              </View>
              
              {booking.student_notify_settings.notify_enabled ? (
                <View style={styles.notificationContent}>
                  <View style={[styles.notificationBadge, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.notificationBadgeText, { color: colors.success }]}>Enabled</Text>
                  </View>
                  
                  {/* Contact methods */}
                  <View style={styles.contactMethods}>
                    {booking.student_notify_settings.email && (
                      <View style={styles.contactRow}>
                        <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                        <Text style={[styles.contactText, { color: colors.text }]}>
                          {booking.student_notify_settings.email}
                        </Text>
                      </View>
                    )}
                    {booking.student_notify_settings.phone && (
                      <View style={styles.contactRow}>
                        <Ionicons name="phone-portrait-outline" size={16} color={colors.textMuted} />
                        <Text style={[styles.contactText, { color: colors.text }]}>
                          {booking.student_notify_settings.phone}
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Notification history */}
                  {booking.kid_notifications && booking.kid_notifications.length > 0 && (
                    <View style={styles.notificationHistory}>
                      <Text style={[styles.historyTitle, { color: colors.textMuted }]}>Sent Notifications</Text>
                      {booking.kid_notifications.map((notif, index) => (
                        <View key={notif.notification_id || index} style={styles.historyItem}>
                          <Ionicons 
                            name={notif.notification_type === 'email' ? 'mail' : 'chatbubble'} 
                            size={14} 
                            color={colors.success} 
                          />
                          <Text style={[styles.historyText, { color: colors.text }]}>
                            {notif.notification_type === 'email' ? 'Email' : 'SMS'} sent to {notif.sent_to}
                          </Text>
                          <Text style={[styles.historyTime, { color: colors.textMuted }]}>
                            {format(parseISO(notif.sent_at), 'MMM d, h:mm a')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* No notifications sent yet */}
                  {(!booking.kid_notifications || booking.kid_notifications.length === 0) && (
                    <Text style={[styles.noNotifText, { color: colors.textMuted }]}>
                      Reminders will be sent before the session
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.notificationContent}>
                  <View style={[styles.notificationBadge, { backgroundColor: colors.gray200 }]}>
                    <Ionicons name="notifications-off-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.notificationBadgeText, { color: colors.textMuted }]}>Not enabled</Text>
                  </View>
                  <Text style={[styles.noNotifText, { color: colors.textMuted }]}>
                    Enable notifications in your kid's profile to send them session reminders
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Intake Info */}
          {booking.intake_response && (
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={styles.cardTitle}>Lesson Goals</Text>
              <Text style={[styles.intakeText, isDesktop && styles.intakeTextDesktop]}>{booking.intake_response.goals}</Text>
              <Text style={styles.intakeLabel}>Level: {booking.intake_response.current_level}</Text>
              {booking.intake_response.notes && (
                <Text style={[styles.intakeText, isDesktop && styles.intakeTextDesktop]}>{booking.intake_response.notes}</Text>
              )}
            </View>
          )}

          {/* Price */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, isDesktop && styles.priceLabelDesktop]}>Total Paid</Text>
              <Text style={[styles.priceValue, isDesktop && styles.priceValueDesktop]}>{booking.currency_symbol || '$'}{booking.price_snapshot}</Text>
            </View>
          </View>

          {/* Actions */}
          {isUpcoming && (
            <TouchableOpacity
              style={[styles.cancelButton, isTablet && styles.cancelButtonTablet]}
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
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={styles.cardTitle}>Leave a Review</Text>
              {showReview ? (
                <View>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => setRating(star)}>
                        <Ionicons
                          name={star <= rating ? 'star' : 'star-outline'}
                          size={isTablet ? 40 : 32}
                          color={colors.accent}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    style={[styles.reviewInput, isTablet && styles.reviewInputTablet]}
                    placeholder="Share your experience (optional)"
                    placeholderTextColor={colors.textMuted}
                    value={reviewComment}
                    onChangeText={setReviewComment}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    style={[styles.submitReviewButton, isTablet && styles.submitReviewButtonTablet]}
                    onPress={handleSubmitReview}
                    disabled={submittingReview}
                  >
                    {submittingReview ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={[styles.submitReviewText, isTablet && styles.submitReviewTextTablet]}>Submit Review</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.writeReviewButton, isTablet && styles.writeReviewButtonTablet]}
                  onPress={() => setShowReview(true)}
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <Text style={styles.writeReviewText}>Write a Review</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* No-Show Report Section */}
          {canReportNoShow && (
            <View style={[styles.card, isTablet && styles.cardTablet, { borderColor: colors.warning, borderWidth: 1 }]}>
              <View style={styles.noShowHeader}>
                <Ionicons name="alert-circle" size={24} color={colors.warning} />
                <Text style={[styles.cardTitle, { color: colors.warning, marginLeft: 8 }]}>Session Issue?</Text>
              </View>
              <Text style={[styles.noShowText, { color: colors.textMuted }]}>
                If your coach didn't show up for the session, you can report it here. We'll review and process a full refund.
              </Text>
              <TouchableOpacity
                style={[styles.noShowButton, { backgroundColor: colors.warning }]}
                onPress={handleReportNoShow}
                disabled={reportingNoShow}
              >
                {reportingNoShow ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="flag" size={18} color="#fff" />
                    <Text style={styles.noShowButtonText}>Report Coach No-Show</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
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
  scrollContent: {
    paddingBottom: 32,
  },
  scrollContentTablet: {
    paddingVertical: 32,
  },
  contentWrapper: {
    flex: 1,
    padding: 16,
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
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTablet: {
    borderRadius: 20,
    padding: 24,
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
  dateValueDesktop: {
    fontSize: 18,
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
  studentAvatar: {
    backgroundColor: colors.accent,
  },
  studentInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  personName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  personNameDesktop: {
    fontSize: 18,
  },
  intakeText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  intakeTextDesktop: {
    fontSize: 16,
    lineHeight: 26,
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
  priceLabelDesktop: {
    fontSize: 18,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  priceValueDesktop: {
    fontSize: 28,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    gap: 8,
  },
  cancelButtonTablet: {
    padding: 18,
    borderRadius: 14,
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
  reviewInputTablet: {
    borderRadius: 14,
    padding: 20,
    fontSize: 17,
    minHeight: 120,
  },
  submitReviewButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  submitReviewButtonTablet: {
    padding: 16,
    borderRadius: 14,
  },
  submitReviewText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitReviewTextTablet: {
    fontSize: 18,
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
  writeReviewButtonTablet: {
    padding: 16,
    borderRadius: 14,
  },
  writeReviewText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  // No-Show styles
  noShowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  noShowText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  noShowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  noShowButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Kid Notification styles
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationContent: {
    marginTop: 4,
  },
  notificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 12,
  },
  notificationBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  contactMethods: {
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
  },
  notificationHistory: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  historyText: {
    fontSize: 13,
    flex: 1,
  },
  historyTime: {
    fontSize: 11,
  },
  noNotifText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
