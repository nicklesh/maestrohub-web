import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import { useAuth } from '@/src/context/AuthContext';
import AppHeader from '@/src/components/AppHeader';
import { format, parseISO } from 'date-fns';

interface Student {
  student_id: string;
  name: string;
  age?: number;
  grade?: string;
}

interface TutorProfile {
  tutor_id: string;
  user_name: string;
  base_price: number;
  duration_minutes: number;
  currency?: string;
  currency_symbol?: string;
  policies: {
    cancel_window_hours: number;
    no_show_policy: string;
  };
}

type Step = 'student' | 'intake' | 'payment' | 'confirm';

export default function BookingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  const { token, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{
    tutorId: string;
    startAt: string;
    endAt: string;
  }>();
  
  const tutorId = params.tutorId;
  const startAt = params.startAt;
  const endAt = params.endAt;

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 560 : isTablet ? 480 : undefined;

  const [step, setStep] = useState<Step>('student');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [paramsError, setParamsError] = useState<string | null>(null);
  
  // Payment state
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  
  // Intake form
  const [goals, setGoals] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);

  const styles = getStyles(colors);

  useEffect(() => {
    // Wait for auth to finish loading and token to be available before loading data
    if (!authLoading && token) {
      loadData();
    } else if (!authLoading && !token) {
      // Auth finished loading but no token - user not logged in
      console.log('No auth token available after auth loaded');
      setLoading(false);
      showError('Please log in to book a session');
      router.replace('/login');
    }
  }, [authLoading, token, tutorId]);

  const loadData = async () => {
    if (!token) {
      console.log('No token available, skipping loadData');
      return;
    }
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      console.log('Loading booking data with token');
      const [tutorRes, studentsRes] = await Promise.all([
        api.get(`/tutors/${tutorId}`),
        api.get('/students', { headers }),
      ]);
      setTutor(tutorRes.data);
      setStudents(studentsRes.data);
      console.log('Loaded tutor:', tutorRes.data.user_name, 'and', studentsRes.data.length, 'students');
    } catch (error: any) {
      console.error('Failed to load data:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data
      });
      showError('Failed to load booking data');
    } finally {
      setLoading(false);
    }
  };

  const createHold = async () => {
    // Validate required params
    if (!startAt || !tutorId) {
      console.error('Missing required params:', { startAt, tutorId, endAt });
      showError('Missing booking parameters. Please go back and try again.');
      return null;
    }
    
    try {
      // Ensure datetime is in valid ISO format
      // URL params might have URL encoding issues, so decode and clean up
      let cleanStartAt = decodeURIComponent(startAt);
      
      // If the datetime doesn't have seconds, add them
      if (cleanStartAt.length === 16) {
        cleanStartAt = cleanStartAt + ':00';
      }
      
      // Ensure it's a valid date
      const dateTest = new Date(cleanStartAt);
      if (isNaN(dateTest.getTime())) {
        console.error('Invalid datetime format:', cleanStartAt);
        showError('Invalid booking time. Please go back and select a time slot again.');
        return null;
      }
      
      // Convert to ISO string for the API (includes timezone info)
      const isoStartAt = dateTest.toISOString();
      
      console.log('Creating hold with:', {
        tutor_id: tutorId,
        start_at: isoStartAt,
        original_start_at: startAt,
        cleaned_start_at: cleanStartAt,
        duration_minutes: tutor?.duration_minutes || 60,
        token: token ? 'present' : 'missing'
      });
      
      const response = await api.post('/booking-holds', {
        tutor_id: tutorId,
        start_at: isoStartAt,
        duration_minutes: tutor?.duration_minutes || 60,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Hold created:', response.data);
      setHoldId(response.data.hold_id);
      return response.data.hold_id;
    } catch (error: any) {
      console.error('Hold creation error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      if (error.response?.status === 409) {
        showInfo('This time slot is no longer available. Please select another time.', 'Slot Unavailable');
        router.back();
      } else {
        const errorMsg = error.response?.data?.detail;
        const displayError = Array.isArray(errorMsg) ? errorMsg[0]?.msg || 'Failed to reserve slot' : (errorMsg || 'Failed to reserve slot');
        showInfo(displayError, 'Error');
      }
      return null;
    }
  };

  // Helper for web-compatible alerts
  const showAlert = (title: string, message: string, buttons?: Array<{ text: string; onPress?: () => void; style?: string }>) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (buttons && buttons.length > 1) {
        // Multi-button: use confirm
        const result = window.confirm(`${title}\n\n${message}`);
        if (result && buttons[1]?.onPress) {
          buttons[1].onPress();
        } else if (!result && buttons[0]?.onPress) {
          buttons[0].onPress();
        }
      } else {
        // Single button: use alert
        showInfo(message, title);
        if (buttons?.[0]?.onPress) {
          buttons[0].onPress();
        }
      }
    } else {
      // On native, simplified approach - show info and execute first button action
      showInfo(message, title);
      if (buttons?.[0]?.onPress) {
        buttons[0].onPress();
      }
    }
  };

  const handleSelectStudent = async (student: Student) => {
    // Prevent double-click
    if (submitting) return;
    
    setSelectedStudent(student);
    setSubmitting(true);
    const newHoldId = await createHold();
    setSubmitting(false);
    if (newHoldId) {
      setStep('intake');
    }
  };

  const handleIntakeSubmit = () => {
    console.log('handleIntakeSubmit called', { goals, currentLevel, policyAcknowledged });
    
    if (!goals.trim()) {
      showError('Please enter learning goals');
      return;
    }
    if (!currentLevel.trim()) {
      showError('Please enter current level');
      return;
    }
    if (!policyAcknowledged) {
      showError('Please acknowledge the cancellation policy');
      return;
    }
    
    console.log('Validation passed, calling checkPaymentMethodsAndProceed');
    // Check if user has payment methods before proceeding
    checkPaymentMethodsAndProceed();
  };

  const checkPaymentMethodsAndProceed = async () => {
    console.log('checkPaymentMethodsAndProceed called, token:', token ? 'present' : 'missing');
    
    if (!token) {
      showError('You must be logged in to proceed');
      return;
    }
    
    setSubmitting(true);
    try {
      console.log('Fetching payment providers...');
      const response = await api.get('/payment-providers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Payment providers response:', response.data);
      const linkedProviders = response.data.linked_providers || [];
      
      if (linkedProviders.length === 0) {
        // No payment methods - redirect to billing
        setSubmitting(false);
        showAlert(
          'Payment Method Required',
          'Please add a payment method before booking a session.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Add Payment Method', 
              onPress: () => {
                router.push('/(consumer)/billing');
              }
            }
          ]
        );
        return;
      }
      
      // Has payment methods - proceed to payment step
      console.log('User has payment methods, proceeding to payment step');
      setSubmitting(false);
      setStep('payment');
    } catch (error: any) {
      console.error('Error checking payment methods:', error);
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      setSubmitting(false);
      const errorMessage = error.response?.data?.detail || 'Failed to verify payment methods. Please try again.';
      showError(errorMessage);
    }
  };

  const handlePaymentWithProvider = async () => {
    if (!holdId || !tutor || !selectedStudent) return;
    
    setSubmitting(true);
    try {
      // Process payment using the new API with auto-charge and fallback
      const amount = tutor.base_price * 100; // cents
      const response = await api.post('/payments/process', {
        booking_hold_id: holdId,
        amount_cents: amount,
        // provider_id is optional - backend will use default
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Payment successful
        setPaymentId(response.data.payment_id);
        setPaymentSuccess(true);
        
        // If payment used fallback, notify user
        if (response.data.fallback) {
          showInfo(`Payment was processed using ${response.data.provider_used} as your primary method was unavailable.`, 'Payment Processed');
        }
        
        setSubmitting(false);
        setStep('confirm');
      } else if (response.data.redirect_to_billing) {
        // No payment method configured
        showError(response.data.message, 'Payment Method Required');
        setSubmitting(false);
        if (Platform.OS === 'web') {
          if (window.confirm('Would you like to add a payment method now?')) {
            router.push('/(consumer)/billing');
          }
        } else {
          router.push('/(consumer)/billing');
        }
      } else {
        // Payment failed
        showError(response.data.message || 'Unable to process payment. Please try again.', 'Payment Failed');
        setSubmitting(false);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to process payment. Please try again.';
      showError(errorMsg);
      setSubmitting(false);
    }
  };

  const handlePaymentSubmit = () => {
    handlePaymentWithProvider();
  };

  const handleConfirmBooking = async () => {
    if (!holdId || !selectedStudent) return;
    
    setSubmitting(true);
    try {
      await api.post('/bookings', {
        hold_id: holdId,
        student_id: selectedStudent.student_id,
        intake: {
          goals,
          current_level: currentLevel,
          notes,
          policy_acknowledged: policyAcknowledged,
        },
        payment_id: paymentId,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Navigate directly to bookings page
      router.replace('/(consumer)/bookings');
    } catch (error) {
      console.error('Booking failed:', error);
      showError('Failed to confirm booking. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBack title={t('pages.booking.title')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderStudentStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>{t('pages.booking.select_student')}</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>{t('pages.booking.who_taking_lesson')}</Text>
      
      {students.length === 0 ? (
        <View style={styles.noStudents}>
          <Ionicons name="person-add-outline" size={isTablet ? 56 : 48} color={colors.textMuted} />
          <Text style={styles.noStudentsText}>{t('pages.booking.no_students_added')}</Text>
          <TouchableOpacity
            style={[styles.addStudentButton, isTablet && styles.addStudentButtonTablet]}
            onPress={() => router.push('/(consumer)/students')}
          >
            <Text style={[styles.addStudentButtonText, isTablet && styles.addStudentButtonTextTablet]}>{t('pages.booking.add_student')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.studentsList}>
          {students.map((student) => (
            <TouchableOpacity
              key={student.student_id}
              style={[
                styles.studentCard,
                isTablet && styles.studentCardTablet,
                selectedStudent?.student_id === student.student_id && styles.studentCardSelected,
              ]}
              onPress={() => handleSelectStudent(student)}
              disabled={submitting}
            >
              <View style={[styles.studentAvatar, isTablet && styles.studentAvatarTablet]}>
                <Text style={[styles.studentInitial, isTablet && styles.studentInitialTablet]}>{student.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={[styles.studentName, isDesktop && styles.studentNameDesktop]}>{student.name}</Text>
                {student.grade && <Text style={styles.studentGrade}>{t('pages.booking.grade')} {student.grade}</Text>}
              </View>
              {submitting && selectedStudent?.student_id === student.student_id && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderIntakeStep = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <ScrollView style={styles.stepContent} contentContainerStyle={styles.intakeScroll}>
        <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>{t('pages.booking.learning_goals')}</Text>
        <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>{t('pages.booking.help_tutor_prepare')}</Text>
        
        <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>{t('pages.booking.what_to_learn')} *</Text>
        <TextInput
          style={[styles.textArea, isTablet && styles.textAreaTablet]}
          placeholder={t('pages.booking.what_to_learn_placeholder')}
          placeholderTextColor={colors.textMuted}
          value={goals}
          onChangeText={setGoals}
          multiline
          numberOfLines={3}
        />
        
        <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>{t('pages.booking.current_level')} *</Text>
        <TextInput
          style={[styles.input, isTablet && styles.inputTablet]}
          placeholder={t('pages.booking.current_level_placeholder')}
          placeholderTextColor={colors.textMuted}
          value={currentLevel}
          onChangeText={setCurrentLevel}
        />
        
        <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>{t('pages.booking.additional_notes')}</Text>
        <TextInput
          style={[styles.textArea, isTablet && styles.textAreaTablet]}
          placeholder={t('pages.booking.additional_notes_placeholder')}
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
        
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setPolicyAcknowledged(!policyAcknowledged)}
        >
          <View style={[styles.checkbox, policyAcknowledged && styles.checkboxChecked]}>
            {policyAcknowledged && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={[styles.checkboxLabel, isDesktop && styles.checkboxLabelDesktop]}>
            {t('pages.booking.acknowledge_policy', { hours: tutor?.policies.cancel_window_hours })}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.primaryButton, isTablet && styles.primaryButtonTablet]} onPress={handleIntakeSubmit}>
          <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>{t('pages.booking.continue_to_payment')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderPaymentStep = () => (
    <ScrollView style={styles.stepContent} contentContainerStyle={styles.intakeScroll}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>{t('pages.booking.payment_method')}</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>
        {t('pages.booking.select_payment_method')}
      </Text>
      
      {/* Order Summary */}
      <View style={[styles.paymentSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.paymentSummaryTitle, { color: colors.text }]}>{t('pages.booking.order_summary')}</Text>
        <View style={styles.paymentSummaryRow}>
          <Text style={[styles.paymentSummaryLabel, { color: colors.textMuted }]}>
            {t('pages.booking.min_lesson_with', { minutes: tutor?.duration_minutes || 60, name: tutor?.user_name })}
          </Text>
          <Text style={[styles.paymentSummaryValue, { color: colors.text }]}>
            {tutor?.currency_symbol || '$'}{tutor?.base_price?.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.paymentSummaryRow, styles.paymentTotalRow]}>
          <Text style={[styles.paymentTotalLabel, { color: colors.text }]}>{t('pages.booking.total')}</Text>
          <Text style={[styles.paymentTotalValue, { color: colors.primary }]}>
            {tutor?.currency_symbol || '$'}{tutor?.base_price?.toFixed(2)}
          </Text>
        </View>
      </View>
      
      {/* Auto-Charge Info */}
      <View style={[styles.paymentSummaryCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Ionicons name="flash" size={20} color={colors.primary} />
          <Text style={[styles.paymentSummaryTitle, { color: colors.primary, marginBottom: 0 }]}>{t('pages.booking.auto_payment')}</Text>
        </View>
        <Text style={{ fontSize: 13, color: colors.primary, lineHeight: 18 }}>
          {t('pages.booking.auto_payment_desc')}
        </Text>
      </View>
      
      {/* Security Note */}
      <View style={[styles.securityNote, { backgroundColor: colors.successLight }]}>
        <Ionicons name="shield-checkmark" size={20} color={colors.success} />
        <Text style={[styles.securityNoteText, { color: colors.success }]}>
          {t('pages.booking.secure_payment')}
        </Text>
      </View>
      
      <TouchableOpacity 
        style={[styles.primaryButton, isTablet && styles.primaryButtonTablet, submitting && { opacity: 0.7 }]} 
        onPress={handlePaymentSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>Processing Payment...</Text>
          </View>
        ) : (
          <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>
            {t('pages.booking.pay_amount', { amount: `${tutor?.currency_symbol || '$'}${tutor?.base_price?.toFixed(2)}` })}
          </Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={{ alignItems: 'center', marginTop: 16 }}
        onPress={() => router.push('/(consumer)/billing')}
      >
        <Text style={{ color: colors.primary, fontSize: 14 }}>
          {t('pages.booking.manage_payment_methods')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderConfirmStep = () => (
    <ScrollView style={styles.stepContent} contentContainerStyle={styles.confirmScrollContent}>
      {/* Payment Success Banner */}
      {paymentSuccess && (
        <View style={[styles.successBanner, { backgroundColor: colors.successLight }]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={[styles.successBannerText, { color: colors.success }]}>
            {t('messages.success.payment_successful')}
          </Text>
        </View>
      )}
      
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>{t('pages.booking.confirm_booking')}</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>{t('pages.booking.review_details')}</Text>
      
      <View style={[styles.summaryCard, isTablet && styles.summaryCardTablet]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>{t('pages.booking.tutor_label')}</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>{tutor?.user_name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>{t('pages.booking.student_label')}</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>{selectedStudent?.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>{t('pages.booking.date_label')}</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>
            {startAt ? format(parseISO(startAt), 'EEEE, MMMM d, yyyy') : '-'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>{t('pages.booking.time_label')}</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>
            {startAt && endAt ? `${format(parseISO(startAt), 'h:mm a')} - ${format(parseISO(endAt), 'h:mm a')}` : '-'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>{t('pages.booking.payment_label')}</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop, { color: colors.success }]}>
            {paymentSuccess ? `✓ ${t('pages.booking.paid')}` : t('pages.bookings.pending')}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowTotal]}>
          <Text style={styles.summaryLabelTotal}>{t('pages.booking.total')}</Text>
          <Text style={[styles.summaryValueTotal, isDesktop && styles.summaryValueTotalDesktop]}>{tutor?.currency_symbol || '$'}{tutor?.base_price}</Text>
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, isTablet && styles.primaryButtonTablet, submitting && styles.buttonDisabled]}
        onPress={handleConfirmBooking}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>
            {t('common.done')}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title="Book Lesson" />

      {/* Progress */}
      <View style={[styles.progress, isTablet && styles.progressTablet, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        {['student', 'intake', 'payment', 'confirm'].map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressStep,
              (step === s || i < ['student', 'intake', 'payment', 'confirm'].indexOf(step)) &&
                styles.progressStepActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        {step === 'student' && renderStudentStep()}
        {step === 'intake' && renderIntakeStep()}
        {step === 'payment' && renderPaymentStep()}
        {step === 'confirm' && renderConfirmStep()}
      </View>
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
  contentWrapper: {
    flex: 1,
  },
  progress: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  progressTablet: {
    marginBottom: 32,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: colors.primary,
  },
  keyboardView: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  intakeScroll: {
    paddingBottom: 40,
  },
  confirmScrollContent: {
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  stepTitleDesktop: {
    fontSize: 28,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 24,
  },
  stepSubtitleDesktop: {
    fontSize: 16,
    marginBottom: 32,
  },
  noStudents: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  noStudentsText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
  },
  addStudentButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addStudentButtonTablet: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  addStudentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  addStudentButtonTextTablet: {
    fontSize: 18,
  },
  studentsList: {
    gap: 12,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 12,
  },
  studentCardTablet: {
    padding: 20,
    borderRadius: 16,
  },
  studentCardSelected: {
    borderColor: colors.primary,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarTablet: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  studentInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  studentInitialTablet: {
    fontSize: 24,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  studentNameDesktop: {
    fontSize: 18,
  },
  studentGrade: {
    fontSize: 14,
    color: colors.textMuted,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  inputLabelDesktop: {
    fontSize: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  inputTablet: {
    padding: 18,
    fontSize: 17,
    borderRadius: 14,
  },
  textArea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textAreaTablet: {
    padding: 18,
    fontSize: 17,
    borderRadius: 14,
    minHeight: 120,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  checkboxLabelDesktop: {
    fontSize: 15,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  summaryCardTablet: {
    borderRadius: 20,
    padding: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryRowTotal: {
    borderBottomWidth: 0,
    paddingTop: 16,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  summaryLabelDesktop: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  summaryValueDesktop: {
    fontSize: 16,
  },
  summaryLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  summaryValueTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  summaryValueTotalDesktop: {
    fontSize: 28,
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  paymentNoteTablet: {
    padding: 16,
    borderRadius: 14,
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
  },
  paymentNoteTextDesktop: {
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonTablet: {
    borderRadius: 14,
    padding: 18,
  },
  buttonDisabled: {
    backgroundColor: colors.gray300,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonTextTablet: {
    fontSize: 18,
  },
  // Payment Provider Styles
  paymentSummaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  paymentSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentSummaryLabel: {
    fontSize: 14,
    flex: 1,
  },
  paymentSummaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  paymentTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
  },
  paymentTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  paymentTotalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  paymentProvidersContainer: {
    marginBottom: 16,
  },
  paymentProviderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  paymentProviderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentProviderName: {
    fontSize: 15,
    fontWeight: '600',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 13,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  successBannerText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
