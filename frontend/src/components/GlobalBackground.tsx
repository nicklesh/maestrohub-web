import React from 'react';
import { View, Image, Platform, StyleSheet } from 'react-native';
import { useTheme } from '@/src/context/ThemeContext';

interface GlobalBackgroundProps {
  children: React.ReactNode;
}

/**
 * GlobalBackground - Provides a consistent blurred background image across all screens
 * This component wraps the entire app content and adds a subtle blurred background
 */
export function GlobalBackground({ children }: GlobalBackgroundProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Blurred Background Image */}
      <Image
        source={require('../../assets/images/login_background.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
        blurRadius={Platform.OS === 'ios' ? 25 : 15}
      />
      {/* Semi-transparent overlay for better readability */}
      <View style={[styles.backgroundOverlay, { backgroundColor: colors.background }]} />
      {/* Main content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  backgroundOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  content: {
    flex: 1,
  },
});

export default GlobalBackground;
