import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Switch,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useSubscription } from '@/src/context/SubscriptionContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { TrialBanner } from '@/src/components/PremiumFeatureGate';
import { api } from '@/src/services/api';

interface Notification {
  notification_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface Reminder {
  reminder_id: string;
  type: string;
  title: string;
  message: string;
  due_at: string;
  priority: string;
}

export default function ProfileScreen() {
  const { user, logout, token } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { showSuccess, showError, showWarning } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);

  const containerMaxWidth = isDesktop ? 600 : isTablet ? 500 : undefined;

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchReminders = async () => {
    try {
      const response = await api.get('/reminders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReminders(response.data.reminders || []);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    fetchReminders();
  }, []);

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

    // On web, use window.confirm instead of Alert
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(t('messages.confirm.logout'));
      if (confirmed) {
        await doLogout();
      }
    } else {
      // Use showWarning to indicate logout action with a follow-up
      showWarning(t('messages.confirm.logout'));
      // For now, just logout directly on mobile - in production you'd use a modal
      await doLogout();
    }
  };

  const [contactSuccess, setContactSuccess] = useState(false);
  
  const handleContactSubmit = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      showError(t('forms.validation.fill_all_fields'));
      return;
    }

    setSubmittingContact(true);
    try {
      await api.post('/contact', {
        subject: contactSubject,
        message: contactMessage,
        category: 'general'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Show success state
      setContactSuccess(true);
      setContactSubject('');
      setContactMessage('');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        setContactSuccess(false);
        setShowContactSheet(false);
        fetchNotifications();
      }, 2000);
      
    } catch (error) {
      showError(t('messages.errors.failed_to_send'));
    } finally {
      setSubmittingContact(false);
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'consumer': return t('pages.profile.parent_guardian');
      case 'tutor': return t('pages.profile.tutor_instructor');
      case 'admin': return t('pages.profile.administrator');
      default: return role;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_completed': return 'checkmark-circle';
      case 'session_canceled': return 'close-circle';
      case 'system_maintenance': return 'construct';
      case 'contact_received': return 'mail';
      default: return 'notifications';
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <AppHeader title={t('pages.profile.account_title')} />
      <TrialBanner />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.text }]}>{user?.name}</Text>
                <Text style={[styles.userRole, { color: colors.textMuted }]}>{getRoleDisplay(user?.role || '')}</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={[styles.notificationBadge, { backgroundColor: colors.surface }]} 
                onPress={() => setShowNotifications(true)}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.text} />
                {unreadCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.error }]}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.headerSeparator, { backgroundColor: colors.border }]} />

          {/* Theme Toggle */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.settings.appearance')}</Text>
            <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
              <View style={styles.menuItemLeft}>
                <Ionicons name={isDark ? "moon" : "sunny"} size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>
                  {isDark ? t('pages.profile.dark_mode') : t('pages.profile.light_mode')}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={colors.white}
              />
            </TouchableOpacity>
          </View>

          {/* Reminders Section */}
          {reminders.length > 0 && (
            <TouchableOpacity 
              style={[styles.section, { backgroundColor: colors.surface }]}
              onPress={() => setShowReminders(true)}
            >
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('navigation.reminders')}</Text>
                <View style={[styles.reminderBadge, { backgroundColor: colors.warning }]}>
                  <Text style={styles.reminderBadgeText}>{reminders.length}</Text>
                </View>
              </View>
              {reminders.slice(0, 2).map((reminder, index) => (
                <View key={index} style={styles.reminderItem}>
                  <Ionicons 
                    name={reminder.type === 'upcoming_session' ? 'calendar' : 'time'} 
                    size={18} 
                    color={reminder.priority === 'high' ? colors.error : colors.warning} 
                  />
                  <Text style={[styles.reminderText, { color: colors.text }]} numberOfLines={1}>
                    {reminder.message}
                  </Text>
                </View>
              ))}
            </TouchableOpacity>
          )}

          {/* Account Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.profile.account_title')}</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/edit-profile')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('pages.profile.edit_profile')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/notifications')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="notifications-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('pages.profile.notifications')}</Text>
              </View>
              {unreadCount > 0 && (
                <View style={[styles.menuBadge, { backgroundColor: colors.error }]}>
                  <Text style={styles.menuBadgeText}>{unreadCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/subscription')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="diamond-outline" size={22} color={colors.warning} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('subscription.title')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/reminders')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="alarm-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.reminders')}</Text>
              </View>
              {reminders.length > 0 && (
                <View style={[styles.menuBadge, { backgroundColor: colors.warning }]}>
                  <Text style={styles.menuBadgeText}>{reminders.length}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/reviews')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="star-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.reviews')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/billing')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="card-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.billing')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/reports')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.reports')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/tax-reports')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="document-text-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.tax_reports')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/referrals')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="gift-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.referrals')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/invite-parent')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="people-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.invite_parents')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/invite-provider')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-add-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.invite_providers')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {user?.role === 'consumer' && (
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/become-tutor')}>
                <View style={styles.menuItemLeft}>
                  <Ionicons name="school-outline" size={22} color={colors.primary} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.become_coach')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Support Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.profile.support')}</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => setShowContactSheet(true)}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="chatbubble-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('buttons.contact_us')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/faq')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="help-circle-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('navigation.help_center')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(consumer)/language')}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="language-outline" size={22} color={colors.primary} />
                <Text style={[styles.menuItemText, { color: colors.text }]}>{t('pages.settings.language')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity 
            style={[styles.logoutButton, { backgroundColor: colors.errorLight }]} 
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>{t('navigation.logout')}</Text>
          </TouchableOpacity>

          <Text style={[styles.version, { color: colors.textMuted }]}>{t('pages.profile.version')} 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { alignItems: 'center' }]}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowNotifications(false)}
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }, containerMaxWidth ? { maxWidth: containerMaxWidth, width: '100%' } : undefined]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('pages.profile.notifications')}</Text>
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {notifications.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('empty_states.no_notifications')}</Text>
              ) : (
                notifications.map((notif, index) => (
                  <View key={index} style={[styles.notifItem, !notif.read && { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name={getNotificationIcon(notif.type) as any} size={24} color={colors.primary} />
                    <View style={styles.notifContent}>
                      <Text style={[styles.notifTitle, { color: colors.text }]}>{notif.title}</Text>
                      <Text style={[styles.notifMessage, { color: colors.textMuted }]}>{notif.message}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Reminders Modal */}
      <Modal visible={showReminders} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { alignItems: 'center' }]}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowReminders(false)}
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }, containerMaxWidth ? { maxWidth: containerMaxWidth, width: '100%' } : undefined]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('navigation.reminders')}</Text>
              <TouchableOpacity onPress={() => setShowReminders(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {reminders.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('empty_states.no_reminders')}</Text>
              ) : (
                reminders.map((reminder, index) => (
                  <View key={index} style={[styles.notifItem, { borderLeftColor: reminder.priority === 'high' ? colors.error : colors.warning, borderLeftWidth: 3 }]}>
                    <Ionicons name="alarm" size={24} color={reminder.priority === 'high' ? colors.error : colors.warning} />
                    <View style={styles.notifContent}>
                      <Text style={[styles.notifTitle, { color: colors.text }]}>{reminder.title}</Text>
                      <Text style={[styles.notifMessage, { color: colors.textMuted }]}>{reminder.message}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Contact Us Bottom Sheet */}
      <Modal visible={showContactSheet} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { alignItems: 'center' }]}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => !contactSuccess && setShowContactSheet(false)}
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface, overflow: 'hidden' }, containerMaxWidth ? { maxWidth: containerMaxWidth, width: '100%' } : undefined]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            
            {/* Close Button */}
            {!contactSuccess && (
              <TouchableOpacity 
                style={styles.sheetCloseButton}
                onPress={() => setShowContactSheet(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            )}
            
            {contactSuccess ? (
              <View style={styles.successContainer}>
                <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                <Text style={[styles.successTitle, { color: colors.text }]}>{t('pages.contact.success_title')}</Text>
                <Text style={[styles.successText, { color: colors.textMuted }]}>
                  {t('pages.contact.success_message')}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <Ionicons name="mail" size={24} color={isDark ? '#FFD700' : colors.primary} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('pages.contact.title')}</Text>
                </View>
            
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.contact.subject')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.contact.subject_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={contactSubject}
              onChangeText={setContactSubject}
            />
            
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.contact.message')}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.contact.message_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={contactMessage}
              onChangeText={setContactMessage}
              multiline
              numberOfLines={4}
            />
            
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={handleContactSubmit}
              disabled={submittingContact}
            >
              {submittingContact ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>{t('pages.contact.send_message')}</Text>
              )}
            </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfo: {
    gap: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userRole: {
    fontSize: 13,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  notificationBadge: {
    padding: 8,
    borderRadius: 20,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerSeparator: {
    height: 1,
    marginVertical: 12,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuItemText: {
    fontSize: 15,
  },
  menuBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  menuBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  reminderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  reminderBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  reminderText: {
    fontSize: 13,
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalScroll: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  notifMessage: {
    fontSize: 13,
    marginTop: 2,
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  successText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
