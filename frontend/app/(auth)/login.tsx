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
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const { login, loginWithGoogle } = useAuth();
  const { colors, isDark } = useTheme();
  const { showError } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const formMaxWidth = isDesktop ? 440 : isTablet ? 400 : undefined;

  // Logo sizes - reduced by 15% and add title
  const logoWidth = isDesktop ? 510 : isTablet ? 467 : Math.min(width - 32, 306);
  const logoHeight = isDesktop ? 204 : isTablet ? 187 : 170;

  const styles = getStyles(colors);

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email || !password) {
      setErrorMessage(t('forms.validation.fill_all_fields'));
      return;
    }
    
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (error: any) {
      const message = error.response?.data?.detail || t('messages.errors.invalid_credentials');
      setErrorMessage(message);
      showError(message, t('messages.errors.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMessage('');
    try {
      await loginWithGoogle();
      // On mobile, loginWithGoogle completes the full flow
      // On web, this line won't be reached because the page redirects
      if (Platform.OS !== 'web') {
        router.replace('/');
      }
    } catch (error: any) {
      // Only show error if we're still on the page (not redirected)
      // On web, this catch might fire due to navigation, so we check if we're still here
      if (Platform.OS === 'web') {
        // On web, if there's no session_id in URL, it means there was an actual error
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        if (!hash.includes('session_id')) {
          const message = t('messages.errors.google_login_failed');
          setErrorMessage(message);
          showError(message);
        }
      } else {
        const message = t('messages.errors.google_login_failed');
        setErrorMessage(message);
        showError(message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Blurred Background Image */}
      <Image
        source={require('../../assets/images/login_background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={Platform.OS === 'ios' ? 20 : 10}
      />
      {/* Overlay for better readability */}
      <View style={[styles.backgroundOverlay, { backgroundColor: colors.background }]} />
      
      <SafeAreaView style={styles.safeArea}>
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
                <Image
                  source={isDark 
                    ? require('../../assets/images/mh_logo_dark_trimmed.png')
                    : require('../../assets/images/mh_logo_trimmed.png')
                  }
                  style={{ width: logoWidth, height: logoHeight }}
                  resizeMode="contain"
                />
                <Text style={[styles.appTitle, isDesktop && styles.appTitleDesktop]}>
                  {t('branding.app_name')}
                </Text>
                <Text style={[styles.tagline, isDesktop && styles.taglineDesktop]}>
                  {t('branding.tagline')}
                </Text>
              </View>

              <View style={[styles.form, isTablet && styles.formTablet]}>
                <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
                  {t('pages.login.title')}
                </Text>
                <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
                  {t('pages.login.subtitle')}
                </Text>

              {/* Error Message */}
              {errorMessage ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={18} color={colors.error} />
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

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

              <TouchableOpacity
                style={[styles.primaryButton, isTablet && styles.primaryButtonTablet]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>
                    {t('buttons.sign_in')}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.forgotPasswordLink}
                onPress={() => router.push('/(auth)/forgot-password')}
              >
                <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
                  {t('pages.login.forgot_password')}
                </Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('pages.login.or_continue_with')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.googleButton, isTablet && styles.googleButtonTablet]}
                onPress={handleGoogleLogin}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color={colors.text} />
                    <Text style={[styles.googleButtonText, isTablet && styles.googleButtonTextTablet]}>
                      {t('pages.login.continue_with_google')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('pages.login.no_account')} </Text>
                <Link href="/(auth)/register" asChild>
                  <TouchableOpacity>
                    <Text style={styles.footerLink}>{t('pages.login.sign_up_link')}</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  backgroundOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  safeArea: {
    flex: 1,
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
    marginTop: 40,
    marginBottom: 40,
  },
  headerDesktop: {
    marginTop: 0,
    marginBottom: 48,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 8,
  },
  appTitleDesktop: {
    fontSize: 40,
  },
  tagline: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  taglineDesktop: {
    fontSize: 17,
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
    marginBottom: 32,
  },
  subtitleDesktop: {
    fontSize: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    flex: 1,
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
  forgotPasswordLink: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginTop: 32,
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
});
