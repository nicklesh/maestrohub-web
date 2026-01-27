import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { useTranslation } from '@/src/i18n';
import { api } from '@/src/services/api';
import { useToast } from '@/src/context/ToastContext';

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showSuccess, showError } = useToast();

  const code = params.code as string;
  const token = params.token as string;

  const [status, setStatus] = useState<'validating' | 'form' | 'success' | 'error'>('validating');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    validateToken();
  }, [code, token]);

  const validateToken = async () => {
    if (!code || !token) {
      setStatus('error');
      setErrorMessage(t('auth.reset_password.invalid_link'));
      return;
    }

    try {
      const response = await api.post('/auth/validate-reset-token', { code, token });
      if (response.data.valid) {
        setEmail(response.data.email);
        setStatus('form');
      }
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.response?.data?.detail || t('auth.reset_password.invalid_link'));
    }
  };

  const handleSubmit = async () => {
    if (!newPassword.trim()) {
      showError(t('auth.reset_password.enter_password'));
      return;
    }

    if (newPassword !== confirmPassword) {
      showError(t('auth.reset_password.passwords_mismatch'));
      return;
    }

    if (newPassword.length < 8) {
      showError(t('auth.reset_password.password_too_short'));
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/reset-password', {
        code,
        token,
        new_password: newPassword,
      });

      if (response.data.success) {
        setStatus('success');
        showSuccess(t('auth.reset_password.success'));
      }
    } catch (error: any) {
      showError(error.response?.data?.detail || t('auth.reset_password.failed'));
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(colors);

  if (status === 'validating') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>
            {t('auth.reset_password.validating')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <View style={[styles.iconContainer, { backgroundColor: colors.error + '20' }]}>
            <Ionicons name="close-circle" size={64} color={colors.error} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('auth.reset_password.error_title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)/forgot-password')}
          >
            <Text style={styles.buttonText}>{t('auth.reset_password.request_new_link')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'success') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('auth.reset_password.success_title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('auth.reset_password.success_message')}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.buttonText}>{t('auth.reset_password.go_to_login')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="key" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('auth.reset_password.title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('auth.reset_password.subtitle')}
            </Text>
            <Text style={[styles.emailText, { color: colors.text }]}>
              {email}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t('auth.reset_password.new_password')}
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder={t('auth.reset_password.new_password_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.text }]}>
                {t('auth.reset_password.confirm_password')}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={t('auth.reset_password.confirm_password_placeholder')}
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
            </View>

            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t('auth.reset_password.password_requirements')}
            </Text>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                loading && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {t('auth.reset_password.reset_button')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: 24,
    },
    centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
      marginTop: 24,
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    emailText: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
    },
    form: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
    },
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
    },
    input: {
      height: 50,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 16,
      fontSize: 16,
    },
    passwordContainer: {
      position: 'relative',
    },
    passwordInput: {
      height: 50,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingRight: 50,
      fontSize: 16,
    },
    eyeButton: {
      position: 'absolute',
      right: 12,
      top: 13,
    },
    hint: {
      fontSize: 12,
      marginBottom: 24,
    },
    submitButton: {
      height: 50,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
    },
    submitButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    button: {
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 8,
      marginTop: 16,
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
