import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import { api } from '@/src/services/api';
import AppHeader from '@/src/components/AppHeader';

interface TutorProfile {
  tutor_id: string;
  bio: string;
  categories: string[];
  meeting_link?: string;
  waiting_room_enabled?: boolean;
  subjects: string[];
  levels: string[];
  modality: string[];
  base_price: number;
  duration_minutes: number;
  status: string;
  is_published: boolean;
}

export default function TutorSettings() {
  const { user, logout, token } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [toggling, setToggling] = useState(false);
  const [savingMeetingLink, setSavingMeetingLink] = useState(false);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;

  const styles = getStyles(colors);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/tutors/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
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
        await api.post('/tutors/unpublish', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await api.post('/tutors/publish', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      loadProfile();
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to update';
      if (Platform.OS === 'web') {
        showInfo(errorMsg);
      } else {
        showInfo(errorMsg, 'Error');
      }
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      try {
        // Clear storage first on web
        if (Platform.OS === 'web') {
          try {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            sessionStorage.clear();
          } catch (e) {
            console.error('Storage clear error:', e);
          }
        }
        
        // Call logout to clear auth state
        await logout();
      } catch (e) {
        console.error('Logout error:', e);
      }
      
      // Navigate to login - use router.replace for expo-router
      router.replace('/(auth)/login');
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        await doLogout();
      }
    } else {
      showInfo('Are you sure?', 'Logout');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader />
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Profile Header */}
          <View style={[styles.profileHeader, isTablet && styles.profileHeaderTablet]}>
            <View style={[styles.avatar, isDesktop && styles.avatarDesktop]}>
              <Text style={[styles.avatarText, isDesktop && styles.avatarTextDesktop]}>
                {user?.name?.charAt(0)?.toUpperCase() || 'T'}
              </Text>
            </View>
            <Text style={[styles.userName, isDesktop && styles.userNameDesktop]}>{user?.name}</Text>
            <Text style={[styles.userEmail, isDesktop && styles.userEmailDesktop]}>{user?.email}</Text>
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
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, isDesktop && styles.cardTitleDesktop]}>{t('pages.coach.settings.profile_summary')}</Text>
                <TouchableOpacity onPress={() => router.push('/(tutor)/onboarding')}>
                  <Text style={styles.editLink}>{t('common.edit')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isDesktop && styles.infoLabelDesktop]}>{t('pages.coach.onboarding.categories')}</Text>
                <Text style={[styles.infoValue, isDesktop && styles.infoValueDesktop]}>{profile.categories?.join(', ') || t('common.not_set')}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isDesktop && styles.infoLabelDesktop]}>{t('pages.coach.settings.subjects')}</Text>
                <Text style={[styles.infoValue, isDesktop && styles.infoValueDesktop]}>{profile.subjects?.join(', ') || t('common.not_set')}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isDesktop && styles.infoLabelDesktop]}>{t('pages.coach.settings.hourly_rate')}</Text>
                <Text style={[styles.infoValue, isDesktop && styles.infoValueDesktop]}>
                  ${profile.base_price}/{profile.duration_minutes}min
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isDesktop && styles.infoLabelDesktop]}>{t('pages.coach.settings.modality')}</Text>
                <Text style={[styles.infoValue, isDesktop && styles.infoValueDesktop]}>{profile.modality?.join(', ') || t('common.not_set')}</Text>
              </View>
            </View>
          )}

          {/* Meeting Link Section (for online sessions) */}
          {profile && profile.modality?.includes('online') && (
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="videocam" size={20} color={colors.primary} />
                  <Text style={[styles.cardTitle, isDesktop && styles.cardTitleDesktop]}>{t('pages.tutor_settings.meeting_link')}</Text>
                </View>
              </View>
              <Text style={[styles.meetingHint, { color: colors.textMuted }]}>
                {t('pages.tutor_settings.meeting_link_desc')}
              </Text>
              <View style={[styles.meetingInputRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="link" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.meetingInput, { color: colors.text }]}
                  placeholder={t('pages.become_tutor.meeting_link_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  value={profile.meeting_link || ''}
                  onChangeText={(text) => setProfile({ ...profile, meeting_link: text })}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
              <Text style={[styles.meetingHintSmall, { color: colors.textMuted }]}>
                {t('pages.become_tutor.meeting_link_hint')}
              </Text>
              
              {/* Waiting Room Toggle */}
              <TouchableOpacity
                style={styles.waitingRoomRow}
                onPress={() => setProfile({ ...profile, waiting_room_enabled: !profile.waiting_room_enabled })}
              >
                <Ionicons 
                  name={profile.waiting_room_enabled !== false ? 'checkbox' : 'square-outline'} 
                  size={24} 
                  color={profile.waiting_room_enabled !== false ? colors.primary : colors.textMuted} 
                />
                <View style={styles.waitingRoomTextContainer}>
                  <Text style={[styles.waitingRoomLabel, { color: colors.text }]}>{t('pages.become_tutor.waiting_room_enabled')}</Text>
                  <Text style={[styles.waitingRoomDesc, { color: colors.textMuted }]}>{t('pages.become_tutor.waiting_room_desc')}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveMeetingButton, { backgroundColor: colors.primary }, savingMeetingLink && { opacity: 0.7 }]}
                onPress={async () => {
                  setSavingMeetingLink(true);
                  try {
                    await api.put('/tutors/meeting-link', { 
                      meeting_link: profile.meeting_link || null,
                      waiting_room_enabled: profile.waiting_room_enabled !== false
                    }, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    showSuccess(t('pages.tutor_settings.meeting_link_saved'));
                  } catch (error: any) {
                    let errorMsg = t('pages.tutor_settings.meeting_link_save_failed');
                    const detail = error.response?.data?.detail;
                    if (typeof detail === 'string') {
                      errorMsg = detail;
                    } else if (Array.isArray(detail) && detail.length > 0 && detail[0].msg) {
                      errorMsg = detail[0].msg;
                    }
                    showError(errorMsg);
                  } finally {
                    setSavingMeetingLink(false);
                  }
                }}
                disabled={savingMeetingLink}
              >
                {savingMeetingLink ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveMeetingButtonText}>{t('pages.tutor_settings.save_link')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Multi-Market Settings */}
          {profile && (profile.modality?.includes('online') || profile.modality?.includes('hybrid')) && (
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.cardHeader}>
                <Ionicons name="globe-outline" size={22} color={colors.primary} />
                <Text style={[styles.cardTitle, isDesktop && styles.cardTitleDesktop]}>Multi-Market Exposure</Text>
              </View>
              <Text style={[styles.meetingHint, { color: colors.textMuted }]}>
                Since you offer online/hybrid sessions, you can choose to appear in search results for other markets.
              </Text>
              <TouchableOpacity
                style={[styles.menuItem, isTablet && styles.menuItemTablet, { borderBottomWidth: 0, marginTop: 8 }]}
                onPress={() => router.push('/(tutor)/market-settings')}
              >
                <Ionicons name="earth-outline" size={isTablet ? 24 : 22} color={colors.primary} />
                <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>Manage Markets & Pricing</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Publish Toggle */}
          {profile && profile.status === 'approved' && (
            <View style={[styles.card, isTablet && styles.cardTablet]}>
              <View style={styles.publishRow}>
                <View>
                  <Text style={[styles.publishTitle, isDesktop && styles.publishTitleDesktop]}>{t('pages.coach.settings.listing_status')}</Text>
                  <Text style={styles.publishSubtitle}>
                    {profile.is_published ? t('pages.coach.settings.profile_visible') : t('pages.coach.settings.profile_hidden')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.publishToggle,
                    isTablet && styles.publishToggleTablet,
                    profile.is_published && styles.publishToggleActive,
                  ]}
                  onPress={togglePublish}
                  disabled={toggling}
                >
                  {toggling ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.publishToggleText}>
                      {profile.is_published ? t('pages.coach.settings.published') : t('pages.coach.settings.publish')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Appearance Section */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <Text style={[styles.cardTitle, isDesktop && styles.cardTitleDesktop, { marginBottom: 16 }]}>{t('navigation.appearance')}</Text>
            <View style={styles.themeRow}>
              <View style={styles.themeLeft}>
                <Ionicons 
                  name={isDark ? 'moon' : 'sunny'} 
                  size={isTablet ? 24 : 22} 
                  color={colors.primary} 
                />
                <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>
                  {t('pages.coach.settings.dark_mode')}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={isDark ? colors.white : colors.white}
              />
            </View>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet, { borderBottomWidth: 0, marginTop: 8 }]}
              onPress={() => router.push('/(tutor)/language')}
            >
              <Ionicons name="language" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>{t('pages.coach.settings.language')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Grow Your Business Section */}
          <View style={[styles.menu, isTablet && styles.menuTablet]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('pages.coach.settings.grow_business')}</Text>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet]}
              onPress={() => router.push('/(tutor)/reviews')}
            >
              <Ionicons name="star-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>{t('pages.coach.reviews.title')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet]}
              onPress={() => router.push('/(tutor)/packages')}
            >
              <Ionicons name="pricetags-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>{t('pages.coach.packages.title')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/(tutor)/sponsorship')}
            >
              <Ionicons name="megaphone-outline" size={isTablet ? 24 : 22} color={colors.warning} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>{t('pages.coach.sponsorship.title')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Account Settings Section */}
          <View style={[styles.menu, isTablet && styles.menuTablet]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t('pages.coach.settings.title')}</Text>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet]}
              onPress={() => router.push('/(tutor)/billing')}
            >
              <Ionicons name="wallet-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>{t('pages.coach.billing.title')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet]}
              onPress={() => router.push('/(tutor)/notifications')}
            >
              <Ionicons name="notifications-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>{t('pages.coach.notifications.title')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/(tutor)/faq')}
            >
              <Ionicons name="help-circle-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>{t('pages.coach.settings.help_support')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={[styles.logoutButton, isTablet && styles.logoutButtonTablet]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={styles.logoutText}>{t('pages.coach.settings.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
  scrollContentTablet: {
    paddingVertical: 32,
  },
  contentWrapper: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileHeaderTablet: {
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    borderBottomWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
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
  avatarDesktop: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.primary,
  },
  avatarTextDesktop: {
    fontSize: 40,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  userNameDesktop: {
    fontSize: 26,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  userEmailDesktop: {
    fontSize: 16,
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
    color: colors.text,
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
  cardTablet: {
    borderRadius: 20,
    padding: 24,
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
  cardTitleDesktop: {
    fontSize: 18,
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
  infoLabelDesktop: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  infoValueDesktop: {
    fontSize: 16,
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
  publishTitleDesktop: {
    fontSize: 18,
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
  publishToggleTablet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  publishToggleActive: {
    backgroundColor: colors.success,
  },
  publishToggleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  menuTablet: {
    borderRadius: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  menuItemTablet: {
    padding: 20,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  menuItemTextDesktop: {
    fontSize: 17,
  },
  // Meeting Link Styles
  meetingHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  meetingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
  },
  meetingInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  saveMeetingButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveMeetingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  logoutButtonTablet: {
    padding: 18,
    borderRadius: 14,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
  meetingHintSmall: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  waitingRoomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  waitingRoomTextContainer: {
    flex: 1,
  },
  waitingRoomLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  waitingRoomDesc: {
    fontSize: 13,
    marginTop: 2,
  },
});
