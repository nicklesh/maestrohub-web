import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, MapPin, User, Loader, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import api from '../services/api';
import { format, parseISO } from 'date-fns';
import './BookingsPage.css';

const TABS = [
  { id: 'upcoming', labelKey: 'pages.bookings.tab_upcoming' },
  { id: 'rescheduled', labelKey: 'pages.bookings.tab_rescheduled' },
  { id: 'completed', labelKey: 'pages.bookings.tab_completed' },
  { id: 'cancelled', labelKey: 'pages.bookings.tab_cancelled' },
];

const BookingsPage = () => {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bookings?status=${activeTab}`);
      setBookings(response.data.bookings || []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId) => {
    try {
      setCancellingId(bookingId);
      await api.put(`/bookings/${bookingId}/cancel`);
      showSuccess(t('pages.bookings.cancel_success'));
      fetchBookings();
    } catch (err) {
      showError(t('messages.errors.generic'));
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle size={16} color={colors.success} />;
      case 'cancelled':
        return <XCircle size={16} color={colors.error} />;
      case 'pending':
        return <AlertCircle size={16} color={colors.warning} />;
      default:
        return <Clock size={16} color={colors.textMuted} />;
    }
  };

  const formatDateTime = (dateStr) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'MMM d, yyyy • h:mm a');
    } catch {
      return dateStr;
    }
  };

  const renderBookingCard = (booking) => (
    <div 
      key={booking.booking_id} 
      className="booking-card"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      data-testid={`booking-card-${booking.booking_id}`}
    >
      <div className="booking-header">
        <div className="booking-tutor">
          <div className="tutor-avatar" style={{ backgroundColor: colors.primary }}>
            <span style={{ color: colors.textInverse }}>
              {booking.tutor_name?.charAt(0)?.toUpperCase() || 'T'}
            </span>
          </div>
          <div className="tutor-info">
            <h4 style={{ color: colors.text }}>{booking.tutor_name || 'Coach'}</h4>
            <span style={{ color: colors.textMuted }}>{booking.topic || 'Session'}</span>
          </div>
        </div>
        <div 
          className="booking-status"
          style={{ 
            backgroundColor: booking.status === 'confirmed' ? colors.successLight : 
                           booking.status === 'cancelled' ? colors.errorLight : colors.warningLight 
          }}
        >
          {getStatusIcon(booking.status)}
          <span style={{ 
            color: booking.status === 'confirmed' ? colors.success : 
                   booking.status === 'cancelled' ? colors.error : colors.warning,
            textTransform: 'capitalize'
          }}>
            {booking.status}
          </span>
        </div>
      </div>

      <div className="booking-details">
        <div className="detail-item">
          <Calendar size={16} color={colors.textMuted} />
          <span style={{ color: colors.text }}>{formatDateTime(booking.start_time)}</span>
        </div>
        <div className="detail-item">
          <Clock size={16} color={colors.textMuted} />
          <span style={{ color: colors.text }}>{booking.duration || 60} min</span>
        </div>
        {booking.location && (
          <div className="detail-item">
            <MapPin size={16} color={colors.textMuted} />
            <span style={{ color: colors.text }}>{booking.location}</span>
          </div>
        )}
      </div>

      {activeTab === 'upcoming' && booking.status !== 'cancelled' && (
        <div className="booking-actions">
          <button 
            className="cancel-btn"
            onClick={() => cancelBooking(booking.booking_id)}
            disabled={cancellingId === booking.booking_id}
            style={{ color: colors.error, borderColor: colors.error }}
            data-testid={`cancel-booking-${booking.booking_id}`}
          >
            {cancellingId === booking.booking_id ? (
              <Loader className="spinner" size={16} />
            ) : (
              t('buttons.cancel')
            )}
          </button>
        </div>
      )}
    </div>
  );

  const getHomeRoute = () => {
    if (user?.role === 'admin') return '/admin';
    if (user?.role === 'tutor') return '/tutor/dashboard';
    return '/home';
  };

  return (
    <div className="bookings-page" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="bookings-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button 
            className="back-btn" 
            onClick={() => navigate(getHomeRoute())}
            style={{ color: colors.text }}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.bookings.title')}</h1>
          <button 
            className="refresh-btn" 
            onClick={fetchBookings}
            style={{ color: colors.primary }}
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="tabs-container" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                color: activeTab === tab.id ? colors.primary : colors.textMuted,
                borderColor: activeTab === tab.id ? colors.primary : 'transparent',
              }}
              data-testid={`tab-${tab.id}`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="bookings-content">
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} color={colors.primary} />
            <p style={{ color: colors.textMuted }}>{t('pages.bookings.loading')}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="empty-state">
            <Calendar size={64} color={colors.gray300} />
            <h3 style={{ color: colors.text }}>{t('pages.bookings.no_bookings_title')}</h3>
            <p style={{ color: colors.textMuted }}>{t('pages.bookings.no_bookings_message')}</p>
          </div>
        ) : (
          <div className="bookings-list">
            {bookings.map(renderBookingCard)}
          </div>
        )}
      </main>
    </div>
  );
};

export default BookingsPage;
