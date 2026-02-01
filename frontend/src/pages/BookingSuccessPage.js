import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, Clock, User, Loader2, Home, CalendarCheck } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';

export default function BookingSuccessPage() {
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('unknown');

  const sessionId = searchParams.get('session_id');
  const holdId = searchParams.get('hold_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        // Check payment status
        const statusRes = await api.get(`/checkout/status/${sessionId}`);
        setPaymentStatus(statusRes.data.payment_status || 'unknown');
        
        if (statusRes.data.payment_status === 'paid') {
          // Get booking details
          if (holdId) {
            try {
              const bookingRes = await api.get(`/bookings/by-hold/${holdId}`);
              setBooking(bookingRes.data);
            } catch (e) {
              // Booking might not be created yet, show success anyway
              console.log('Booking not found yet:', e);
            }
          }
          showSuccess(t('pages.booking_success.payment_confirmed') || 'Payment confirmed!');
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        setPaymentStatus('error');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId, holdId, showSuccess, t]);

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={48} color={colors.primary} className="spinner" />
          <p style={{ color: colors.textMuted, marginTop: '16px' }}>
            {t('pages.booking_success.verifying') || 'Verifying your payment...'}
          </p>
        </div>
        <style>{`
          .spinner { animation: spin 1s linear infinite; }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      padding: '40px 20px'
    }}>
      <div style={{
        maxWidth: '480px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        {/* Success Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '40px',
          backgroundColor: colors.successLight || '#D1FAE5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <CheckCircle size={48} color={colors.success || '#10B981'} />
        </div>

        {/* Title */}
        <h1 style={{
          color: colors.text,
          fontSize: '28px',
          fontWeight: 700,
          marginBottom: '8px'
        }}>
          {t('pages.booking_success.title') || 'Booking Confirmed!'}
        </h1>
        
        <p style={{
          color: colors.textMuted,
          fontSize: '16px',
          marginBottom: '32px'
        }}>
          {t('pages.booking_success.subtitle') || 'Your session has been booked successfully.'}
        </p>

        {/* Booking Details Card */}
        {booking && (
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            padding: '24px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <h3 style={{
              color: colors.text,
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '16px'
            }}>
              {t('pages.booking_success.booking_details') || 'Booking Details'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <User size={20} color={colors.primary} />
                <div>
                  <p style={{ color: colors.textMuted, fontSize: '12px', margin: 0 }}>
                    {t('pages.booking_success.coach') || 'Coach'}
                  </p>
                  <p style={{ color: colors.text, fontSize: '15px', fontWeight: 500, margin: 0 }}>
                    {booking.tutor_name}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Calendar size={20} color={colors.primary} />
                <div>
                  <p style={{ color: colors.textMuted, fontSize: '12px', margin: 0 }}>
                    {t('pages.booking_success.date') || 'Date'}
                  </p>
                  <p style={{ color: colors.text, fontSize: '15px', fontWeight: 500, margin: 0 }}>
                    {formatDate(booking.start_at)}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={20} color={colors.primary} />
                <div>
                  <p style={{ color: colors.textMuted, fontSize: '12px', margin: 0 }}>
                    {t('pages.booking_success.time') || 'Time'}
                  </p>
                  <p style={{ color: colors.text, fontSize: '15px', fontWeight: 500, margin: 0 }}>
                    {formatTime(booking.start_at)} - {formatTime(booking.end_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div style={{
          backgroundColor: colors.primaryLight || '#EBF5FF',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          textAlign: 'left'
        }}>
          <p style={{ color: colors.primary, fontSize: '14px', lineHeight: 1.5, margin: 0 }}>
            {t('pages.booking_success.confirmation_email') || 
              'A confirmation email has been sent to your registered email address with all the session details.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => navigate('/bookings')}
            style={{
              width: '100%',
              backgroundColor: colors.primary,
              color: '#fff',
              padding: '16px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            data-testid="view-bookings-btn"
          >
            <CalendarCheck size={20} />
            {t('pages.booking_success.view_bookings') || 'View My Bookings'}
          </button>

          <button
            onClick={() => navigate('/home')}
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              color: colors.primary,
              padding: '16px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              border: `1px solid ${colors.primary}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Home size={20} />
            {t('pages.booking_success.back_home') || 'Back to Home'}
          </button>
        </div>
      </div>
    </div>
  );
}
