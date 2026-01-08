import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { colors } from '../src/theme/colors';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

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
      <Text style={styles.logo}>Acharyaly</Text>
      <Text style={styles.tagline}>The easiest way to book a tutor.</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 32,
  },
  loader: {
    marginTop: 24,
  },
});
