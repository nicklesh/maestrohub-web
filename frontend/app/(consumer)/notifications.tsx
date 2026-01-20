import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Notification {
  notification_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t, locale } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await api.post(`/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const getNotificationIcon = (type: string): any => {
    switch (type) {
      case 'payment_completed': return 'checkmark-circle';
      case 'session_canceled': return 'close-circle';
      case 'system_maintenance': return 'construct';
      case 'invite_received': return 'mail';
      case 'invite_accepted': return 'person-add';
      case 'schedule_sent': return 'send';
      case 'contact_received': return 'chatbubble';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'payment_completed': return colors.success;
      case 'session_canceled': return colors.error;
      case 'invite_accepted': return colors.success;
      default: return colors.primary;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return t('pages.notifications.just_now');
    if (hours < 24) return t('pages.notifications.hours_ago', { count: hours });
    if (days < 7) return t('pages.notifications.days_ago', { count: days });
    // Use locale-aware date formatting
    const localeCode = locale === 'hi_IN' ? 'hi-IN' : locale === 'te_IN' ? 'te-IN' : locale?.replace('_', '-') || 'en-US';
    return date.toLocaleDateString(localeCode, { month: 'short', day: 'numeric' });
  };

  // Translate notification content based on type
  const getTranslatedTitle = (item: Notification): string => {
    const typeToKey: { [key: string]: string } = {
      'system_maintenance': 'pages.notifications.types.system_update',
      'system_update': 'pages.notifications.types.system_update',
      'platform_improvements': 'pages.notifications.types.platform_improvements',
      'schedule_sent': 'pages.notifications.types.schedule_sent',
      'schedule_renewal': 'pages.notifications.types.schedule_sent',
      'contact_received': 'pages.notifications.types.contact_received',
      'invite_sent': 'pages.notifications.types.invite_sent',
      'invite_received': 'pages.notifications.types.invite_received',
      'consumer_invite': 'pages.notifications.types.invite_received',
      'invite_accepted': 'pages.notifications.types.invite_accepted',
      'payment_completed': 'pages.notifications.types.payment_completed',
      'session_canceled': 'pages.notifications.types.session_canceled',
      'booking_confirmed': 'pages.notifications.types.booking_confirmed',
      'reminder': 'pages.notifications.types.reminder',
    };
    const key = typeToKey[item.type];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
    return item.title;
  };

  const getTranslatedMessage = (item: Notification): string => {
    const typeToKey: { [key: string]: string } = {
      'system_maintenance': 'pages.notifications.messages.system_update',
      'system_update': 'pages.notifications.messages.system_update',
      'platform_improvements': 'pages.notifications.messages.platform_improvements',
      'schedule_sent': 'pages.notifications.messages.schedule_sent',
      'schedule_renewal': 'pages.notifications.messages.schedule_sent',
      'contact_received': 'pages.notifications.messages.contact_received',
      'invite_sent': 'pages.notifications.messages.invite_sent',
      'invite_received': 'pages.notifications.messages.invite_received',
      'consumer_invite': 'pages.notifications.messages.invite_received',
      'invite_accepted': 'pages.notifications.messages.invite_accepted',
      'payment_completed': 'pages.notifications.messages.payment_completed',
      'session_canceled': 'pages.notifications.messages.session_canceled',
      'booking_confirmed': 'pages.notifications.messages.booking_confirmed',
      'reminder': 'pages.notifications.messages.reminder',
    };
    const key = typeToKey[item.type];
    if (key) {
      const translated = t(key, item.data || {});
      if (translated && translated !== key) return translated;
    }
    return item.message;
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        { backgroundColor: colors.surface },
        !item.read && { backgroundColor: colors.primaryLight }
      ]}
      onPress={() => !item.read && markAsRead(item.notification_id)}
    >
      <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + '20' }]}>
        <Ionicons name={getNotificationIcon(item.type)} size={24} color={getNotificationColor(item.type)} />
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, { color: colors.text }]}>{getTranslatedTitle(item)}</Text>
          <Text style={[styles.notificationTime, { color: colors.textMuted }]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
        <Text style={[styles.notificationMessage, { color: colors.textMuted }]}>{getTranslatedMessage(item)}</Text>
        {!item.read && (
          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack showUserName title={t('pages.notifications.title')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title={t('pages.notifications.title')} />

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('pages.notifications.no_notifications')}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {t('pages.notifications.no_notifications_desc')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.notification_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
    position: 'relative',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  notificationTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
