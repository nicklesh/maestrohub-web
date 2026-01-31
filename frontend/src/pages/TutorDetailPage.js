import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Star, MapPin, Clock, Calendar, ChevronRight, Loader2, 
  Heart, Share2, Globe, Video, AlertCircle, Shield, Users
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

export default function TutorDetailPage() {
  const { tutorId } = useParams();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [booking, setBooking] = useState(false);
  const [userMarket, setUserMarket] = useState(null);

  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { t, formatNumber } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTutorDetails();
    fetchUserMarket();
  }, [tutorId]);

  const fetchTutorDetails = async () => {
    try {
      setLoading(true);
      const [tutorRes, slotsRes] = await Promise.all([
        api.get(`/tutors/${tutorId}`),
        api.get(`/tutors/${tutorId}/availability`).catch(() => ({ data: { slots: [] } })),
      ]);
      setTutor(tutorRes.data);
      setSlots(slotsRes.data.slots || slotsRes.data.available_slots || []);
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

  const handleBooking = async () => {
    if (!selectedSlot) {
      showError(t('pages.tutor_detail.select_slot'));
      return;
    }

    try {
      setBooking(true);
      await api.post('/bookings', {
        tutor_id: tutorId,
        slot_id: selectedSlot.slot_id,
        topic: tutor.subjects?.[0] || 'Session',
      });
      showSuccess(t('pages.tutor_detail.booking_success'));
      navigate('/bookings');
    } catch (err) {
      showError(err.response?.data?.detail || t('messages.errors.generic'));
    } finally {
      setBooking(false);
    }
  };

  const getSubjectName = (subjectId) => {
    if (!subjectId) return '';
    const key = `subjects.${subjectId.toLowerCase().replace(/[&\s\-\/]+/g, '_')}`;
    const translated = t(key);
    return translated === key ? subjectId : translated;
  };

  const getModalityName = (modality) => {
    const m = (modality || '').toLowerCase().replace('-', '_');
    switch (m) {
      case 'online': return t('pages.search.online');
      case 'in_person': return t('pages.search.in_person');
      case 'hybrid': return t('pages.search.hybrid');
      default: return modality;
    }
  };

  // Check if tutor is from a different country
  const isCrossMarket = tutor?.market_code && userMarket && tutor.market_code !== userMarket;

  if (loading) {
    return (
      <div className="tutor-detail-page" style={{ backgroundColor: colors.background }}>
        <div className="loading-state">
          <Loader2 className="spinner" size={40} color={colors.primary} />
        </div>
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="tutor-detail-page" style={{ backgroundColor: colors.background }}>
        <div className="error-state">
          <h2 style={{ color: colors.text }}>{t('pages.tutor_detail.not_found')}</h2>
          <button onClick={() => navigate('/search')} className="back-link" style={{ color: colors.primary }}>
            {t('pages.tutor_detail.back_to_search')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tutor-detail-page" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="detail-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} color={colors.text} />
        </button>
        <div className="header-actions">
          <button className="action-btn" style={{ backgroundColor: colors.gray100 }}>
            <Share2 size={20} color={colors.textMuted} />
          </button>
          <button className="action-btn" style={{ backgroundColor: colors.gray100 }}>
            <Heart size={20} color={colors.textMuted} />
          </button>
        </div>
      </header>

      <main className="detail-content">
        {/* Cross-Market Info Box */}
        {isCrossMarket && (
          <div className="cross-market-info" style={{ backgroundColor: colors.primaryLight, borderColor: colors.primary }}>
            <div className="cross-market-header">
              <Globe size={18} color={colors.primary} />
              <FlagIcon countryCode={tutor.market_code} size={16} />
              <span style={{ color: colors.primary, fontWeight: 600 }}>
                {t('pages.tutor_detail.coach_from_country', { country: getCountryName(tutor.market_code) })}
              </span>
            </div>
            <p style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>
              {t('pages.tutor_detail.cross_market_tip')}
            </p>
          </div>
        )}

        {/* Profile Card */}
        <div className="profile-section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          {/* Profile Header */}
          <div className="profile-header">
            <div className="tutor-avatar" style={{ backgroundColor: colors.primary }}>
              {tutor.profile_picture ? (
                <img src={tutor.profile_picture} alt={tutor.name} />
              ) : (
                <span>{(tutor.name || 'T').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="profile-info">
              <div className="name-row">
                <h1 style={{ color: colors.text }}>{tutor.name}</h1>
                {tutor.market_code && (
                  <div className="country-badge" style={{ backgroundColor: colors.gray100 }}>
                    <FlagIcon countryCode={tutor.market_code} size={14} />
                    <span style={{ color: colors.textMuted }}>{tutor.market_code}</span>
                  </div>
                )}
              </div>
              
              {/* Rating */}
              <div className="rating-row">
                <Star size={16} color="#FFB800" fill="#FFB800" />
                <span className="rating" style={{ color: colors.text }}>
                  {formatNumber((tutor.rating_avg || tutor.rating || 0).toFixed(1))}
                </span>
                <span className="reviews" style={{ color: colors.textMuted }}>
                  ({formatNumber(tutor.rating_count || 0)} {t('pages.search.reviews')})
                </span>
              </div>

              {/* Modality Badge */}
              <div className="modality-badge" style={{ backgroundColor: colors.primaryLight }}>
                <Video size={14} color={colors.primary} />
                <span style={{ color: colors.primary }}>
                  {getModalityName(Array.isArray(tutor.modality) ? tutor.modality[0] : tutor.modality) || t('pages.search.online')}
                </span>
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="price-row" style={{ borderTopColor: colors.border }}>
            <span className="price" style={{ color: colors.primary }}>
              {tutor.currency_symbol || '$'}{formatNumber(tutor.display_price || tutor.base_price || tutor.session_rate || 0)}{t('pages.search.per_hour')}
            </span>
            {tutor.original_price_display && (
              <span className="original-price" style={{ color: colors.textMuted }}>
                ({tutor.original_price_display})
              </span>
            )}
          </div>

          {/* About Section */}
          {tutor.bio && (
            <div className="section">
              <h3 style={{ color: colors.text }}>{t('pages.tutor_detail.about')}</h3>
              <p style={{ color: colors.textMuted }}>{tutor.bio}</p>
            </div>
          )}

          {/* Subjects Section */}
          {(tutor.subjects?.length > 0 || tutor.topics?.length > 0) && (
            <div className="section">
              <h3 style={{ color: colors.text }}>{t('pages.tutor_detail.subjects')}</h3>
              <div className="subjects-list">
                {(tutor.subjects || tutor.topics || []).map((subject, idx) => (
                  <span 
                    key={idx} 
                    className="subject-tag" 
                    style={{ backgroundColor: colors.primaryLight, color: colors.primary }}
                  >
                    {getSubjectName(subject)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Policies Section */}
          <div className="section policies-section">
            <h3 style={{ color: colors.text }}>{t('pages.tutor_detail.policies')}</h3>
            <div className="policy-item">
              <Clock size={16} color={colors.textMuted} />
              <span style={{ color: colors.textMuted }}>
                {t('pages.tutor_detail.cancellation_policy')}
              </span>
            </div>
            <div className="policy-item">
              <AlertCircle size={16} color={colors.textMuted} />
              <span style={{ color: colors.textMuted }}>
                {t('pages.tutor_detail.noshow_policy')}
              </span>
            </div>
          </div>
        </div>

        {/* Available Slots Section */}
        <div className="slots-section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <h3 style={{ color: colors.text }}>
            <Calendar size={18} /> {t('pages.tutor_detail.available_slots')}
          </h3>
          
          {slots.length === 0 ? (
            <div className="no-slots" style={{ color: colors.textMuted }}>
              <Calendar size={32} color={colors.gray300} />
              <p>{t('pages.tutor_detail.no_slots')}</p>
            </div>
          ) : (
            <div className="slots-list">
              {slots.slice(0, 8).map((slot, index) => (
                <button
                  key={slot.slot_id || slot.id || `slot-${index}`}
                  className={`slot-btn ${selectedSlot?.slot_id === slot.slot_id ? 'selected' : ''}`}
                  style={{
                    backgroundColor: selectedSlot?.slot_id === slot.slot_id ? colors.primary : colors.primaryLight,
                    borderColor: selectedSlot?.slot_id === slot.slot_id ? colors.primary : 'transparent',
                    color: selectedSlot?.slot_id === slot.slot_id ? '#fff' : colors.primary,
                  }}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot.display_time || slot.time || `${slot.start_time} - ${slot.end_time}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Book Button */}
        <button 
          className="book-btn"
          style={{ backgroundColor: colors.primary }}
          onClick={handleBooking}
          disabled={booking || !selectedSlot}
        >
          {booking ? (
            <Loader2 size={20} className="spinner" />
          ) : (
            <>
              <Calendar size={20} />
              <span>{t('pages.tutor_detail.book_session')}</span>
            </>
          )}
        </button>
      </main>

      <BottomNav />
    </div>
  );
}
