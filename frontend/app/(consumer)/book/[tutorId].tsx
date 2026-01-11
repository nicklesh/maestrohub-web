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
  policies: {
    cancel_window_hours: number;
    no_show_policy: string;
  };
}

interface PaymentProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const PAYMENT_PROVIDERS: PaymentProvider[] = [
  { id: 'stripe', name: 'Credit/Debit Card', icon: 'card', color: '#635BFF' },
  { id: 'paypal', name: 'PayPal', icon: 'logo-paypal', color: '#003087' },
  { id: 'google_pay', name: 'Google Pay', icon: 'logo-google', color: '#4285F4' },
  { id: 'apple_pay', name: 'Apple Pay', icon: 'logo-apple', color: '#000000' },
];

type Step = 'student' | 'intake' | 'payment' | 'confirm';

export default function BookingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { token } = useAuth();
  const { tutorId, startAt, endAt } = useLocalSearchParams<{
    tutorId: string;
    startAt: string;
    endAt: string;
  }>();

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
  
  // Payment provider selection
  const [selectedProvider, setSelectedProvider] = useState<string>('stripe');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  
  // Intake form
  const [goals, setGoals] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);

  const styles = getStyles(colors);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tutorRes, studentsRes] = await Promise.all([
        api.get(`/tutors/${tutorId}`),
        api.get('/students'),
      ]);
      setTutor(tutorRes.data);
      setStudents(studentsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load booking data');
    } finally {
      setLoading(false);
    }
  };

  const createHold = async () => {
    try {
      const response = await api.post('/booking-holds', {
        tutor_id: tutorId,
        start_at: startAt,
        duration_minutes: tutor?.duration_minutes || 60,
      });
      setHoldId(response.data.hold_id);
      return response.data.hold_id;
    } catch (error: any) {
      if (error.response?.status === 409) {
        Alert.alert('Slot Unavailable', 'This time slot is no longer available. Please select another time.');
        router.back();
      } else {
        Alert.alert('Error', 'Failed to reserve slot');
      }
      return null;
    }
  };

  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setSubmitting(true);
    const newHoldId = await createHold();
    setSubmitting(false);
    if (newHoldId) {
      setStep('intake');
    }
  };

  const handleIntakeSubmit = () => {
    if (!goals.trim()) {
      Alert.alert('Required', 'Please enter learning goals');
      return;
    }
    if (!currentLevel.trim()) {
      Alert.alert('Required', 'Please enter current level');
      return;
    }
    if (!policyAcknowledged) {
      Alert.alert('Required', 'Please acknowledge the policies');
      return;
    }
    setStep('payment');
  };

  const handlePaymentWithProvider = async () => {
    if (!holdId || !tutor || !selectedStudent) return;
    
    setSubmitting(true);
    try {
      // Create payment session with selected provider
      const amount = tutor.base_price * 100; // cents
      const response = await api.post('/payments/create-session', {
        booking_hold_id: holdId,
        amount_cents: amount,
        provider: selectedProvider,
        success_url: `${window.location.origin}/(consumer)/book/${tutorId}?payment=success&hold_id=${holdId}`,
        cancel_url: `${window.location.origin}/(consumer)/book/${tutorId}?payment=cancelled`,
      });
      
      // For simulation, we'll mock the payment success
      // In production, this would redirect to the payment provider
      if (selectedProvider === 'stripe' && response.data.checkout_url) {
        // Would redirect: window.location.href = response.data.checkout_url;
        // For demo, simulate success
        simulatePaymentSuccess(response.data.payment_intent_id || `sim_${Date.now()}`);
      } else {
        // Simulate payment for other providers
        simulatePaymentSuccess(`${selectedProvider}_${Date.now()}`);
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Failed to initiate payment. Please try again.');
      setSubmitting(false);
    }
  };

  const simulatePaymentSuccess = (paymentIntentId: string) => {
    // Simulate payment provider callback
    setTimeout(() => {
      setPaymentId(paymentIntentId);
      setPaymentSuccess(true);
      setSubmitting(false);
      setStep('confirm');
    }, 1500);
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
      });
      
      Alert.alert(
        'Booking Confirmed!',
        'Your lesson has been booked successfully.',
        [{ text: 'OK', onPress: () => router.replace('/(consumer)/bookings') }]
      );
    } catch (error) {
      console.error('Booking failed:', error);
      Alert.alert('Error', 'Failed to confirm booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBack title="Book Lesson" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderStudentStep = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Select Student</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Who will be taking this lesson?</Text>
      
      {students.length === 0 ? (
        <View style={styles.noStudents}>
          <Ionicons name="person-add-outline" size={isTablet ? 56 : 48} color={colors.textMuted} />
          <Text style={styles.noStudentsText}>No students added yet</Text>
          <TouchableOpacity
            style={[styles.addStudentButton, isTablet && styles.addStudentButtonTablet]}
            onPress={() => router.push('/(consumer)/students')}
          >
            <Text style={[styles.addStudentButtonText, isTablet && styles.addStudentButtonTextTablet]}>Add Student</Text>
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
                {student.grade && <Text style={styles.studentGrade}>Grade {student.grade}</Text>}
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
        <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Learning Goals</Text>
        <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Help the tutor prepare for the session</Text>
        
        <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>What do you want to learn? *</Text>
        <TextInput
          style={[styles.textArea, isTablet && styles.textAreaTablet]}
          placeholder="e.g., Need help with algebra equations, preparing for SAT math..."
          placeholderTextColor={colors.textMuted}
          value={goals}
          onChangeText={setGoals}
          multiline
          numberOfLines={3}
        />
        
        <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>Current level *</Text>
        <TextInput
          style={[styles.input, isTablet && styles.inputTablet]}
          placeholder="e.g., 8th grade, Beginner, Intermediate..."
          placeholderTextColor={colors.textMuted}
          value={currentLevel}
          onChangeText={setCurrentLevel}
        />
        
        <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>Additional notes (optional)</Text>
        <TextInput
          style={[styles.textArea, isTablet && styles.textAreaTablet]}
          placeholder="Anything else the tutor should know..."
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
            I acknowledge the tutor's cancellation policy ({tutor?.policies.cancel_window_hours}h notice required)
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.primaryButton, isTablet && styles.primaryButtonTablet]} onPress={handleIntakeSubmit}>
          <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>Continue to Payment</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderPaymentStep = () => (
    <ScrollView style={styles.stepContent} contentContainerStyle={styles.intakeScroll}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Payment Method</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>
        Select your preferred payment method
      </Text>
      
      {/* Order Summary */}
      <View style={[styles.paymentSummaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.paymentSummaryTitle, { color: colors.text }]}>Order Summary</Text>
        <View style={styles.paymentSummaryRow}>
          <Text style={[styles.paymentSummaryLabel, { color: colors.textMuted }]}>
            {tutor?.duration_minutes || 60} min lesson with {tutor?.user_name}
          </Text>
          <Text style={[styles.paymentSummaryValue, { color: colors.text }]}>
            ${tutor?.base_price?.toFixed(2)}
          </Text>
        </View>
        <View style={[styles.paymentSummaryRow, styles.paymentTotalRow]}>
          <Text style={[styles.paymentTotalLabel, { color: colors.text }]}>Total</Text>
          <Text style={[styles.paymentTotalValue, { color: colors.primary }]}>
            ${tutor?.base_price?.toFixed(2)}
          </Text>
        </View>
      </View>
      
      {/* Payment Provider Options */}
      <View style={styles.paymentProvidersContainer}>
        {PAYMENT_PROVIDERS.map((provider) => (
          <TouchableOpacity
            key={provider.id}
            style={[
              styles.paymentProviderCard,
              { 
                borderColor: selectedProvider === provider.id ? colors.primary : colors.border,
                backgroundColor: colors.surface
              },
              selectedProvider === provider.id && { borderWidth: 2 }
            ]}
            onPress={() => setSelectedProvider(provider.id)}
          >
            <View style={styles.paymentProviderLeft}>
              <View style={[styles.providerIconContainer, { backgroundColor: provider.color + '15' }]}>
                <Ionicons name={provider.icon as any} size={24} color={provider.color} />
              </View>
              <Text style={[styles.paymentProviderName, { color: colors.text }]}>
                {provider.name}
              </Text>
            </View>
            {selectedProvider === provider.id && (
              <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Security Note */}
      <View style={[styles.securityNote, { backgroundColor: colors.successLight }]}>
        <Ionicons name="shield-checkmark" size={20} color={colors.success} />
        <Text style={[styles.securityNoteText, { color: colors.success }]}>
          Secure payment • Your card details are never stored on our servers
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
            <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>Processing...</Text>
          </View>
        ) : (
          <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>
            Pay ${tutor?.base_price?.toFixed(2)}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      {/* Payment Success Banner */}
      {paymentSuccess && (
        <View style={[styles.successBanner, { backgroundColor: colors.successLight }]}>
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
          <Text style={[styles.successBannerText, { color: colors.success }]}>
            Payment successful!
          </Text>
        </View>
      )}
      
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Confirm Booking</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Review your booking details</Text>
      
      <View style={[styles.summaryCard, isTablet && styles.summaryCardTablet]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>Tutor</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>{tutor?.user_name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>Student</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>{selectedStudent?.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>Date</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>
            {format(parseISO(startAt!), 'EEEE, MMMM d, yyyy')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>Time</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop]}>
            {format(parseISO(startAt!), 'h:mm a')} - {format(parseISO(endAt!), 'h:mm a')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, isDesktop && styles.summaryLabelDesktop]}>Payment</Text>
          <Text style={[styles.summaryValue, isDesktop && styles.summaryValueDesktop, { color: colors.success }]}>
            {paymentSuccess ? '✓ Paid' : 'Pending'}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowTotal]}>
          <Text style={styles.summaryLabelTotal}>Total</Text>
          <Text style={[styles.summaryValueTotal, isDesktop && styles.summaryValueTotalDesktop]}>${tutor?.base_price}</Text>
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
            Complete Booking
          </Text>
        )}
      </TouchableOpacity>
    </View>
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
