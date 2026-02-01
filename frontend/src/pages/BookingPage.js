import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, User, Clock, Calendar, FileText, CreditCard, Check, Loader2, 
  AlertCircle, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';
import './BookingPage.css';

export default function BookingPage() {
  const { tutorId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError, showInfo } = useToast();

  const startAt = searchParams.get('startAt');
  const endAt = searchParams.get('endAt');
  const holdIdParam = searchParams.get('holdId');

  const [step, setStep] = useState('student'); // student -> intake -> payment -> confirm
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tutor, setTutor] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [holdId, setHoldId] = useState(holdIdParam);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Intake form
  const [goals, setGoals] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);

  useEffect(() => {
    loadData();
  }, [tutorId]);

  const loadData = async () => {
    try {
      const [tutorRes, studentsRes] = await Promise.all([
        api.get(`/tutors/${tutorId}`),
        api.get('/students').catch(() => ({ data: [] }))
      ]);
      setTutor(tutorRes.data);
      setStudents(studentsRes.data || []);
      
      // Auto-select first student if only one
      if (studentsRes.data?.length === 1) {
        setSelectedStudent(studentsRes.data[0]);
      }
    } catch (err) {
      showError('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHold = async () => {
    if (!holdId && startAt) {
      try {
        const response = await api.post('/booking-holds', {
          tutor_id: tutorId,
          start_at: startAt,
          duration_minutes: tutor?.duration_minutes || 60
        });
        setHoldId(response.data.hold_id);
        return response.data.hold_id;
      } catch (err) {
        throw new Error(err.response?.data?.detail || 'Failed to hold slot');
      }
    }
    return holdId;
  };

  const handleSubmitBooking = async () => {
    if (!selectedStudent) {
      showError('Please select a student');
      return;
    }

    if (!policyAcknowledged) {
      showError('Please acknowledge the cancellation policy');
      return;
    }

    setSubmitting(true);
    try {
      let currentHoldId = holdId;
      if (!currentHoldId) {
        currentHoldId = await handleCreateHold();
      }

      const bookingData = {
        hold_id: currentHoldId,
        student_id: selectedStudent.student_id,
        intake: {
          goals: goals || 'Not specified',
          current_level: currentLevel || 'Not specified',
          notes: notes || null,
          policy_acknowledged: policyAcknowledged
        }
      };

      await api.post('/bookings', bookingData);
      showSuccess(t('pages.tutor_detail.booking_success') || 'Session booked successfully!');
      navigate('/bookings');
    } catch (err) {
      let errorMessage = 'Failed to book session';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail.map(e => e.msg || String(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      }
      showError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const steps = [
    { id: 'student', label: t('booking.step_student') || 'Student' },
    { id: 'intake', label: t('booking.step_intake') || 'Details' },
    { id: 'confirm', label: t('booking.step_confirm') || 'Confirm' }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  if (loading) {
    return (
      <div className="booking-page" style={{ backgroundColor: colors.background }}>
        <AppHeader showBack={true} title={t('booking.title') || 'Book Session'} />
        <div className="loading-state">
          <Loader2 size={32} color={colors.primary} className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="booking-page" style={{ backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('booking.title') || 'Book Session'} />

      <main className="booking-main" style={{ paddingTop: '76px' }}>
        {/* Progress Steps */}
        <div className="steps-container" style={{ backgroundColor: colors.surface }}>
          {steps.map((s, idx) => (
            <React.Fragment key={s.id}>
              <div className={`step ${idx <= currentStepIndex ? 'active' : ''}`}>
                <div 
                  className="step-circle"
                  style={{ 
                    backgroundColor: idx < currentStepIndex ? colors.success : idx === currentStepIndex ? colors.primary : colors.gray300,
                    color: '#fff'
                  }}
                >
                  {idx < currentStepIndex ? <Check size={14} /> : idx + 1}
                </div>
                <span style={{ color: idx <= currentStepIndex ? colors.text : colors.textMuted }}>{s.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className="step-line" style={{ backgroundColor: idx < currentStepIndex ? colors.success : colors.gray300 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Session Info Card */}
        <div className="session-card" style={{ backgroundColor: colors.surface }}>
          <div className="tutor-row">
            <div className="tutor-avatar" style={{ backgroundColor: colors.primary }}>
              {(tutor?.user_name || tutor?.name || 'T').charAt(0)}
            </div>
            <div className="tutor-info">
              <h3 style={{ color: colors.text }}>{tutor?.user_name || tutor?.name}</h3>
              <p style={{ color: colors.textMuted }}>
                {tutor?.currency_symbol || '$'}{tutor?.base_price || tutor?.display_price}/{t('pages.search.hr') || 'hr'}
              </p>
            </div>
          </div>
          <div className="session-details">
            <div className="detail-row">
              <Calendar size={16} color={colors.textMuted} />
              <span style={{ color: colors.text }}>{formatDateTime(startAt)}</span>
            </div>
            <div className="detail-row">
              <Clock size={16} color={colors.textMuted} />
              <span style={{ color: colors.text }}>{tutor?.duration_minutes || 60} {t('common.minutes') || 'minutes'}</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {step === 'student' && (
          <div className="step-content">
            <h2 style={{ color: colors.text }}>{t('booking.select_student') || 'Select Student'}</h2>
            <p style={{ color: colors.textMuted }}>{t('booking.select_student_desc') || 'Who is this session for?'}</p>

            {students.length === 0 ? (
              <div className="empty-state">
                <User size={48} color={colors.gray300} />
                <p style={{ color: colors.textMuted }}>{t('booking.no_students') || 'No students added yet'}</p>
                <button
                  onClick={() => navigate('/kids')}
                  style={{ backgroundColor: colors.primary, color: '#fff' }}
                  className="add-student-btn"
                >
                  {t('booking.add_student') || 'Add Student'}
                </button>
              </div>
            ) : (
              <div className="students-list">
                {students.map((student) => (
                  <button
                    key={student.student_id}
                    className={`student-card ${selectedStudent?.student_id === student.student_id ? 'selected' : ''}`}
                    style={{ 
                      backgroundColor: colors.surface, 
                      borderColor: selectedStudent?.student_id === student.student_id ? colors.primary : colors.border
                    }}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <div className="student-avatar" style={{ backgroundColor: colors.primaryLight }}>
                      <User size={20} color={colors.primary} />
                    </div>
                    <div className="student-info">
                      <h4 style={{ color: colors.text }}>{student.name}</h4>
                      {student.age && <p style={{ color: colors.textMuted }}>Age {student.age}</p>}
                    </div>
                    {selectedStudent?.student_id === student.student_id && (
                      <Check size={20} color={colors.primary} />
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              className="continue-btn"
              style={{ backgroundColor: colors.primary }}
              onClick={() => setStep('intake')}
              disabled={!selectedStudent}
            >
              {t('buttons.continue') || 'Continue'}
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {step === 'intake' && (
          <div className="step-content">
            <h2 style={{ color: colors.text }}>{t('booking.session_details') || 'Session Details'}</h2>
            <p style={{ color: colors.textMuted }}>{t('booking.session_details_desc') || 'Help your coach prepare for the session'}</p>

            <div className="form-group">
              <label style={{ color: colors.text }}>{t('booking.learning_goals') || 'Learning Goals'}</label>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder={t('booking.goals_placeholder') || "What do you want to achieve?"}
                style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
              />
            </div>

            <div className="form-group">
              <label style={{ color: colors.text }}>{t('booking.current_level') || 'Current Level'}</label>
              <input
                type="text"
                value={currentLevel}
                onChange={(e) => setCurrentLevel(e.target.value)}
                placeholder={t('booking.level_placeholder') || "Beginner, Intermediate, Advanced"}
                style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
              />
            </div>

            <div className="form-group">
              <label style={{ color: colors.text }}>{t('booking.additional_notes') || 'Additional Notes'}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('booking.notes_placeholder') || "Any specific topics or questions?"}
                style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
              />
            </div>

            <div className="button-row">
              <button
                className="back-btn"
                style={{ backgroundColor: colors.surface, color: colors.text }}
                onClick={() => setStep('student')}
              >
                {t('buttons.back') || 'Back'}
              </button>
              <button
                className="continue-btn"
                style={{ backgroundColor: colors.primary }}
                onClick={() => setStep('confirm')}
              >
                {t('buttons.continue') || 'Continue'}
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="step-content">
            <h2 style={{ color: colors.text }}>{t('booking.confirm_booking') || 'Confirm Booking'}</h2>

            <div className="summary-card" style={{ backgroundColor: colors.surface }}>
              <div className="summary-row">
                <span style={{ color: colors.textMuted }}>{t('booking.student') || 'Student'}</span>
                <span style={{ color: colors.text }}>{selectedStudent?.name}</span>
              </div>
              <div className="summary-row">
                <span style={{ color: colors.textMuted }}>{t('booking.date_time') || 'Date & Time'}</span>
                <span style={{ color: colors.text }}>{formatDateTime(startAt)}</span>
              </div>
              <div className="summary-row">
                <span style={{ color: colors.textMuted }}>{t('booking.duration') || 'Duration'}</span>
                <span style={{ color: colors.text }}>{tutor?.duration_minutes || 60} min</span>
              </div>
              <div className="summary-row total">
                <span style={{ color: colors.text }}>{t('booking.total') || 'Total'}</span>
                <span style={{ color: colors.primary }}>{tutor?.currency_symbol || '$'}{tutor?.base_price || tutor?.display_price}</span>
              </div>
            </div>

            {/* Policy Acknowledgment */}
            <div 
              className="policy-checkbox"
              style={{ backgroundColor: colors.surface }}
              onClick={() => setPolicyAcknowledged(!policyAcknowledged)}
            >
              <div 
                className="checkbox"
                style={{ 
                  backgroundColor: policyAcknowledged ? colors.primary : 'transparent',
                  borderColor: policyAcknowledged ? colors.primary : colors.border
                }}
              >
                {policyAcknowledged && <Check size={14} color="#fff" />}
              </div>
              <p style={{ color: colors.text }}>
                {t('booking.policy_acknowledge') || 'I acknowledge the cancellation policy. Cancellations within 24 hours may be charged.'}
              </p>
            </div>

            <div className="button-row">
              <button
                className="back-btn"
                style={{ backgroundColor: colors.surface, color: colors.text }}
                onClick={() => setStep('intake')}
              >
                {t('buttons.back') || 'Back'}
              </button>
              <button
                className="submit-btn"
                style={{ backgroundColor: colors.primary }}
                onClick={handleSubmitBooking}
                disabled={submitting || !policyAcknowledged}
              >
                {submitting ? (
                  <Loader2 size={20} className="spinner" />
                ) : (
                  <>
                    {t('booking.confirm_pay') || 'Confirm & Pay'}
                    <Check size={20} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
