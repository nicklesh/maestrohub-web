import React, { useState, useEffect } from 'react';
import { Star, ThumbsUp, Loader, User, Calendar } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';
import { format, parseISO } from 'date-fns';
import './ReviewsPage.css';

const TABS = [
  { id: 'pending', labelKey: 'pages.reviews.pending' },
  { id: 'submitted', labelKey: 'pages.reviews.submitted' },
];

const ReviewsPage = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    fetchReviews();
  }, [activeTab]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/reviews?status=${activeTab}`);
      setReviews(response.data.reviews || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            fill={star <= rating ? colors.warning : 'transparent'}
            color={star <= rating ? colors.warning : colors.gray300}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateStr) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="reviews-page" style={{ backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('pages.reviews.title') || 'Reviews'} showUserName={true} />

      {/* Tabs */}
      <div className="tabs-container" style={{ backgroundColor: colors.surface, borderColor: colors.border, marginTop: '60px' }}>
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
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <main className="reviews-main">
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} color={colors.primary} />
          </div>
        ) : reviews.length === 0 ? (
          <div className="empty-state">
            <Star size={64} color={colors.gray300} />
            <h3 style={{ color: colors.text }}>
              {activeTab === 'pending' 
                ? t('pages.reviews.no_pending_reviews')
                : t('pages.reviews.no_reviews_yet')
              }
            </h3>
            <p style={{ color: colors.textMuted }}>
              {activeTab === 'pending'
                ? t('pages.reviews.no_pending_reviews_desc')
                : t('pages.reviews.no_reviews_desc')
              }
            </p>
          </div>
        ) : (
          <div className="reviews-container">
            <div className="reviews-list">
              {reviews.map((review) => (
                <div 
                  key={review.id} 
                  className="review-card"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                >
                  <div className="review-header">
                    <div className="tutor-info">
                      <div className="tutor-avatar" style={{ backgroundColor: colors.primaryLight }}>
                        <User size={20} color={colors.primary} />
                      </div>
                      <div>
                        <h4 style={{ color: colors.text }}>{review.tutor_name || 'Coach'}</h4>
                        <span style={{ color: colors.textMuted }}>{review.topic}</span>
                      </div>
                    </div>
                    {review.rating && renderStars(review.rating)}
                  </div>

                  {activeTab === 'pending' ? (
                    <button
                      className="write-review-btn"
                      onClick={() => navigate(`/review/${review.booking_id}`)}
                      style={{ backgroundColor: colors.primary }}
                    >
                      {t('pages.reviews.write_review')}
                    </button>
                  ) : (
                    <>
                      {review.comment && (
                        <p className="review-comment" style={{ color: colors.textMuted }}>
                          "{review.comment}"
                        </p>
                      )}
                      <div className="review-footer">
                        <span style={{ color: colors.textMuted }}>
                          <Calendar size={14} /> {formatDate(review.created_at)}
                        </span>
                        {review.would_recommend && (
                          <span style={{ color: colors.success }}>
                            <ThumbsUp size={14} /> {t('pages.reviews.would_recommend_yes')}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ReviewsPage;
