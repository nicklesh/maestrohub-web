import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

export default function EditProfileScreen() {
  const { user, token, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      showError(t('pages.edit_profile.name_required'));
      return;
    }

    setSavingProfile(true);
    try {
      await api.put('/profile', {
        name: name.trim(),
        phone: phone.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      await refreshUser();
      showSuccess(t('pages.edit_profile.profile_updated'));
    } catch (error: any) {
      showError(error.response?.data?.detail || t('pages.edit_profile.update_failed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showError(t('pages.edit_profile.fill_password_fields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      showError(t('pages.edit_profile.passwords_not_match'));
      return;
    }

    if (newPassword.length < 6) {
      showError(t('pages.edit_profile.password_min_length'));
      return;
    }

    setSavingPassword(true);
    try {
      await api.post('/profile/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showSuccess(t('pages.edit_profile.password_changed'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showError(error.response?.data?.detail || t('pages.edit_profile.password_change_failed'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title={t("pages.edit_profile.title")} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Profile Info Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.edit_profile.profile_info')}</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.edit_profile.name')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.edit_profile.name_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.edit_profile.email')}</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled, { backgroundColor: colors.gray100, color: colors.textMuted, borderColor: colors.border }]}
              value={user?.email}
              editable={false}
            />
            <Text style={[styles.helperText, { color: colors.textMuted }]}>{t('pages.edit_profile.email_cannot_change')}</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.edit_profile.phone')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.edit_profile.phone_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }, savingProfile && styles.buttonDisabled]}
              onPress={handleUpdateProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{t('buttons.save_changes')}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Change Password Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('pages.edit_profile.change_password')}</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.edit_profile.current_password')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.edit_profile.current_password_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.edit_profile.new_password')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.edit_profile.new_password_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.edit_profile.confirm_password')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.edit_profile.confirm_password_placeholder')}
              placeholderTextColor={colors.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }, savingPassword && styles.buttonDisabled]}
              onPress={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{t('pages.edit_profile.change_password_btn')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { padding: 16 },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
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
  inputDisabled: {
    opacity: 0.6,
  },
  helperText: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  saveButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
