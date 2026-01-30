import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Clock, Users, Calendar, ChevronRight, Loader, Heart, Share2, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './TutorDetailPage.css';

const TutorDetailPage = () => {
  const { tutorId } = useParams();
  const [tutor, setTutor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(false);

  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTutorDetails();
  }, [tutorId]);

  const fetchTutorDetails = async () => {
    try {
      setLoading(true);
      const [tutorRes, slotsRes] = await Promise.all([
        api.get(`/tutors/${tutorId}`),
        api.get(`/tutors/${tutorId}/availability`),
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
        topic: tutor.topics?.[0] || 'Session',
      });
      showSuccess(t('pages.tutor_detail.booking_success'));
      navigate('/bookings');
    } catch (err) {
      showError(err.response?.data?.detail || t('messages.errors.generic'));
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="tutor-detail-page" style={{ backgroundColor: colors.background }}>
        <div className="loading-state">
          <Loader className="spinner" size={40} color={colors.primary} />
        </div>
      </div>
    );
  }

  if (!tutor) {
    return (
      <div className="tutor-detail-page" style={{ backgroundColor: colors.background }}>
        <div className="error-state">
          <h2 style={{ color: colors.text }}>{t('pages.tutor_detail.not_found')}</h2>
          <button onClick={() => navigate('/search')} style={{ color: colors.primary }}>
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
        <button 
          className="back-btn" 
          onClick={() => navigate(-1)}
          style={{ color: colors.text }}
        >
          <ArrowLeft size={24} />
        </button>
        <div className="header-actions">
          <button style={{ color: colors.textMuted }}>
            <Share2 size={20} />
          </button>
          <button style={{ color: colors.textMuted }}>
            <Heart size={20} />
          </button>
        </div>
      </header>

      <main className="detail-content">
        {/* Profile Card */}
        <div className="profile-section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <div className="profile-header">
            <div className="tutor-avatar" style={{ backgroundColor: colors.primary }}>
              {tutor.profile_picture ? (
                <img src={tutor.profile_picture} alt={tutor.name} />
              ) : (
                <span style={{ color: colors.textInverse }}>
                  {tutor.name?.charAt(0)?.toUpperCase()}
                </span>
              )}
            </div>
            <div className="profile-info">
              <h1 style={{ color: colors.text }}>{tutor.name}</h1>
              {tutor.location && (
                <p className="location" style={{ color: colors.textMuted }}>
                  <MapPin size={14} /> {tutor.location}
                </p>
              )}
              <div className="profile-stats">
                {tutor.rating && (
                  <span className="stat" style={{ backgroundColor: colors.warning + '20' }}>
                    <Star size={14} fill={colors.warning} color={colors.warning} />
                    <span style={{ color: colors.warning }}>{tutor.rating.toFixed(1)}</span>
                  </span>
                )}
                {tutor.session_count > 0 && (
                  <span className="stat" style={{ backgroundColor: colors.gray100, color: colors.textMuted }}>
                    <Users size={14} /> {tutor.session_count} sessions
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Topics */}
          {tutor.topics?.length > 0 && (
            <div className="topics-section">
              <h3 style={{ color: colors.text }}>{t('pages.tutor_detail.specialties')}</h3>
              <div className="topics-list">
                {tutor.topics.map((topic, idx) => (
                  <span 
                    key={idx} 
                    className="topic-tag" 
                    style={{ backgroundColor: colors.primaryLight, color: colors.primary }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {tutor.bio && (
            <div className="bio-section">
              <h3 style={{ color: colors.text }}>{t('pages.tutor_detail.about')}</h3>
              <p style={{ color: colors.textMuted }}>{tutor.bio}</p>
            </div>
          )}

          {/* Rate */}
          {tutor.session_rate && (
            <div className="rate-section">
              <h3 style={{ color: colors.text }}>{t('pages.tutor_detail.session_rate')}</h3>
              <p className="rate" style={{ color: colors.success }}>
                ${tutor.session_rate}/hr
              </p>
            </div>
          )}
        </div>

        {/* Available Slots */}
        <div className="slots-section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <h3 style={{ color: colors.text }}>
            <Calendar size={18} /> {t('pages.tutor_detail.available_slots')}
          </h3>
          
          {slots.length === 0 ? (
            <p className="no-slots" style={{ color: colors.textMuted }}>
              {t('pages.tutor_detail.no_slots')}
            </p>
          ) : (
            <div className="slots-list">
              {slots.slice(0, 6).map((slot) => (
                <button
                  key={slot.slot_id}
                  className={`slot-btn ${selectedSlot?.slot_id === slot.slot_id ? 'selected' : ''}`}
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    backgroundColor: selectedSlot?.slot_id === slot.slot_id ? colors.primary : colors.gray100,
                    color: selectedSlot?.slot_id === slot.slot_id ? colors.textInverse : colors.text,
                    borderColor: selectedSlot?.slot_id === slot.slot_id ? colors.primary : colors.border,
                  }}
                  data-testid={`slot-${slot.slot_id}`}
                >
                  <span className="slot-date">{slot.date}</span>
                  <span className="slot-time">{slot.start_time} - {slot.end_time}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Book Button */}
        {slots.length > 0 && (
          <div className="book-section">
            <button
              className="book-btn"
              onClick={handleBooking}
              disabled={!selectedSlot || booking}
              style={{ 
                backgroundColor: colors.primary,
                opacity: !selectedSlot || booking ? 0.6 : 1,
              }}
              data-testid="book-session-btn"
            >
              {booking ? (
                <Loader className="spinner" size={20} color="#fff" />
              ) : (
                <>
                  <Calendar size={20} />
                  {t('pages.tutor_detail.book_session')}
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default TutorDetailPage;
