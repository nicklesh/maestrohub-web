import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useAuth } from '@/src/context/AuthContext';
import AppHeader from '@/src/components/AppHeader';

interface Tutor {
  tutor_id: string;
  user_name: string;
  user_email: string;
  categories: string[];
  subjects: string[];
  base_price: number;
  status: string;
  is_published: boolean;
  currency?: string;
  currency_symbol?: string;
  market_id?: string;
}

const STATUS_FILTER = [
  { id: 'all', name: 'All' },
  { id: 'pending', name: 'Pending' },
  { id: 'approved', name: 'Approved' },
  { id: 'suspended', name: 'Suspended' },
];

export default function AdminTutors() {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;

  const styles = getStyles(colors);

  useEffect(() => {
    loadTutors();
  }, [filter]);

  const loadTutors = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/admin/tutors', { 
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      setTutors(response.data);
    } catch (error) {
      console.error('Failed to load tutors:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTutors();
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleApprove = async (tutorId: string) => {
    setActionLoading(tutorId);
    try {
      await api.post(`/admin/tutors/${tutorId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('Success', 'Tutor approved!');
      loadTutors();
    } catch (error) {
      showAlert('Error', 'Failed to approve tutor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (tutorId: string) => {
    setActionLoading(tutorId);
    try {
      await api.post(`/admin/tutors/${tutorId}/suspend`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showAlert('Success', 'Tutor suspended');
      loadTutors();
    } catch (error) {
      showAlert('Error', 'Failed to suspend tutor');
    } finally {
      setActionLoading(null);
    }
  };

  // Truncate text to max chars
  const truncateText = (text: string, maxLength: number = 12) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const renderTutor = ({ item }: { item: Tutor }) => (
    <View style={[styles.card, isTablet && styles.cardTablet]}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, isTablet && styles.avatarTablet]}>
          <Text style={[styles.avatarText, isTablet && styles.avatarTextTablet]}>
            {item.user_name?.charAt(0)?.toUpperCase() || 'T'}
          </Text>
        </View>
        <View style={styles.tutorInfo}>
          <Text style={[styles.tutorName, isDesktop && styles.tutorNameDesktop]} numberOfLines={1}>
            {item.user_name}
          </Text>
          <Text style={styles.tutorEmail} numberOfLines={1}>{item.user_email}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            item.status === 'approved' && styles.statusApproved,
            item.status === 'pending' && styles.statusPending,
            item.status === 'suspended' && styles.statusSuspended,
          ]}
        >
          <Text style={styles.statusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Categories and Subjects - Trimmed Pills */}
      <View style={styles.tagsContainer}>
        {(item.categories || []).slice(0, 2).map((cat) => (
          <View key={cat} style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>{truncateText(cat, 15)}</Text>
          </View>
        ))}
        {(item.subjects || []).slice(0, 2).map((subj) => (
          <View key={subj} style={styles.subjectPill}>
            <Text style={styles.subjectPillText}>{truncateText(subj, 12)}</Text>
          </View>
        ))}
        {((item.categories?.length || 0) + (item.subjects?.length || 0)) > 4 && (
          <View style={styles.morePill}>
            <Text style={styles.morePillText}>
              +{(item.categories?.length || 0) + (item.subjects?.length || 0) - 4}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.price}>{item.currency_symbol || '$'}{item.base_price}/hr</Text>
        <Text style={styles.publishStatus}>
          {item.is_published ? '✓ Published' : '○ Unpublished'}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {item.status !== 'approved' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn, isTablet && styles.actionBtnTablet]}
            onPress={() => handleApprove(item.tutor_id)}
            disabled={actionLoading === item.tutor_id}
          >
            {actionLoading === item.tutor_id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {item.status !== 'suspended' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.suspendBtn, isTablet && styles.actionBtnTablet]}
            onPress={() => handleSuspend(item.tutor_id)}
            disabled={actionLoading === item.tutor_id}
          >
            {actionLoading === item.tutor_id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="close" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Suspend</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack={false} />
      <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        {/* Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Manage Coaches</Text>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.filterRow, isTablet && styles.filterRowTablet]}>
          {STATUS_FILTER.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterChip,
                filter === f.id && styles.filterChipActive,
              ]}
              onPress={() => setFilter(f.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === f.id && styles.filterChipTextActive,
                ]}
              >
                {f.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tutors List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={tutors}
            renderItem={renderTutor}
            keyExtractor={(item) => item.tutor_id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color={colors.textMuted} />
                <Text style={styles.emptyText}>No tutors found</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  headerTablet: {
    padding: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  titleDesktop: {
    fontSize: 28,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterRowTablet: {
    paddingHorizontal: 24,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  cardTablet: {
    borderRadius: 20,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTablet: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.primary,
  },
  avatarTextTablet: {
    fontSize: 24,
  },
  tutorInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tutorNameDesktop: {
    fontSize: 18,
  },
  tutorEmail: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.gray200,
  },
  statusApproved: {
    backgroundColor: colors.successLight,
  },
  statusPending: {
    backgroundColor: colors.accent + '30',
  },
  statusSuspended: {
    backgroundColor: colors.errorLight,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  categoryPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary,
  },
  subjectPill: {
    backgroundColor: colors.gray200,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectPillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.text,
  },
  morePill: {
    backgroundColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  morePillText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  publishStatus: {
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnTablet: {
    paddingVertical: 12,
    borderRadius: 12,
  },
  approveBtn: {
    backgroundColor: colors.success,
  },
  suspendBtn: {
    backgroundColor: colors.error,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
  },
});
