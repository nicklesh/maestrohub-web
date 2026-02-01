import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Star, MapPin, Clock, Calendar, ChevronLeft, ChevronRight, Loader2, 
  Heart, Share2, Globe, Video, AlertCircle, Shield, Users, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import api from '../services/api';
import './TutorDetailPage.css';

// Flag component
const FlagIcon = ({ countryCode, size = 16 }) => {
  const flagEmoji = {
    'US': '🇺🇸', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'IN': '🇮🇳',
    'DE': '🇩🇪', 'FR': '🇫🇷', 'ES': '🇪🇸', 'IT': '🇮🇹', 'BR': '🇧🇷',
    'MX': '🇲🇽', 'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳', 'NL': '🇳🇱',
  };
  return <span style={{ fontSize: size }}>{flagEmoji[countryCode] || '🌍'}</span>;
};

// Country name mapping
const getCountryName = (code) => {
  const countries = {
    'US': 'United States', 'GB': 'United Kingdom', 'CA': 'Canada', 
    'AU': 'Australia', 'IN': 'India', 'DE': 'Germany', 'FR': 'France',
  };
  return countries[code] || code;
};

// Format price with currency
const formatPrice = (price, currency, symbol) => {
  return `${symbol || '$'}${price}`;
};

export default function TutorDetailPage() {
  const { tutorId } = useParams();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [booking, setBooking] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [userMarket, setUserMarket] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const { user } = useAuth();
  const { colors } = useTheme();
  const { t, formatNumber } = useTranslation();
  const { showSuccess, showError, showInfo } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTutorDetails();
    fetchUserMarket();
  }, [tutorId]);

  useEffect(() => {
    if (selectedDate && tutorId) {
      fetchSlotsForDate(selectedDate);
    }
  }, [selectedDate, tutorId]);

  const fetchTutorDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tutors/${tutorId}`);
      setTutor(response.data);
    } catch (err) {
      console.error('Error fetching tutor:', err);
      showError(t('messages.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const fetchUserMarket = async () => {
    try {
      const response = await api.get('/user/market');
      setUserMarket(response.data.market_code || 'US');
    } catch (err) {
      setUserMarket('US');
    }
  };

  const fetchSlotsForDate = async (date) => {
    try {
      setLoadingSlots(true);
      const dateStr = date.toISOString().split('T')[0];
      const response = await api.get(`/tutors/${tutorId}/availability`, {
        params: { date: dateStr }
      }).catch(() => ({ data: { slots: [] } }));
      setSlots(response.data.slots || response.data.available_slots || []);
      setSelectedSlot(null);
    } catch (err) {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const getModalityName = (modality) => {
    switch (modality) {
      case 'online': return t('pages.search.online');
      case 'in_person': return t('pages.search.in_person');
      case 'hybrid': return t('pages.search.hybrid');
      default: return modality;
    }
  };

  // Calendar functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    // Previous month days
    for (let i = 0; i < startingDay; i++) {
      const prevDate = new Date(year, month, -startingDay + i + 1);
      days.push({ date: prevDate, isCurrentMonth: false });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const isPastDate = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateSelect = (date) => {
    if (!isPastDate(date)) {
      setSelectedDate(date);
    }
  };

  const handleMonthChange = (delta) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + delta);
    setCurrentMonth(newMonth);
  };

  const handleBooking = async () => {
    if (!selectedSlot) {
      showError(t('pages.tutor_detail.select_slot') || 'Please select a time slot');
      return;
    }

    try {
      setBooking(true);

      // Determine the slot start time
      let startAt = selectedSlot.start_at;
      if (!startAt && selectedSlot.time) {
        // If slot only has 'time' like "10:00 AM", construct full datetime
        const [hours, minutesPart] = selectedSlot.time.split(':');
        const isPM = selectedSlot.time.includes('PM');
        let hour = parseInt(hours);
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        
        startAt = new Date(selectedDate);
        startAt.setHours(hour, parseInt(minutesPart) || 0, 0, 0);
        startAt = startAt.toISOString();
      }

      // Create a hold first
      const holdResponse = await api.post('/booking-holds', {
        tutor_id: tutorId,
        start_at: startAt,
        duration_minutes: tutor?.duration_minutes || 60
      });

      const holdId = holdResponse.data.hold_id;

      // Navigate to booking page with the hold info
      const startAtEncoded = encodeURIComponent(startAt);
      const endAt = holdResponse.data.end_at || new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();
      const endAtEncoded = encodeURIComponent(endAt);
      
      navigate(`/book/${tutorId}?startAt=${startAtEncoded}&endAt=${endAtEncoded}&holdId=${holdId}`);

    } catch (err) {
      let errorMessage = t('messages.errors.generic');
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail.map(e => e.msg || e.message || String(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      }
      showError(errorMessage);
    } finally {
      setBooking(false);
    }
  };

  // Render price with cross-market display
  const renderPrice = () => {
    if (!tutor) return null;
    
    const isCrossMarket = tutor.is_cross_market && tutor.original_price_display;
    
    return (
      <div className="price-display">
        <span className="main-price" style={{ color: colors.primary }}>
          {tutor.currency_symbol || '$'}{formatNumber(tutor.display_price || tutor.base_price)}/{t('pages.search.hr') || 'hr'}
        </span>
        {isCrossMarket && tutor.original_price_display && (
          <span className="original-price" style={{ color: colors.textMuted }}>
            ({tutor.original_price_display})
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="tutor-detail-page" style={{ backgroundColor: colors.background }}>
        <AppHeader showBack={true} />
        <div className="loading-state">
          <Loader2 size={32} color={colors.primary} className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="tutor-detail-page" style={{ backgroundColor: colors.background }}>
        <AppHeader showBack={true} />
        <div className="error-state">
          <AlertCircle size={48} color={colors.error} />
          <h2 style={{ color: colors.text }}>{t('pages.tutor_detail.not_found') || 'Coach not found'}</h2>
          <button onClick={() => navigate('/search')} style={{ backgroundColor: colors.primary, color: '#fff' }}>
            {t('buttons.back_to_search') || 'Back to Search'}
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="tutor-detail-page" style={{ backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={tutor.user_name || tutor.name} showUserName={false} />

      <main className="tutor-main" style={{ paddingTop: '60px' }}>
        {/* Tutor Header Card */}
        <div className="tutor-header-card" style={{ backgroundColor: colors.surface }}>
          <div className="avatar-section">
            <div className="tutor-avatar" style={{ backgroundColor: colors.primary }}>
              <span>{(tutor.user_name || tutor.name || 'T').charAt(0).toUpperCase()}</span>
            </div>
            <div className="rating-badge">
              <Star size={12} color="#FFB800" fill="#FFB800" />
              <span>{(tutor.rating_avg || 0).toFixed(1)}</span>
            </div>
          </div>
          
          <div className="tutor-info">
            <div className="name-row">
              <h1 style={{ color: colors.text }}>{tutor.user_name || tutor.name}</h1>
              {tutor.market_code && <FlagIcon countryCode={tutor.market_code} size={20} />}
            </div>
            
            <p className="coach-from" style={{ color: colors.textMuted }}>
              {t('pages.tutor_detail.coach_from', { country: getCountryName(tutor.market_code) }) || 
               `Coach from ${getCountryName(tutor.market_code)}`}
            </p>

            {renderPrice()}

            {/* Modality Badges */}
            <div className="modality-badges">
              {(Array.isArray(tutor.modality) ? tutor.modality : [tutor.modality].filter(Boolean)).map((m, idx) => (
                <span 
                  key={`${m}-${idx}`} 
                  className="modality-badge" 
                  style={{ backgroundColor: colors.primaryLight, color: colors.primary }}
                >
                  <Video size={12} />
                  {getModalityName(m)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* About Section */}
        <div className="section" style={{ backgroundColor: colors.surface }}>
          <h2 style={{ color: colors.text }}>{t('pages.tutor_detail.about') || 'About'}</h2>
          <p className="bio" style={{ color: colors.textMuted }}>{tutor.bio || t('pages.tutor_detail.no_bio')}</p>
        </div>

        {/* Subjects */}
        {tutor.subjects?.length > 0 && (
          <div className="section" style={{ backgroundColor: colors.surface }}>
            <h2 style={{ color: colors.text }}>{t('pages.tutor_detail.subjects') || 'Subjects'}</h2>
            <div className="subjects-grid">
              {tutor.subjects.map((subject, idx) => (
                <span 
                  key={idx} 
                  className="subject-tag" 
                  style={{ backgroundColor: colors.primaryLight, color: colors.primary }}
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Calendar Section */}
        <div className="section calendar-section" style={{ backgroundColor: colors.surface }}>
          <h2 style={{ color: colors.text }}>
            <Calendar size={20} />
            {t('pages.tutor_detail.select_date') || 'Select Date'}
          </h2>
          
          <div className="calendar-container">
            <div className="calendar-header">
              <button onClick={() => handleMonthChange(-1)} style={{ color: colors.text }}>
                <ChevronLeft size={24} />
              </button>
              <span style={{ color: colors.text }}>
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button onClick={() => handleMonthChange(1)} style={{ color: colors.text }}>
                <ChevronRight size={24} />
              </button>
            </div>
            
            <div className="calendar-days-header">
              {dayNames.map(day => (
                <span key={day} style={{ color: colors.textMuted }}>{day}</span>
              ))}
            </div>
            
            <div className="calendar-grid">
              {getDaysInMonth(currentMonth).map((dayObj, idx) => {
                const { date, isCurrentMonth } = dayObj;
                const past = isPastDate(date);
                const today = isToday(date);
                const selected = isSelected(date);
                
                return (
                  <button
                    key={idx}
                    className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${past ? 'past' : ''} ${today ? 'today' : ''} ${selected ? 'selected' : ''}`}
                    onClick={() => handleDateSelect(date)}
                    disabled={past || !isCurrentMonth}
                    style={{
                      backgroundColor: selected ? colors.primary : 'transparent',
                      color: selected ? '#fff' : past ? colors.gray300 : !isCurrentMonth ? colors.gray300 : colors.text,
                      borderColor: today && !selected ? colors.primary : 'transparent'
                    }}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Available Slots */}
        <div className="section slots-section" style={{ backgroundColor: colors.surface }}>
          <h2 style={{ color: colors.text }}>
            <Clock size={20} />
            {t('pages.tutor_detail.available_slots') || 'Available Slots'}
            {selectedDate && (
              <span className="date-label" style={{ color: colors.textMuted }}>
                - {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </h2>

          {loadingSlots ? (
            <div className="slots-loading">
              <Loader2 size={24} color={colors.primary} className="spinner" />
            </div>
          ) : slots.length === 0 ? (
            <div className="no-slots">
              <Clock size={32} color={colors.gray300} />
              <p style={{ color: colors.textMuted }}>{t('pages.tutor_detail.no_slots') || 'No slots available for this date'}</p>
            </div>
          ) : (
            <div className="slots-grid">
              {slots.map((slot, index) => {
                const isSelectedSlot = selectedSlot?.start_at === slot.start_at || 
                                       selectedSlot?.time === slot.time ||
                                       selectedSlot?.slot_id === slot.slot_id;
                return (
                  <button
                    key={slot.slot_id || slot.start_at || index}
                    className={`slot-btn ${isSelectedSlot ? 'selected' : ''}`}
                    style={{
                      backgroundColor: isSelectedSlot ? colors.primary : colors.primaryLight,
                      borderColor: isSelectedSlot ? colors.primary : 'transparent',
                      color: isSelectedSlot ? '#fff' : colors.primary,
                    }}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.display_time || slot.time || 
                      (slot.start_at && new Date(slot.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))}
                    {isSelectedSlot && <Check size={16} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Policies */}
        {tutor.policies && (
          <div className="section policies-section" style={{ backgroundColor: colors.surface }}>
            <h2 style={{ color: colors.text }}>
              <Shield size={20} />
              {t('pages.tutor_detail.policies') || 'Policies'}
            </h2>
            <div className="policy-item">
              <span className="policy-label" style={{ color: colors.textMuted }}>
                {t('pages.tutor_detail.cancellation') || 'Cancellation'}:
              </span>
              <span style={{ color: colors.text }}>
                {tutor.policies.cancel_window_hours 
                  ? `${tutor.policies.cancel_window_hours}h before session`
                  : 'Flexible'}
              </span>
            </div>
            {tutor.policies.no_show_policy && (
              <div className="policy-item">
                <span className="policy-label" style={{ color: colors.textMuted }}>
                  {t('pages.tutor_detail.no_show') || 'No-show'}:
                </span>
                <span style={{ color: colors.text }}>{tutor.policies.no_show_policy}</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Book Button */}
      <div className="book-footer" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="book-price">
          {renderPrice()}
        </div>
        <button 
          className="book-btn"
          style={{ backgroundColor: colors.primary }}
          onClick={handleBooking}
          disabled={booking || !selectedSlot}
          data-testid="book-session-btn"
        >
          {booking ? (
            <Loader2 size={20} className="spinner" />
          ) : (
            t('pages.tutor_detail.book_session') || 'Book Session'
          )}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
