import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/src/context/AuthContext';
import { MarketProvider } from '@/src/context/MarketContext';
import { ThemeProvider, useTheme } from '@/src/context/ThemeContext';
import { ToastProvider } from '@/src/context/ToastContext';
import { SubscriptionProvider } from '@/src/context/SubscriptionContext';
import { I18nProvider } from '@/src/i18n';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { GlobalBackground } from '@/src/components/GlobalBackground';

function AppContent() {
  const { colors, isDark } = useTheme();
  
  return (
    <GlobalBackground>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(consumer)" />
        <Stack.Screen name="(tutor)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </GlobalBackground>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <I18nProvider>
          <ThemeProvider>
            <ToastProvider>
              <AuthProvider>
                <SubscriptionProvider>
                  <MarketProvider>
                    <AppContent />
                  </MarketProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
