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
  Linking,
  Modal,
  KeyboardAvoidingView,
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
import { isPast, format } from 'date-fns';
import { parseToLocalTime } from '@/src/utils/dateLocalization';

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
  tutor_subject?: string;
  student_id: string;
  student_name: string;
  start_at: string;
  end_at: string;
  status: string;
  price_snapshot: number;
  currency?: string;
  currency_symbol?: string;
  meeting_link?: string;
  waiting_room_enabled?: boolean;
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
  const { t, formatDate } = useTranslation();
  const { showError, showInfo, showSuccess } = useToast();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reportingNoShow, setReportingNoShow] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyNote, setNotifyNote] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);

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
    if (id && id !== 'undefined') {
      loadBooking();
    } else {
      // If no valid ID, navigate back to bookings list
      router.replace('/(consumer)/bookings');
    }
  }, [id]);

  const loadBooking = async () => {
    if (!id || id === 'undefined') {
      router.replace('/(consumer)/bookings');
      return;
    }
    try {
      const response = await api.get(`/bookings/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBooking(response.data);
    } catch (error) {
      console.error('Failed to load booking:', error);
      showError(t('messages.error.load_booking_failed'));
      router.back();
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
    const confirmMsg = t('pages.booking_detail.no_show_confirm');
    
    const doReport = async () => {
      setReportingNoShow(true);
      try {
        await api.post(`/bookings/${id}/no-show?who=coach`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Platform.OS === 'web') {
          showInfo(t('pages.booking_detail.no_show_reported'));
        } else {
          showInfo(t('pages.booking_detail.no_show_reported'), t('pages.booking_detail.reported'));
        }
        loadBooking();
      } catch (error: any) {
        const errorMsg = error.response?.data?.detail || t('pages.booking_detail.no_show_failed');
        if (Platform.OS === 'web') {
          showInfo(errorMsg);
        } else {
          showInfo(errorMsg, t('common.error'));
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
        <AppHeader showBack title={t('pages.booking_detail.title')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBack title={t('pages.booking_detail.title')} />
        <View style={styles.loadingContainer}>
          <Text style={{ color: colors.text }}>{t('pages.booking_detail.not_found')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const getStatusTranslated = (status: string) => {
    if (status === 'booked') return t('pages.bookings.booked');
    if (status === 'confirmed') return t('pages.bookings.confirmed');
    if (status === 'completed') return t('pages.bookings.completed');
    if (status === 'canceled_by_consumer' || status === 'canceled_by_provider') return t('pages.bookings.cancelled');
    if (status === 'pending') return t('pages.bookings.pending');
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const statusStyle = getStatusColors(booking.status);
  const statusText = getStatusTranslated(booking.status);
  const isUpcoming = !isPast(parseToLocalTime(booking.start_at)) && ['booked', 'confirmed'].includes(booking.status);
  const canReview = booking.status === 'completed';
  // Can report no-show if session time has passed and status is still booked/confirmed
  const canReportNoShow = isPast(parseToLocalTime(booking.start_at)) && ['booked', 'confirmed'].includes(booking.status);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title={t('pages.booking_detail.title')} />
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
                  <Text style={styles.dateLabel}>{t('pages.booking_detail.date')}</Text>
                  <Text style={[styles.dateValue, isDesktop && styles.dateValueDesktop]}>
                    {formatDate(parseToLocalTime(booking.start_at), 'EEEE, MMMM d, yyyy')}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateContainer}>
                <Ionicons name="time-outline" size={24} color={colors.primary} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateLabel}>{t('pages.booking_detail.time')}</Text>
                  <Text style={[styles.dateValue, isDesktop && styles.dateValueDesktop]}>
                    {formatDate(parseToLocalTime(booking.start_at), 'h:mm a')} - {formatDate(parseToLocalTime(booking.end_at), 'h:mm a')}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Meeting Link - Show for online sessions with upcoming status */}
            {booking.meeting_link && !isPast(parseToLocalTime(booking.start_at)) && (
              <View style={[styles.meetingLinkRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, marginTop: 16 }]}>
                <View style={styles.dateContainer}>
                  <Ionicons name="videocam" size={24} color={colors.success} />
                  <View style={styles.dateInfo}>
                    <Text style={styles.dateLabel}>{t('pages.booking_detail.meeting_link')}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(booking.meeting_link, '_blank');
                        } else {
                          Linking.openURL(booking.meeting_link!);
                        }
                      }}
                    >
                      <Text style={[styles.meetingLinkValue, { color: colors.primary }]} numberOfLines={1}>
                        {t('pages.booking_detail.join_meeting')}
                      </Text>
                    </TouchableOpacity>
                    {booking.waiting_room_enabled && (
                      <Text style={[styles.waitingRoomNote, { color: colors.textMuted }]}>
                        {t('pages.booking_detail.waiting_room_note')}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Tutor Info */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <Text style={styles.cardTitle}>{t('pages.booking_detail.tutor')}</Text>
            <TouchableOpacity
              style={styles.personRow}
              onPress={() => router.push({
                pathname: `/(consumer)/tutor/${booking.tutor_id}`,
                params: { source: 'booking' }
              })}
            >
              <View style={styles.personAvatar}>
                <Text style={styles.personInitial}>
                  {booking.tutor_name?.charAt(0)?.toUpperCase() || 'T'}
                </Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={[styles.personName, isDesktop && styles.personNameDesktop]}>{booking.tutor_name}</Text>
                {booking.tutor_subject && (
                  <Text style={[styles.personSubject, { color: colors.primary }]}>{booking.tutor_subject}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            
            {/* Send Notification to Coach Button */}
            {isUpcoming && (
              <TouchableOpacity
                style={[styles.sendNotificationButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                onPress={() => setShowNotifyModal(true)}
              >
                <Ionicons name="notifications-outline" size={18} color={colors.primary} />
                <Text style={[styles.sendNotificationText, { color: colors.primary }]}>
                  {t('pages.booking_detail.send_notification_to_coach')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Student Info */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <Text style={styles.cardTitle}>{t('pages.booking_detail.student')}</Text>
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
                <Text style={[styles.cardTitle, { marginBottom: 0, marginLeft: 8 }]}>{t('pages.booking_detail.kid_notifications')}</Text>
              </View>
              
              {booking.student_notify_settings.notify_enabled ? (
                <View style={styles.notificationContent}>
                  <View style={[styles.notificationBadge, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={[styles.notificationBadgeText, { color: colors.success }]}>{t('pages.booking_detail.enabled')}</Text>
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
                      <Text style={[styles.historyTitle, { color: colors.textMuted }]}>{t('pages.booking_detail.sent_notifications')}</Text>
                      {booking.kid_notifications.map((notif, index) => (
                        <View key={notif.notification_id || index} style={styles.historyItem}>
                          <Ionicons 
                            name={notif.notification_type === 'email' ? 'mail' : 'chatbubble'} 
                            size={14} 
                            color={colors.success} 
                          />
                          <Text style={[styles.historyText, { color: colors.text }]}>
                            {notif.notification_type === 'email' ? t('pages.add_child.email') : 'SMS'} {t('pages.booking_detail.sent_to')} {notif.sent_to}
                          </Text>
                          <Text style={[styles.historyTime, { color: colors.textMuted }]}>
                            {format(parseToLocalTime(notif.sent_at), 'MMM d, h:mm a')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  
                  {/* No notifications sent yet */}
                  {(!booking.kid_notifications || booking.kid_notifications.length === 0) && (
                    <Text style={[styles.noNotifText, { color: colors.textMuted }]}>
                      {t('pages.booking_detail.reminders_will_be_sent')}
                    </Text>
                  )}
                </View>
              ) : (
                <View style={styles.notificationContent}>
                  <View style={[styles.notificationBadge, { backgroundColor: colors.gray200 }]}>
                    <Ionicons name="notifications-off-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.notificationBadgeText, { color: colors.textMuted }]}>{t('pages.booking_detail.not_enabled')}</Text>
                  </View>
                  <Text style={[styles.noNotifText, { color: colors.textMuted }]}>
                    {t('pages.booking_detail.enable_notifications')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Intake Info */}
          {booking.intake_response && (
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={styles.cardTitle}>{t('pages.booking_detail.lesson_goals')}</Text>
              <Text style={[styles.intakeText, isDesktop && styles.intakeTextDesktop]}>{booking.intake_response.goals}</Text>
              <Text style={styles.intakeLabel}>{t('pages.booking_detail.level')}: {booking.intake_response.current_level}</Text>
              {booking.intake_response.notes && (
                <Text style={[styles.intakeText, isDesktop && styles.intakeTextDesktop]}>{booking.intake_response.notes}</Text>
              )}
            </View>
          )}

          {/* Price */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, isDesktop && styles.priceLabelDesktop]}>{t('pages.booking_detail.total_paid')}</Text>
              <Text style={[styles.priceValue, isDesktop && styles.priceValueDesktop]}>{booking.currency_symbol || '$'}{booking.price_snapshot}</Text>
            </View>
          </View>

          {/* Actions */}
          {isUpcoming && (
            <View style={styles.actionsContainer}>
              {/* Reschedule Button */}
              <TouchableOpacity
                style={[styles.rescheduleButton, isTablet && styles.rescheduleButtonTablet]}
                onPress={() => router.push({
                  pathname: `/(consumer)/tutor/${booking.tutor_id}`,
                  params: {
                    bookingId: booking.booking_id,
                    mode: 'update'
                  }
                })}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                <Text style={[styles.rescheduleButtonText, { color: colors.primary }]}>{t('pages.booking_detail.reschedule')}</Text>
              </TouchableOpacity>
              
              {/* Cancel Button */}
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
                    <Text style={styles.cancelButtonText}>{t('pages.booking_detail.cancel_booking')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Review Section */}
          {canReview && (
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <Text style={styles.cardTitle}>{t('pages.booking_detail.leave_review')}</Text>
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
                    placeholder={t('pages.booking_detail.share_experience')}
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
                      <Text style={[styles.submitReviewText, isTablet && styles.submitReviewTextTablet]}>{t('pages.booking_detail.submit_review')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.writeReviewButton, isTablet && styles.writeReviewButtonTablet]}
                  onPress={() => setShowReview(true)}
                >
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                  <Text style={styles.writeReviewText}>{t('pages.booking_detail.write_review')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* No-Show Report Section */}
          {canReportNoShow && (
            <View style={[styles.card, isTablet && styles.cardTablet, { borderColor: colors.warning, borderWidth: 1 }]}>
              <View style={styles.noShowHeader}>
                <Ionicons name="alert-circle" size={24} color={colors.warning} />
                <Text style={[styles.cardTitle, { color: colors.warning, marginLeft: 8 }]}>{t('pages.booking_detail.session_issue')}</Text>
              </View>
              <Text style={[styles.noShowText, { color: colors.textMuted }]}>
                {t('pages.booking_detail.session_issue_desc')}
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
                    <Text style={styles.noShowButtonText}>{t('pages.booking_detail.report_no_show')}</Text>
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
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  personNameDesktop: {
    fontSize: 18,
  },
  personInfo: {
    flex: 1,
  },
  personSubject: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
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
  actionsContainer: {
    gap: 12,
  },
  rescheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  rescheduleButtonTablet: {
    paddingVertical: 16,
  },
  rescheduleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  sendNotificationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  sendNotificationText: {
    fontSize: 14,
    fontWeight: '500',
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
  // Meeting link styles
  meetingLinkRow: {
    marginTop: 16,
  },
  meetingLinkValue: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  waitingRoomNote: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
