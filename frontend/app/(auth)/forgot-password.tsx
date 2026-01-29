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
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useTranslation } from '@/src/i18n';
import { api } from '@/src/services/api';
import { useToast } from '@/src/context/ToastContext';

export default function ForgotPasswordScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { width } = useWindowDimensions();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const formMaxWidth = isDesktop ? 440 : isTablet ? 400 : undefined;

  // Logo sizes
  const logoWidth = isDesktop ? 340 : isTablet ? 310 : Math.min(width - 32, 220);
  const logoHeight = isDesktop ? 136 : isTablet ? 124 : 100;

  const handleSubmit = async () => {
    if (!email.trim()) {
      showError(t('auth.forgot_password.enter_email'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setEmailSent(true);
      showSuccess(t('auth.forgot_password.email_sent'));
    } catch (error: any) {
      // We don't reveal if email exists or not for security
      setEmailSent(true);
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(colors);

  if (emailSent) {
    return (
      <View style={styles.container}>
        {/* Blurred Background Image */}
        <Image
          source={require('../../assets/images/login_background.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
          blurRadius={Platform.OS === 'ios' ? 20 : 10}
        />
        <View style={[styles.backgroundOverlay, { backgroundColor: colors.background }]} />
        
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.successContent}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="mail" size={64} color={colors.primary} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>
              {t('auth.forgot_password.check_email')}
            </Text>
            <Text style={[styles.successSubtitle, { color: colors.textMuted }]}>
              {t('auth.forgot_password.check_email_message')}
            </Text>
            <Text style={[styles.emailText, { color: colors.text }]}>
              {email}
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.primaryButtonText}>{t('auth.forgot_password.back_to_login')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => setEmailSent(false)}
            >
              <Text style={[styles.linkText, { color: colors.primary }]}>
                {t('auth.forgot_password.try_different_email')}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Blurred Background Image */}
      <Image
        source={require('../../assets/images/login_background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={Platform.OS === 'ios' ? 20 : 10}
      />
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
              {/* Back Button */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>

              {/* Logo Header */}
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

              {/* Form */}
              <View style={[styles.form, isTablet && styles.formTablet]}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20', alignSelf: 'center' }]}>
                  <Ionicons name="lock-closed" size={48} color={colors.primary} />
                </View>
                <Text style={[styles.title, isDesktop && styles.titleDesktop]}>
                  {t('auth.forgot_password.title')}
                </Text>
                <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>
                  {t('auth.forgot_password.subtitle')}
                </Text>

                <View style={[styles.inputContainer, isTablet && styles.inputContainerTablet]}>
                  <Ionicons name="mail-outline" size={20} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, isTablet && styles.inputTablet]}
                    placeholder={t('auth.forgot_password.email_placeholder')}
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    isTablet && styles.primaryButtonTablet,
                    loading && { opacity: 0.7 },
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.primaryButtonText, isTablet && styles.primaryButtonTextTablet]}>
                      {t('auth.forgot_password.send_reset_link')}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={[styles.linkText, { color: colors.primary }]}>
                    {t('auth.forgot_password.remember_password')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    backButton: {
      marginBottom: 16,
    },
    header: {
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 24,
    },
    headerDesktop: {
      marginTop: 0,
      marginBottom: 32,
    },
    appTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.primary,
      marginTop: 8,
    },
    appTitleDesktop: {
      fontSize: 36,
    },
    tagline: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
      fontStyle: 'italic',
    },
    taglineDesktop: {
      fontSize: 16,
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
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    titleDesktop: {
      fontSize: 28,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 16,
    },
    subtitleDesktop: {
      fontSize: 16,
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
    linkButton: {
      marginTop: 16,
      alignItems: 'center',
    },
    linkText: {
      fontSize: 14,
      fontWeight: '500',
    },
    // Success screen styles
    successContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
    },
    successSubtitle: {
      fontSize: 16,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    emailText: {
      fontSize: 16,
      fontWeight: '600',
      marginTop: 8,
      marginBottom: 24,
    },
  });
