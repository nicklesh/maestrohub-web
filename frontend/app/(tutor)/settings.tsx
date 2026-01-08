import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';

interface TutorProfile {
  tutor_id: string;
  bio: string;
  categories: string[];
  subjects: string[];
  levels: string[];
  modality: string[];
  base_price: number;
  duration_minutes: number;
  status: string;
  is_published: boolean;
}

export default function TutorSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/tutors/profile');
      setProfile(response.data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async () => {
    if (!profile) return;
    setToggling(true);
    try {
      if (profile.is_published) {
        await api.post('/tutors/unpublish');
      } else {
        await api.post('/tutors/publish');
      }
      loadProfile();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update');
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'T'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {profile && (
            <View
              style={[
                styles.statusBadge,
                profile.status === 'approved'
                  ? styles.statusApproved
                  : profile.status === 'pending'
                  ? styles.statusPending
                  : styles.statusSuspended,
              ]}
            >
              <Text style={styles.statusText}>
                {profile.status === 'approved'
                  ? 'Approved'
                  : profile.status === 'pending'
                  ? 'Pending Review'
                  : 'Suspended'}
              </Text>
            </View>
          )}
        </View>

        {/* Profile Summary */}
        {profile && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Profile Summary</Text>
              <TouchableOpacity onPress={() => router.push('/(tutor)/onboarding')}>
                <Text style={styles.editLink}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Categories</Text>
              <Text style={styles.infoValue}>{profile.categories.join(', ')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Subjects</Text>
              <Text style={styles.infoValue}>{profile.subjects.join(', ')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Rate</Text>
              <Text style={styles.infoValue}>
                ${profile.base_price}/{profile.duration_minutes}min
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Modality</Text>
              <Text style={styles.infoValue}>{profile.modality.join(', ')}</Text>
            </View>
          </View>
        )}

        {/* Publish Toggle */}
        {profile && profile.status === 'approved' && (
          <View style={styles.card}>
            <View style={styles.publishRow}>
              <View>
                <Text style={styles.publishTitle}>Listing Status</Text>
                <Text style={styles.publishSubtitle}>
                  {profile.is_published ? 'Your profile is visible to students' : 'Your profile is hidden'}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.publishToggle,
                  profile.is_published && styles.publishToggleActive,
                ]}
                onPress={togglePublish}
                disabled={toggling}
              >
                {toggling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.publishToggleText}>
                    {profile.is_published ? 'Published' : 'Publish'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Menu Items */}
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            <Text style={styles.menuItemText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.menuItemText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 32,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.primary,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
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
  },
  card: {
    backgroundColor: colors.surface,
    margin: 20,
    marginBottom: 0,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  editLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  publishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  publishTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  publishSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  publishToggle: {
    backgroundColor: colors.gray300,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  publishToggleActive: {
    backgroundColor: colors.success,
  },
  publishToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  menu: {
    backgroundColor: colors.surface,
    margin: 20,
    marginBottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    padding: 16,
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
});
