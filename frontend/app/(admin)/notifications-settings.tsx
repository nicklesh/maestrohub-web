import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  category: 'email' | 'push' | 'sms';
  enabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSetting[] = [
  { id: '1', title: 'New Coach Applications', description: 'Notify when new tutors apply', category: 'email', enabled: true },
  { id: '2', title: 'Booking Alerts', description: 'Alerts for new bookings', category: 'email', enabled: true },
  { id: '3', title: 'Payment Notifications', description: 'Payment confirmations and issues', category: 'email', enabled: true },
  { id: '4', title: 'User Reports', description: 'Reports from users about issues', category: 'email', enabled: true },
  { id: '5', title: 'Daily Summary', description: 'Daily summary of platform activity', category: 'email', enabled: false },
  { id: '6', title: 'Weekly Reports', description: 'Weekly analytics report', category: 'email', enabled: true },
  { id: '7', title: 'Critical Alerts', description: 'System errors and critical issues', category: 'push', enabled: true },
  { id: '8', title: 'Support Requests', description: 'New support ticket notifications', category: 'push', enabled: true },
];

export default function AdminNotificationsSettingsScreen() {
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { width } = useWindowDimensions();
  const [settings, setSettings] = useState<NotificationSetting[]>(DEFAULT_SETTINGS);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;

  const styles = getStyles(colors);

  const toggleSetting = (id: string) => {
    setSettings(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      showInfo(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const saveSettings = () => {
    showSuccess('Notification settings saved!');
  };

  const emailSettings = settings.filter(s => s.category === 'email');
  const pushSettings = settings.filter(s => s.category === 'push');

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title="Notifications" />
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Notification Settings</Text>
            <Text style={styles.subtitle}>Configure admin notification preferences</Text>
          </View>

          {/* Email Notifications */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="mail" size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>Email Notifications</Text>
            </View>
            {emailSettings.map(setting => (
              <View key={setting.id} style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{setting.title}</Text>
                  <Text style={styles.settingDescription}>{setting.description}</Text>
                </View>
                <Switch
                  value={setting.enabled}
                  onValueChange={() => toggleSetting(setting.id)}
                  trackColor={{ false: colors.gray300, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>

          {/* Push Notifications */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications" size={20} color={colors.accent} />
              <Text style={styles.sectionTitle}>Push Notifications</Text>
            </View>
            {pushSettings.map(setting => (
              <View key={setting.id} style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{setting.title}</Text>
                  <Text style={styles.settingDescription}>{setting.description}</Text>
                </View>
                <Switch
                  value={setting.enabled}
                  onValueChange={() => toggleSetting(setting.id)}
                  trackColor={{ false: colors.gray300, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>

          {/* Save Button */}
          <TouchableOpacity style={[styles.saveButton, isTablet && styles.saveButtonTablet]} onPress={saveSettings}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  scrollContentTablet: { padding: 32 },
  contentWrapper: { flex: 1 },
  header: { marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  titleDesktop: { fontSize: 28 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionTablet: { borderRadius: 20 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  settingDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonTablet: { padding: 18, borderRadius: 14 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
