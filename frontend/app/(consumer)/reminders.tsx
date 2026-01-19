import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Reminder {
  reminder_id: string;
  type: string;
  title: string;
  message: string;
  due_at: string;
  priority: string;
}

interface ReminderConfig {
  session_reminder_hours: number;
  payment_reminder_days: number;
  weekly_summary: boolean;
}

export default function RemindersScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [config, setConfig] = useState<ReminderConfig>({
    session_reminder_hours: 1,
    payment_reminder_days: 1,
    weekly_summary: true
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [remindersRes, configRes] = await Promise.all([
        api.get('/reminders', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/reminders/config', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setReminders(remindersRes.data.reminders || []);
      setConfig(configRes.data);
    } catch (error) {
      console.error('Failed to load reminders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveConfig = async (newConfig: ReminderConfig) => {
    setSaving(true);
    try {
      await api.put('/reminders/config', newConfig, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(newConfig);
      showSuccess('Reminder settings saved');
    } catch (error) {
      showError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    const days = Math.ceil(hours / 24);

    if (hours <= 0) return t('pages.reminders.now');
    if (hours < 24) return t('pages.reminders.in_hours', { count: hours });
    if (days === 1) return t('pages.reminders.tomorrow');
    return t('pages.reminders.in_days', { count: days });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      default: return colors.primary;
    }
  };

  const sessionHourOptions = [1, 2, 4, 12, 24];
  const paymentDayOptions = [1, 3, 7];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack showUserName title={t("pages.reminders.title")} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title={t("pages.reminders.title")} />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
        }
      >
        {/* Active Reminders */}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>{t('pages.reminders.active_reminders')}</Text>
        {reminders.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="alarm-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('pages.reminders.no_active_reminders')}</Text>
          </View>
        ) : (
          reminders.map((reminder) => (
            <View
              key={reminder.reminder_id}
              style={[
                styles.reminderCard,
                { backgroundColor: colors.surface, borderLeftColor: getPriorityColor(reminder.priority) }
              ]}
            >
              <View style={styles.reminderHeader}>
                <Ionicons
                  name={reminder.type === 'upcoming_session' ? 'calendar' : 'card'}
                  size={20}
                  color={getPriorityColor(reminder.priority)}
                />
                <Text style={[styles.reminderTitle, { color: colors.text }]}>{reminder.title}</Text>
                <Text style={[styles.reminderDue, { color: getPriorityColor(reminder.priority) }]}>
                  {formatDueDate(reminder.due_at)}
                </Text>
              </View>
              <Text style={[styles.reminderMessage, { color: colors.textMuted }]}>{reminder.message}</Text>
            </View>
          ))
        )}

        {/* Reminder Settings */}
        <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 24 }]}>{t('pages.reminders.reminder_settings')}</Text>

        <View style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{t('pages.reminders.session_reminders')}</Text>
          <Text style={[styles.settingDesc, { color: colors.textMuted }]}>{t('pages.reminders.session_reminders_desc')}</Text>
          <View style={styles.optionRow}>
            {sessionHourOptions.map((hours) => (
              <TouchableOpacity
                key={hours}
                style={[
                  styles.optionButton,
                  { backgroundColor: colors.background },
                  config.session_reminder_hours === hours && { backgroundColor: colors.primary }
                ]}
                onPress={() => saveConfig({ ...config, session_reminder_hours: hours })}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text },
                    config.session_reminder_hours === hours && { color: '#FFFFFF' }
                  ]}
                >
                  {hours}h
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{t('pages.reminders.payment_reminders')}</Text>
          <Text style={[styles.settingDesc, { color: colors.textMuted }]}>{t('pages.reminders.payment_reminders_desc')}</Text>
          <View style={styles.optionRow}>
            {paymentDayOptions.map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.optionButton,
                  { backgroundColor: colors.background },
                  config.payment_reminder_days === days && { backgroundColor: colors.primary }
                ]}
                onPress={() => saveConfig({ ...config, payment_reminder_days: days })}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: colors.text },
                    config.payment_reminder_days === days && { color: '#FFFFFF' }
                  ]}
                >
                  {days === 1 ? t('time.one_day') : t('time.n_days', { count: days })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.settingsCard, { backgroundColor: colors.surface }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>{t('pages.reminders.weekly_summary')}</Text>
              <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                {t('pages.reminders.weekly_summary_desc')}
              </Text>
            </View>
            <Switch
              value={config.weekly_summary}
              onValueChange={(value) => saveConfig({ ...config, weekly_summary: value })}
              trackColor={{ false: colors.gray300, true: colors.primary }}
              thumbColor={colors.white}
              disabled={saving}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  reminderCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reminderTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  reminderDue: {
    fontSize: 13,
    fontWeight: '500',
  },
  reminderMessage: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  settingsCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
});
