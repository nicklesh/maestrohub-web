import React, { useState } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import LogoHeader from '@/src/components/LogoHeader';
import { api } from '@/src/services/api';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'consumer' | 'tutor'>('consumer');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const formMaxWidth = isDesktop ? 480 : isTablet ? 440 : undefined;

  const styles = getStyles(colors);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      showError(t('forms.validation.fill_all_fields'));
      return;
    }
    
    if (password !== confirmPassword) {
      showError(t('forms.validation.passwords_dont_match'));
      return;
    }
    
    if (password.length < 6) {
      showError(t('forms.validation.password_min_6'));
      return;
    }
    
    setLoading(true);
    try {
      // Call registration API directly (doesn't log user in anymore)
      const response = await api.post('/auth/register', {
        email,
        password,
        name,
        role,
      });
      
      if (response.data.success) {
        setRegistrationComplete(true);
        showSuccess(t('auth.register.verification_email_sent'));
      }
    } catch (error: any) {
      showError(
        error.response?.data?.detail || t('messages.errors.could_not_create_account'),
        t('messages.errors.registration_failed')
      );
    } finally {
      setLoading(false);
    }
  };

  // Show success screen after registration
  if (registrationComplete) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successContainer}>
          <View style={[styles.successIconContainer, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="mail" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            {t('auth.register.check_email_title')}
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
            {t('auth.register.check_email_message')}
          </Text>
          <Text style={[styles.emailHighlight, { color: colors.text }]}>
            {email}
          </Text>
          <View style={[styles.infoBox, { backgroundColor: colors.warning + '20' }]}>
            <Ionicons name="time-outline" size={20} color={colors.warning} />
            <Text style={[styles.infoText, { color: colors.warning }]}>
              {t('auth.register.link_expires_24h')}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.successButton, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.successButtonText}>{t('auth.register.go_to_login')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resendLink}
            onPress={async () => {
              try {
                await api.post('/auth/resend-verification', { email });
                showSuccess(t('auth.register.verification_resent'));
              } catch (e) {
                showError(t('auth.register.resend_failed'));
              }
            }}
          >
            <Text style={[styles.resendText, { color: colors.primary }]}>
              {t('auth.register.resend_email')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.scrollContentTablet,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.formWrapper, formMaxWidth ? { maxWidth: formMaxWidth } : undefined]}>
            <View style={[styles.header, isDesktop && styles.headerDesktop]}>
              <LogoHeader size="large" showTagline={false} />
            </View>

            <View style={[styles.form, isTablet && styles.formTablet]}>
              <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
                {t('pages.register.title')}
              </Text>
              <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
                {t('pages.register.subtitle')}
              </Text>

              {/* Role Selection */}
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'consumer' && styles.roleButtonActive,
                  ]}
                  onPress={() => setRole('consumer')}
                >
                  <Ionicons
                    name="school-outline"
                    size={24}
                    color={role === 'consumer' ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      role === 'consumer' && styles.roleTextActive,
                    ]}
                  >
                    {t('pages.register.role_parent')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'tutor' && styles.roleButtonActive,
                  ]}
                  onPress={() => setRole('tutor')}
                >
                  <Ionicons
                    name="person-outline"
                    size={24}
                    color={role === 'tutor' ? colors.primary : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      role === 'tutor' && styles.roleTextActive,
                    ]}
                  >
                    {t('pages.register.role_tutor')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.inputContainer, isTablet && styles.inputContainerTablet]}>
                <Ionicons name="person-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, isTablet && styles.inputTablet]}
                  placeholder={t('forms.labels.full_name')}
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={[styles.inputContainer, isTablet && styles.inputContainerTablet]}>
                <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, isTablet && styles.inputTablet]}
                  placeholder={t('forms.labels.email_address')}
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={[styles.inputContainer, isTablet && styles.inputContainerTablet]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, isTablet && styles.inputTablet]}
                  placeholder={t('forms.labels.password')}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              <View style={[styles.inputContainer, isTablet && styles.inputContainerTablet]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, isTablet && styles.inputTablet]}
                  placeholder={t('forms.labels.confirm_password')}
                  placeholderTextColor={colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, isTablet && styles.primaryButtonTablet]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>
                    {t('pages.register.title')}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('pages.register.have_account')} </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text style={styles.footerLink}>{t('pages.register.sign_in_link')}</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  scrollContentTablet: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  formWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  headerDesktop: {
    marginTop: 0,
    marginBottom: 32,
  },
  form: {
    flex: 1,
  },
  formTablet: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  titleDesktop: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 24,
  },
  subtitleDesktop: {
    fontSize: 18,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  roleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  roleTextActive: {
    color: colors.primary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputContainerTablet: {
    backgroundColor: colors.gray100,
    borderRadius: 14,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: colors.text,
  },
  inputTablet: {
    height: 56,
    fontSize: 17,
  },
  eyeIcon: {
    padding: 4,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonTablet: {
    height: 56,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonTextTablet: {
    fontSize: 18,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  googleButtonTablet: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.gray100,
  },
  googleButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  googleButtonTextTablet: {
    fontSize: 17,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  footerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  // Success screen styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 8,
  },
  emailHighlight: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 12,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  successButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  successButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendLink: {
    padding: 8,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
