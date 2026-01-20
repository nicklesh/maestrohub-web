import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';

export default function AdminSecurityScreen() {
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [ipWhitelist, setIpWhitelist] = useState(false);
  const [auditLogs, setAuditLogs] = useState(true);
  const [passwordExpiry, setPasswordExpiry] = useState('90');

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;

  const styles = getStyles(colors);

  const saveSettings = () => {
    showSuccess(t('pages.admin.security.settings_saved'));
  };

  const recentActivity = [
    { id: '1', action: t('pages.admin.security.activity.admin_login'), user: 'admin@maestrohabitat.com', time: '2 mins ago', ip: '192.168.1.1' },
    { id: '2', action: t('pages.admin.security.activity.tutor_approved'), user: 'admin@maestrohabitat.com', time: '15 mins ago', ip: '192.168.1.1' },
    { id: '3', action: t('pages.admin.security.activity.settings_changed'), user: 'admin@maestrohabitat.com', time: '1 hour ago', ip: '192.168.1.1' },
    { id: '4', action: t('pages.admin.security.activity.admin_login'), user: 'admin@maestrohabitat.com', time: '3 hours ago', ip: '192.168.1.2' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title={t('pages.admin.security.title')} />
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>{t('pages.admin.security.title')}</Text>
            <Text style={styles.subtitle}>{t('pages.admin.security.subtitle')}</Text>
          </View>

          {/* Security Status */}
          <View style={[styles.statusCard, isTablet && styles.statusCardTablet]}>
            <View style={styles.statusIcon}>
              <Ionicons name="shield-checkmark" size={32} color={colors.success} />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>{t('pages.admin.security.status_strong')}</Text>
              <Text style={styles.statusSubtitle}>{t('pages.admin.security.all_active')}</Text>
            </View>
          </View>

          {/* Authentication Settings */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={styles.sectionTitle}>{t('pages.admin.security.authentication')}</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('pages.admin.security.two_factor')}</Text>
                <Text style={styles.settingDescription}>{t('pages.admin.security.two_factor_desc')}</Text>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={setTwoFactorEnabled}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('pages.admin.security.session_timeout')}</Text>
                <Text style={styles.settingDescription}>{t('pages.admin.security.session_timeout_desc')}</Text>
              </View>
              <TextInput
                style={styles.timeoutInput}
                value={sessionTimeout}
                onChangeText={setSessionTimeout}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('pages.admin.security.password_expiry')}</Text>
                <Text style={styles.settingDescription}>{t('pages.admin.security.password_expiry_desc')}</Text>
              </View>
              <TextInput
                style={styles.timeoutInput}
                value={passwordExpiry}
                onChangeText={setPasswordExpiry}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Access Control */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={styles.sectionTitle}>{t('pages.admin.security.access_control')}</Text>
            
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('pages.admin.security.ip_whitelist')}</Text>
                <Text style={styles.settingDescription}>{t('pages.admin.security.ip_whitelist_desc')}</Text>
              </View>
              <Switch
                value={ipWhitelist}
                onValueChange={setIpWhitelist}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>

            <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('pages.admin.security.audit_logging')}</Text>
                <Text style={styles.settingDescription}>{t('pages.admin.security.audit_logging_desc')}</Text>
              </View>
              <Switch
                value={auditLogs}
                onValueChange={setAuditLogs}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </View>

          {/* Recent Activity */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={styles.sectionTitle}>{t('pages.admin.security.recent_activity')}</Text>
            {recentActivity.map((activity, index) => (
              <View key={activity.id} style={[styles.activityRow, index === recentActivity.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.activityIcon}>
                  <Ionicons name="time" size={16} color={colors.textMuted} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityAction}>{activity.action}</Text>
                  <Text style={styles.activityMeta}>{activity.user} • {activity.time}</Text>
                </View>
                <Text style={styles.activityIp}>{activity.ip}</Text>
              </View>
            ))}
          </View>

          {/* Save Button */}
          <TouchableOpacity style={[styles.saveButton, isTablet && styles.saveButtonTablet]} onPress={saveSettings}>
            <Text style={styles.saveButtonText}>{t('pages.admin.security.save_settings')}</Text>
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
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 16,
  },
  statusCardTablet: { borderRadius: 20, padding: 24 },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 16, fontWeight: '600', color: colors.success },
  statusSubtitle: { fontSize: 13, color: colors.text, marginTop: 2 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTablet: { borderRadius: 20, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 16 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  settingDescription: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  timeoutInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    minWidth: 60,
    textAlign: 'center',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: { flex: 1 },
  activityAction: { fontSize: 14, fontWeight: '500', color: colors.text },
  activityMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  activityIp: { fontSize: 12, color: colors.textMuted },
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
