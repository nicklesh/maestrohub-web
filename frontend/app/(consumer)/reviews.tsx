import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface PendingReview {
  tutor_id: string;
  tutor_name: string;
  subjects: string[];
}

interface Review {
  review_id: string;
  tutor_id: string;
  tutor_name: string;
  teaching_quality: number;
  communication: number;
  punctuality: number;
  knowledge: number;
  value_for_money: number;
  overall_rating: number;
  comment?: string;
  would_recommend: boolean;
  created_at: string;
}

const RATING_CATEGORIES = [
  { key: 'teaching_quality', labelKey: 'pages.reviews.teaching_quality', icon: 'school' },
  { key: 'communication', labelKey: 'pages.reviews.communication', icon: 'chatbubbles' },
  { key: 'punctuality', labelKey: 'pages.reviews.punctuality', icon: 'time' },
  { key: 'knowledge', labelKey: 'pages.reviews.knowledge', icon: 'book' },
  { key: 'value_for_money', labelKey: 'pages.reviews.value_for_money', icon: 'cash' },
];

export default function ReviewsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t, locale } = useTranslation();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'submitted'>('pending');
  
  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedTutor, setSelectedTutor] = useState<PendingReview | null>(null);
  const [ratings, setRatings] = useState({
    teaching_quality: 5,
    communication: 5,
    punctuality: 5,
    knowledge: 5,
    value_for_money: 5,
  });
  const [comment, setComment] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pendingRes, reviewsRes] = await Promise.all([
        api.get('/reviews/pending', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/reviews/my-reviews', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setPendingReviews(pendingRes.data.pending_reviews || []);
      setMyReviews(reviewsRes.data.reviews || []);
    } catch (error) {
      console.error('Failed to load reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartReview = (tutor: PendingReview) => {
    setSelectedTutor(tutor);
    setRatings({
      teaching_quality: 5,
      communication: 5,
      punctuality: 5,
      knowledge: 5,
      value_for_money: 5,
    });
    setComment('');
    setWouldRecommend(true);
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedTutor) return;
    
    setSubmitting(true);
    try {
      await api.post('/reviews', {
        tutor_id: selectedTutor.tutor_id,
        ...ratings,
        comment: comment.trim() || undefined,
        would_recommend: wouldRecommend,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showInfo('Your review has been submitted successfully.', 'Thank You!');
      setShowReviewModal(false);
      loadData();
    } catch (error: any) {
      showInfo(error.response?.data?.detail || 'Failed to submit review', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number, onPress?: (value: number) => void) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => (
          <TouchableOpacity
            key={value}
            onPress={() => onPress?.(value)}
            disabled={!onPress}
            style={styles.starButton}
          >
            <Ionicons
              name={value <= rating ? 'star' : 'star-outline'}
              size={onPress ? 28 : 16}
              color={value <= rating ? '#FFB800' : colors.gray300}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    const localeCode = locale === 'hi_IN' ? 'hi-IN' : locale?.replace('_', '-') || 'en-US';
    return new Date(dateString).toLocaleDateString(localeCode, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title={t("pages.reviews.title")} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title={t("pages.reviews.title")} />

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'pending' ? colors.primary : colors.textMuted }]}>
            {t('pages.reviews.pending')} ({pendingReviews.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'submitted' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('submitted')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'submitted' ? colors.primary : colors.textMuted }]}>
            {t('pages.reviews.submitted')} ({myReviews.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {activeTab === 'pending' ? (
          pendingReviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('pages.reviews.no_pending_reviews')}</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('pages.reviews.no_pending_reviews_desc')}
              </Text>
            </View>
          ) : (
            pendingReviews.map((tutor) => (
              <View key={tutor.tutor_id} style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {tutor.tutor_name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.tutorName, { color: colors.text }]}>{tutor.tutor_name}</Text>
                    <Text style={[styles.subjects, { color: colors.textMuted }]}>
                      {tutor.subjects.slice(0, 2).map(s => t(`subjects.${s.toLowerCase().replace(/\s+/g, '_')}`, s)).join(', ')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.reviewButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleStartReview(tutor)}
                >
                  <Ionicons name="star" size={18} color="#fff" />
                  <Text style={styles.reviewButtonText}>{t('pages.reviews.write_review')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        ) : (
          myReviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('pages.reviews.no_reviews_yet')}</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {t('pages.reviews.no_reviews_desc')}
              </Text>
            </View>
          ) : (
            myReviews.map((review) => (
              <View key={review.review_id} style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="checkmark" size={24} color={colors.success} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.tutorName, { color: colors.text }]}>{review.tutor_name}</Text>
                    <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
                      {formatDate(review.created_at)}
                    </Text>
                  </View>
                  <View style={styles.overallRating}>
                    <Text style={[styles.ratingNumber, { color: colors.primary }]}>
                      {review.overall_rating.toFixed(1)}
                    </Text>
                    <Ionicons name="star" size={16} color="#FFB800" />
                  </View>
                </View>
                
                <View style={styles.ratingsGrid}>
                  {RATING_CATEGORIES.map((cat) => (
                    <View key={cat.key} style={styles.ratingItem}>
                      <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>{t(cat.labelKey)}</Text>
                      {renderStars(review[cat.key as keyof typeof review] as number)}
                    </View>
                  ))}
                </View>
                
                {review.comment && (
                  <Text style={[styles.reviewComment, { color: colors.text }]}>"{review.comment}"</Text>
                )}
                
                <View style={[styles.recommendBadge, { backgroundColor: review.would_recommend ? colors.success + '20' : colors.error + '20' }]}>
                  <Ionicons 
                    name={review.would_recommend ? 'thumbs-up' : 'thumbs-down'} 
                    size={14} 
                    color={review.would_recommend ? colors.success : colors.error} 
                  />
                  <Text style={{ color: review.would_recommend ? colors.success : colors.error, fontSize: 12, marginLeft: 4 }}>
                    {review.would_recommend ? t('pages.reviews.would_recommend_yes') : t('pages.reviews.would_recommend_no')}
                  </Text>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={showReviewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Review {selectedTutor?.tutor_name}
              </Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {RATING_CATEGORIES.map((category) => (
                <View key={category.key} style={styles.ratingCategory}>
                  <View style={styles.categoryHeader}>
                    <Ionicons name={category.icon as any} size={20} color={colors.primary} />
                    <Text style={[styles.categoryLabel, { color: colors.text }]}>{t(category.labelKey)}</Text>
                  </View>
                  {renderStars(
                    ratings[category.key as keyof typeof ratings],
                    (value) => setRatings({ ...ratings, [category.key]: value })
                  )}
                </View>
              ))}

              <View style={styles.commentSection}>
                <Text style={[styles.commentLabel, { color: colors.text }]}>{t('pages.reviews.comments_optional')}</Text>
                <TextInput
                  style={[styles.commentInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  multiline
                  numberOfLines={4}
                  placeholder={t('pages.reviews.share_experience')}
                  placeholderTextColor={colors.textMuted}
                  value={comment}
                  onChangeText={setComment}
                />
              </View>

              <TouchableOpacity
                style={[styles.recommendToggle, { borderColor: colors.border }]}
                onPress={() => setWouldRecommend(!wouldRecommend)}
              >
                <Ionicons
                  name={wouldRecommend ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={wouldRecommend ? colors.success : colors.textMuted}
                />
                <Text style={[styles.recommendText, { color: colors.text }]}>
                  {t('pages.reviews.would_recommend')}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>{t('buttons.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={handleSubmitReview}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>{t('pages.reviews.submit_review')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabText: { fontSize: 15, fontWeight: '600' },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptyText: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700' },
  cardInfo: { flex: 1, marginLeft: 12 },
  tutorName: { fontSize: 16, fontWeight: '600' },
  subjects: { fontSize: 13, marginTop: 2 },
  reviewDate: { fontSize: 12, marginTop: 2 },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingNumber: { fontSize: 18, fontWeight: '700' },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  reviewButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ratingsGrid: {
    marginTop: 16,
    gap: 8,
  },
  ratingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: { fontSize: 13 },
  starsRow: { flexDirection: 'row', gap: 2 },
  starButton: { padding: 2 },
  reviewComment: {
    marginTop: 12,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
  },
  recommendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalBody: { padding: 16 },
  ratingCategory: {
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryLabel: { fontSize: 15, fontWeight: '500' },
  commentSection: { marginTop: 8 },
  commentLabel: { fontSize: 15, fontWeight: '500', marginBottom: 8 },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  recommendToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 12,
  },
  recommendText: { fontSize: 15 },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 15, fontWeight: '600' },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
