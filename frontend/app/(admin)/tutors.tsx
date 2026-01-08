import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';

interface Tutor {
  tutor_id: string;
  user_name: string;
  user_email: string;
  categories: string[];
  subjects: string[];
  base_price: number;
  status: string;
  is_published: boolean;
}

const STATUS_FILTER = [
  { id: 'all', name: 'All' },
  { id: 'pending', name: 'Pending' },
  { id: 'approved', name: 'Approved' },
  { id: 'suspended', name: 'Suspended' },
];

export default function AdminTutors() {
  const { width } = useWindowDimensions();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;
  const numColumns = isDesktop ? 2 : 1;

  useEffect(() => {
    loadTutors();
  }, [filter]);

  const loadTutors = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/admin/tutors', { params });
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

  const handleApprove = async (tutorId: string) => {
    setActionLoading(tutorId);
    try {
      await api.post(`/admin/tutors/${tutorId}/approve`);
      Alert.alert('Success', 'Tutor approved!');
      loadTutors();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve tutor');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = (tutor: Tutor) => {
    Alert.alert(
      'Suspend Tutor',
      `Are you sure you want to suspend ${tutor.user_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(tutor.tutor_id);
            try {
              await api.post(`/admin/tutors/${tutor.tutor_id}/suspend`);
              Alert.alert('Success', 'Tutor suspended');
              loadTutors();
            } catch (error) {
              Alert.alert('Error', 'Failed to suspend tutor');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const renderTutorCard = ({ item, index }: { item: Tutor; index: number }) => (
    <View
      style={[
        styles.tutorCard,
        isTablet && styles.tutorCardTablet,
        isDesktop && {
          marginRight: index % 2 === 0 ? 8 : 0,
          marginLeft: index % 2 === 1 ? 8 : 0,
          flex: 1,
        },
      ]}
    >
      <View style={styles.tutorHeader}>
        <View style={[styles.tutorAvatar, isTablet && styles.tutorAvatarTablet]}>
          <Text style={[styles.avatarText, isTablet && styles.avatarTextTablet]}>
            {item.user_name?.charAt(0)?.toUpperCase() || 'T'}
          </Text>
        </View>
        <View style={styles.tutorInfo}>
          <Text style={[styles.tutorName, isDesktop && styles.tutorNameDesktop]}>{item.user_name}</Text>
          <Text style={styles.tutorEmail}>{item.user_email}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            item.status === 'approved'
              ? styles.statusApproved
              : item.status === 'pending'
              ? styles.statusPending
              : styles.statusSuspended,
          ]}
        >
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.tutorMeta}>
        <Text style={styles.metaText}>
          {item.categories.join(', ')} - {item.subjects.slice(0, 3).join(', ')}
        </Text>
        <Text style={[styles.metaPrice, isDesktop && styles.metaPriceDesktop]}>${item.base_price}/hr</Text>
      </View>

      <View style={styles.actions}>
        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.approveButton, isTablet && styles.approveButtonTablet]}
            onPress={() => handleApprove(item.tutor_id)}
            disabled={actionLoading === item.tutor_id}
          >
            {actionLoading === item.tutor_id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.approveButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {item.status !== 'suspended' && (
          <TouchableOpacity
            style={[styles.suspendButton, isTablet && styles.suspendButtonTablet]}
            onPress={() => handleSuspend(item)}
            disabled={actionLoading === item.tutor_id}
          >
            <Ionicons name="close" size={18} color={colors.error} />
            <Text style={styles.suspendButtonText}>Suspend</Text>
          </TouchableOpacity>
        )}
        {item.status === 'suspended' && (
          <TouchableOpacity
            style={[styles.approveButton, isTablet && styles.approveButtonTablet]}
            onPress={() => handleApprove(item.tutor_id)}
            disabled={actionLoading === item.tutor_id}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.approveButtonText}>Reactivate</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Manage Tutors</Text>
        </View>

        {/* Filter */}
        <FlatList
          data={STATUS_FILTER}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filterList, isTablet && styles.filterListTablet]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterChip, isTablet && styles.filterChipTablet, filter === item.id && styles.filterChipActive]}
              onPress={() => setFilter(item.id)}
            >
              <Text style={[styles.filterText, isTablet && styles.filterTextTablet, filter === item.id && styles.filterTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
        />

        {/* Tutors List */}
        {tutors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={isTablet ? 80 : 64} color={colors.textMuted} />
            <Text style={[styles.emptyText, isDesktop && styles.emptyTextDesktop]}>No tutors found</Text>
          </View>
        ) : (
          <FlatList
            data={tutors}
            renderItem={renderTutorCard}
            keyExtractor={(item) => item.tutor_id}
            contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
            numColumns={numColumns}
            key={numColumns}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  headerTablet: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  titleDesktop: {
    fontSize: 32,
  },
  filterList: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterListTablet: {
    paddingHorizontal: 24,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterChipTablet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: colors.text,
  },
  filterTextTablet: {
    fontSize: 16,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  listContentTablet: {
    padding: 24,
    paddingTop: 0,
  },
  tutorCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tutorCardTablet: {
    borderRadius: 20,
    padding: 20,
  },
  tutorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tutorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorAvatarTablet: {
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
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tutorMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaText: {
    fontSize: 13,
    color: colors.textMuted,
    flex: 1,
  },
  metaPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  metaPriceDesktop: {
    fontSize: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.success,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButtonTablet: {
    paddingVertical: 12,
    borderRadius: 10,
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  suspendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.errorLight,
    paddingVertical: 10,
    borderRadius: 8,
  },
  suspendButtonTablet: {
    paddingVertical: 12,
    borderRadius: 10,
  },
  suspendButtonText: {
    color: colors.error,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 16,
  },
  emptyTextDesktop: {
    fontSize: 18,
  },
});
