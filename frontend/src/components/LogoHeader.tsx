import React from 'react';
import { View, Image, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { colors } from '@/src/theme/colors';

interface LogoHeaderProps {
  showTagline?: boolean;
  size?: 'small' | 'medium' | 'large';
  alignment?: 'left' | 'center';
}

export default function LogoHeader({ 
  showTagline = true, 
  size = 'medium',
  alignment = 'center' 
}: LogoHeaderProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          logoWidth: isDesktop ? 140 : isTablet ? 120 : 100,
          logoHeight: isDesktop ? 56 : isTablet ? 48 : 40,
          taglineFontSize: isDesktop ? 13 : 12,
        };
      case 'large':
        return {
          logoWidth: isDesktop ? 220 : isTablet ? 200 : 180,
          logoHeight: isDesktop ? 88 : isTablet ? 80 : 72,
          taglineFontSize: isDesktop ? 16 : isTablet ? 15 : 14,
        };
      case 'medium':
      default:
        return {
          logoWidth: isDesktop ? 180 : isTablet ? 160 : 140,
          logoHeight: isDesktop ? 72 : isTablet ? 64 : 56,
          taglineFontSize: isDesktop ? 15 : isTablet ? 14 : 13,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <View style={[styles.container, alignment === 'left' ? styles.alignLeft : styles.alignCenter]}>
      <Image
        source={require('../../assets/images/mh_logo.png')}
        style={{
          width: sizeStyles.logoWidth,
          height: sizeStyles.logoHeight,
        }}
        resizeMode="contain"
      />
      {showTagline && (
        <Text style={[styles.tagline, { fontSize: sizeStyles.taglineFontSize }]}>
          Find your coach, master your skill
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  alignCenter: {
    alignItems: 'center',
  },
  alignLeft: {
    alignItems: 'flex-start',
  },
  tagline: {
    color: colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
