import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'booking' | 'payment' | 'system' | 'reminder';
  read: boolean;
  createdAt: string;
}

// Mock notifications for now
const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'New Booking Request',
    message: 'You have a new booking request from Sarah for Math tutoring.',
    type: 'booking',
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Payment Received',
    message: 'You received $50.00 for your session with John.',
    type: 'payment',
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '3',
    title: 'Profile Approved',
    message: 'Congratulations! Your tutor profile has been approved.',
    type: 'system',
    read: true,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

export default function TutorNotificationsScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const styles = getStyles(colors);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Use translated mock notifications
    const translatedNotifications: Notification[] = [
      {
        id: '1',
        title: t('pages.coach.notifications.new_booking_request') || 'New Booking Request',
        message: t('pages.coach.notifications.booking_message') || 'You have a new booking request from Sarah for Math tutoring.',
        type: 'booking',
        read: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        title: t('pages.coach.notifications.payment_received') || 'Payment Received',
        message: t('pages.coach.notifications.payment_message') || 'You received $50.00 for your session with John.',
        type: 'payment',
        read: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '3',
        title: t('pages.coach.notifications.profile_approved') || 'Profile Approved',
        message: t('pages.coach.notifications.profile_approved_message') || 'Congratulations! Your tutor profile has been approved.',
        type: 'system',
        read: true,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ];
    setNotifications(translatedNotifications);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return 'calendar';
      case 'payment':
        return 'card';
      case 'reminder':
        return 'alarm';
      default:
        return 'notifications';
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'booking':
        return colors.primary;
      case 'payment':
        return colors.success;
      case 'reminder':
        return colors.accent;
      default:
        return colors.textMuted;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="Notifications" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Notifications" showBack />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptyText}>You're all caught up!</Text>
          </View>
        ) : (
          notifications.map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[
                styles.notificationCard,
                !notification.read && styles.unreadCard,
              ]}
              onPress={() => markAsRead(notification.id)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: getIconColor(notification.type) + '20' },
                ]}
              >
                <Ionicons
                  name={getIcon(notification.type) as any}
                  size={20}
                  color={getIconColor(notification.type)}
                />
              </View>
              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle} numberOfLines={1}>
                    {notification.title}
                  </Text>
                  {!notification.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notificationMessage} numberOfLines={2}>
                  {notification.message}
                </Text>
                <Text style={styles.notificationTime}>
                  {formatDate(notification.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      padding: 16,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginTop: 16,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 8,
    },
    notificationCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    unreadCard: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    notificationContent: {
      flex: 1,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    notificationTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginLeft: 8,
    },
    notificationMessage: {
      fontSize: 14,
      color: colors.textMuted,
      lineHeight: 20,
    },
    notificationTime: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
    },
  });
