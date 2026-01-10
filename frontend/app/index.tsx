import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';

export default function Index() {
  const { user, loading } = useAuth();
  const { colors, loadUserTheme, isDark } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const logoWidth = isDesktop ? 300 : isTablet ? 260 : 220;
  const logoHeight = isDesktop ? 200 : isTablet ? 175 : 150;

  const styles = getStyles(colors);

  // Load user's theme preference when user is available
  useEffect(() => {
    if (user?.user_id) {
      loadUserTheme(user.user_id);
    }
  }, [user?.user_id]);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/(auth)/login');
      } else {
        // Route based on role
        switch (user.role) {
          case 'admin':
            router.replace('/(admin)/dashboard');
            break;
          case 'tutor':
            router.replace('/(tutor)/dashboard');
            break;
          default:
            router.replace('/(consumer)/home');
        }
      }
    }
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/mh_logo_trimmed.png')}
        style={{ width: logoWidth, height: logoHeight }}
        resizeMode="contain"
      />
      <Text style={[styles.logo, isDesktop && styles.logoDesktop]}>Maestro Hub</Text>
      <Text style={[styles.tagline, isDesktop && styles.taglineDesktop]}>Find your coach, master your skill</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  logoDesktop: {
    fontSize: 44,
  },
  tagline: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 32,
    fontStyle: 'italic',
  },
  taglineDesktop: {
    fontSize: 18,
  },
  loader: {
    marginTop: 24,
  },
});
