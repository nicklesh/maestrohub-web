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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Review {
  review_id: string;
  consumer_name: string;
  teaching_quality: number;
  communication: number;
  punctuality: number;
  knowledge: number;
  value_for_money: number;
  overall_rating: number;
  comment?: string;
  would_recommend: boolean;
  created_at: string;
  coach_response?: string;
  coach_response_at?: string;
}

const RATING_CATEGORIES = [
  { key: 'teaching_quality', label: 'Teaching' },
  { key: 'communication', label: 'Communication' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'value_for_money', label: 'Value' },
];

export default function CoachReviewsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  
  // Response modal state
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [responseText, setResponseText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await api.get('/tutor/reviews', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReviews(response.data.reviews || []);
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

  const handleStartResponse = (review: Review) => {
    setSelectedReview(review);
    setResponseText('');
    setShowResponseModal(true);
  };

  const handleSubmitResponse = async () => {
    if (!selectedReview || !responseText.trim()) {
      Alert.alert('Required', 'Please enter a response');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.post(`/reviews/${selectedReview.review_id}/respond`, {
        response: responseText.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showSuccess('Your response has been added.');
      setShowResponseModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (rating: number) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Ionicons
          key={value}
          name={value <= rating ? 'star' : 'star-outline'}
          size={14}
          color={value <= rating ? '#FFB800' : colors.gray300}
        />
      ))}
    </View>
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate stats
  const stats = reviews.length > 0 ? {
    avgRating: (reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length).toFixed(1),
    recommendPct: Math.round((reviews.filter(r => r.would_recommend).length / reviews.length) * 100),
    needsResponse: reviews.filter(r => !r.coach_response).length,
  } : { avgRating: '0.0', recommendPct: 0, needsResponse: 0 };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title="My Reviews" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title="My Reviews" />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {/* Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.avgRating}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Rating</Text>
            </View>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>{stats.recommendPct}%</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Recommend</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{reviews.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Reviews</Text>
          </View>
        </View>

        {/* Pending Responses Alert */}
        {stats.needsResponse > 0 && (
          <View style={[styles.alertCard, { backgroundColor: colors.warning + '20' }]}>
            <Ionicons name="chatbubble-ellipses" size={20} color={colors.warning} />
            <Text style={[styles.alertText, { color: colors.warning }]}>
              {stats.needsResponse} review{stats.needsResponse > 1 ? 's' : ''} awaiting your response
            </Text>
          </View>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Reviews Yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Reviews from your clients will appear here
            </Text>
          </View>
        ) : (
          reviews.map((review) => (
            <View key={review.review_id} style={[styles.card, { backgroundColor: colors.surface }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {review.consumer_name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={[styles.reviewerName, { color: colors.text }]}>{review.consumer_name}</Text>
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

              {/* Category Ratings */}
              <View style={styles.ratingsGrid}>
                {RATING_CATEGORIES.map((cat) => (
                  <View key={cat.key} style={styles.ratingItem}>
                    <Text style={[styles.ratingLabel, { color: colors.textMuted }]}>{cat.label}</Text>
                    {renderStars(review[cat.key as keyof Review] as number)}
                  </View>
                ))}
              </View>

              {/* Comment */}
              {review.comment && (
                <View style={[styles.commentBox, { backgroundColor: colors.background }]}>
                  <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.commentText, { color: colors.text }]}>"{review.comment}"</Text>
                </View>
              )}

              {/* Recommendation Badge */}
              <View style={[
                styles.recommendBadge, 
                { backgroundColor: review.would_recommend ? colors.success + '20' : colors.error + '20' }
              ]}>
                <Ionicons 
                  name={review.would_recommend ? 'thumbs-up' : 'thumbs-down'} 
                  size={14} 
                  color={review.would_recommend ? colors.success : colors.error} 
                />
                <Text style={{ 
                  color: review.would_recommend ? colors.success : colors.error, 
                  fontSize: 12, 
                  marginLeft: 4,
                  fontWeight: '500'
                }}>
                  {review.would_recommend ? 'Would recommend' : 'Would not recommend'}
                </Text>
              </View>

              {/* Coach Response Section */}
              {review.coach_response ? (
                <View style={[styles.responseBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                  <View style={styles.responseHeader}>
                    <Ionicons name="chatbubble-ellipses" size={16} color={colors.primary} />
                    <Text style={[styles.responseLabel, { color: colors.primary }]}>Your Response</Text>
                    <Text style={[styles.responseDate, { color: colors.textMuted }]}>
                      {review.coach_response_at ? formatDate(review.coach_response_at) : ''}
                    </Text>
                  </View>
                  <Text style={[styles.responseText, { color: colors.text }]}>{review.coach_response}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.respondButton, { borderColor: colors.primary }]}
                  onPress={() => handleStartResponse(review)}
                >
                  <Ionicons name="chatbubble-outline" size={18} color={colors.primary} />
                  <Text style={[styles.respondButtonText, { color: colors.primary }]}>Write Response</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Response Modal */}
      <Modal visible={showResponseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Respond to Review
              </Text>
              <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Review Summary */}
              {selectedReview && (
                <View style={[styles.reviewSummary, { backgroundColor: colors.background }]}>
                  <View style={styles.summaryHeader}>
                    <Text style={[styles.summaryName, { color: colors.text }]}>
                      {selectedReview.consumer_name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={[styles.summaryRating, { color: colors.primary }]}>
                        {selectedReview.overall_rating.toFixed(1)}
                      </Text>
                      <Ionicons name="star" size={14} color="#FFB800" />
                    </View>
                  </View>
                  {selectedReview.comment && (
                    <Text style={[styles.summaryComment, { color: colors.textMuted }]}>
                      "{selectedReview.comment}"
                    </Text>
                  )}
                </View>
              )}

              <Text style={[styles.inputLabel, { color: colors.text }]}>Your Response</Text>
              <TextInput
                style={[styles.responseInput, { 
                  backgroundColor: colors.background, 
                  color: colors.text, 
                  borderColor: colors.border 
                }]}
                multiline
                numberOfLines={5}
                placeholder="Thank the reviewer and address any feedback professionally..."
                placeholderTextColor={colors.textMuted}
                value={responseText}
                onChangeText={setResponseText}
                maxLength={500}
              />
              <Text style={[styles.charCount, { color: colors.textMuted }]}>
                {responseText.length}/500
              </Text>

              <View style={[styles.tipBox, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="bulb" size={18} color={colors.primary} />
                <Text style={[styles.tipText, { color: colors.primary }]}>
                  Tip: Thank the client, acknowledge feedback, and highlight your commitment to quality.
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowResponseModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={handleSubmitResponse}
                disabled={submitting || !responseText.trim()}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Response</Text>
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
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  statsCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, marginVertical: 4 },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  alertText: { fontSize: 13, fontWeight: '500' },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1, marginLeft: 12 },
  reviewerName: { fontSize: 15, fontWeight: '600' },
  reviewDate: { fontSize: 12, marginTop: 2 },
  overallRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingNumber: { fontSize: 18, fontWeight: '700' },
  ratingsGrid: {
    marginTop: 16,
    gap: 6,
  },
  ratingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: { fontSize: 12 },
  starsRow: { flexDirection: 'row', gap: 2 },
  commentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  commentText: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
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
  responseBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  responseLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  responseDate: { fontSize: 11 },
  responseText: { fontSize: 14, lineHeight: 20 },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  respondButtonText: { fontSize: 14, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
  reviewSummary: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryName: { fontSize: 15, fontWeight: '600' },
  summaryRating: { fontSize: 15, fontWeight: '700' },
  summaryComment: { marginTop: 8, fontSize: 13, fontStyle: 'italic' },
  inputLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  responseInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
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
