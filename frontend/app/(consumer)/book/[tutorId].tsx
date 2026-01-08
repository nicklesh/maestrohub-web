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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';
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

type Step = 'student' | 'intake' | 'confirm';

export default function BookingScreen() {
  const router = useRouter();
  const { tutorId, startAt, endAt } = useLocalSearchParams<{
    tutorId: string;
    startAt: string;
    endAt: string;
  }>();

  const [step, setStep] = useState<Step>('student');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tutor, setTutor] = useState<TutorProfile | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  
  // Intake form
  const [goals, setGoals] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);

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
    setStep('confirm');
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const renderStudentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Student</Text>
      <Text style={styles.stepSubtitle}>Who will be taking this lesson?</Text>
      
      {students.length === 0 ? (
        <View style={styles.noStudents}>
          <Ionicons name="person-add-outline" size={48} color={colors.textMuted} />
          <Text style={styles.noStudentsText}>No students added yet</Text>
          <TouchableOpacity
            style={styles.addStudentButton}
            onPress={() => router.push('/(consumer)/students')}
          >
            <Text style={styles.addStudentButtonText}>Add Student</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.studentsList}>
          {students.map((student) => (
            <TouchableOpacity
              key={student.student_id}
              style={[
                styles.studentCard,
                selectedStudent?.student_id === student.student_id && styles.studentCardSelected,
              ]}
              onPress={() => handleSelectStudent(student)}
              disabled={submitting}
            >
              <View style={styles.studentAvatar}>
                <Text style={styles.studentInitial}>{student.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
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
        <Text style={styles.stepTitle}>Learning Goals</Text>
        <Text style={styles.stepSubtitle}>Help the tutor prepare for the session</Text>
        
        <Text style={styles.inputLabel}>What do you want to learn? *</Text>
        <TextInput
          style={styles.textArea}
          placeholder="e.g., Need help with algebra equations, preparing for SAT math..."
          placeholderTextColor={colors.textMuted}
          value={goals}
          onChangeText={setGoals}
          multiline
          numberOfLines={3}
        />
        
        <Text style={styles.inputLabel}>Current level *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., 8th grade, Beginner, Intermediate..."
          placeholderTextColor={colors.textMuted}
          value={currentLevel}
          onChangeText={setCurrentLevel}
        />
        
        <Text style={styles.inputLabel}>Additional notes (optional)</Text>
        <TextInput
          style={styles.textArea}
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
          <Text style={styles.checkboxLabel}>
            I acknowledge the tutor's cancellation policy ({tutor?.policies.cancel_window_hours}h notice required)
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.primaryButton} onPress={handleIntakeSubmit}>
          <Text style={styles.primaryButtonText}>Continue to Review</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Confirm Booking</Text>
      <Text style={styles.stepSubtitle}>Review your booking details</Text>
      
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tutor</Text>
          <Text style={styles.summaryValue}>{tutor?.user_name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Student</Text>
          <Text style={styles.summaryValue}>{selectedStudent?.name}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Date</Text>
          <Text style={styles.summaryValue}>
            {format(parseISO(startAt!), 'EEEE, MMMM d, yyyy')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Time</Text>
          <Text style={styles.summaryValue}>
            {format(parseISO(startAt!), 'h:mm a')} - {format(parseISO(endAt!), 'h:mm a')}
          </Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowTotal]}>
          <Text style={styles.summaryLabelTotal}>Total</Text>
          <Text style={styles.summaryValueTotal}>${tutor?.base_price}</Text>
        </View>
      </View>
      
      <View style={styles.paymentNote}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={styles.paymentNoteText}>
          Payment will be processed when you confirm the booking.
        </Text>
      </View>
      
      <TouchableOpacity
        style={[styles.primaryButton, submitting && styles.buttonDisabled]}
        onPress={handleConfirmBooking}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Confirm & Pay ${tutor?.base_price}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Lesson</Text>
        <View style={styles.backButton} />
      </View>

      {/* Progress */}
      <View style={styles.progress}>
        {['student', 'intake', 'confirm'].map((s, i) => (
          <View
            key={s}
            style={[
              styles.progressStep,
              (step === s || i < ['student', 'intake', 'confirm'].indexOf(step)) &&
                styles.progressStepActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      {step === 'student' && renderStudentStep()}
      {step === 'intake' && renderIntakeStep()}
      {step === 'confirm' && renderConfirmStep()}
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
  progress: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
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
  stepSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 24,
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
  addStudentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  studentInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
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
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
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
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
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
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  paymentNoteText: {
    flex: 1,
    fontSize: 13,
    color: colors.primaryDark,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: colors.gray300,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
