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
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      showError('Name cannot be empty');
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
      showSuccess('Profile updated successfully');
    } catch (error: any) {
      showInfo(error.response?.data?.detail || 'Failed to update profile', 'Error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      showError('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters');
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

      showSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      showInfo(error.response?.data?.detail || 'Failed to change password', 'Error');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title="Edit Profile" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
          {/* Profile Info Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile Information</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled, { backgroundColor: colors.gray100, color: colors.textMuted, borderColor: colors.border }]}
              value={user?.email}
              editable={false}
            />
            <Text style={[styles.helperText, { color: colors.textMuted }]}>Email cannot be changed</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="+1 (555) 000-0000"
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
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Change Password Section */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Change Password</Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Current Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter current password"
              placeholderTextColor={colors.textMuted}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>New Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Enter new password"
              placeholderTextColor={colors.textMuted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Confirm New Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Confirm new password"
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
                <Text style={styles.saveButtonText}>Change Password</Text>
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
