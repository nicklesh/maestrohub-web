import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/context/ThemeContext';
import { useTranslation } from '@/src/i18n';
import { api } from '@/src/services/api';
import { useAuth } from '@/src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { saveAuth } = useAuth();
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  
  const code = params.code as string;
  const token = params.token as string;

  useEffect(() => {
    verifyEmail();
  }, [code, token]);

  const verifyEmail = async () => {
    if (!code || !token) {
      setStatus('error');
      setErrorMessage(t('auth.verify_email.invalid_link'));
      return;
    }

    try {
      const response = await api.post('/auth/verify-email', {
        code,
        token,
      });

      if (response.data.success) {
        // Save auth token
        if (response.data.token) {
          await AsyncStorage.setItem('token', response.data.token);
          api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
          if (Platform.OS === 'web') {
            localStorage.setItem('auth_token', response.data.token);
          }
        }
        setStatus('success');
        
        // Redirect after a short delay
        setTimeout(() => {
          router.replace('/');
        }, 2000);
      }
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.response?.data?.detail || t('auth.verify_email.verification_failed'));
    }
  };

  const styles = getStyles(colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {status === 'verifying' && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.title, { color: colors.text }]}>
              {t('auth.verify_email.verifying')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('auth.verify_email.please_wait')}
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={[styles.iconContainer, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('auth.verify_email.success_title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('auth.verify_email.success_message')}
            </Text>
            <Text style={[styles.redirectText, { color: colors.textMuted }]}>
              {t('auth.verify_email.redirecting')}
            </Text>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={[styles.iconContainer, { backgroundColor: colors.error + '20' }]}>
              <Ionicons name="close-circle" size={64} color={colors.error} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('auth.verify_email.error_title')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {errorMessage}
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.buttonText}>{t('auth.verify_email.back_to_login')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    iconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 32,
    },
    redirectText: {
      fontSize: 14,
      fontStyle: 'italic',
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
