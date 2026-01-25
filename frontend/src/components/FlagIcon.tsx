import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

// Country flag URLs from flagcdn.com (free CDN for country flags)
const FLAG_URLS: Record<string, string> = {
  US: 'https://flagcdn.com/w40/us.png',
  IN: 'https://flagcdn.com/w40/in.png',
  GB: 'https://flagcdn.com/w40/gb.png',
  CA: 'https://flagcdn.com/w40/ca.png',
  AU: 'https://flagcdn.com/w40/au.png',
  DE: 'https://flagcdn.com/w40/de.png',
  FR: 'https://flagcdn.com/w40/fr.png',
  JP: 'https://flagcdn.com/w40/jp.png',
  CN: 'https://flagcdn.com/w40/cn.png',
  BR: 'https://flagcdn.com/w40/br.png',
  MX: 'https://flagcdn.com/w40/mx.png',
  SG: 'https://flagcdn.com/w40/sg.png',
  AE: 'https://flagcdn.com/w40/ae.png',
  NL: 'https://flagcdn.com/w40/nl.png',
  SE: 'https://flagcdn.com/w40/se.png',
};

// Fallback emoji flags
const FLAG_EMOJIS: Record<string, string> = {
  US: '🇺🇸',
  IN: '🇮🇳',
  GB: '🇬🇧',
  CA: '🇨🇦',
  AU: '🇦🇺',
  DE: '🇩🇪',
  FR: '🇫🇷',
  JP: '🇯🇵',
  CN: '🇨🇳',
  BR: '🇧🇷',
  MX: '🇲🇽',
  SG: '🇸🇬',
  AE: '🇦🇪',
  NL: '🇳🇱',
  SE: '🇸🇪',
};

interface FlagIconProps {
  countryCode: string;
  size?: number;
  style?: object;
}

export default function FlagIcon({ countryCode, size = 20, style }: FlagIconProps) {
  const code = countryCode?.toUpperCase() || 'US';
  const flagUrl = FLAG_URLS[code];
  const flagEmoji = FLAG_EMOJIS[code] || '🌐';
  
  // Use image-based flag for better cross-platform support
  if (flagUrl) {
    return (
      <Image
        source={{ uri: flagUrl }}
        style={[
          styles.flagImage,
          { width: size * 1.5, height: size, borderRadius: 2 },
          style,
        ]}
        resizeMode="cover"
      />
    );
  }
  
  // Fallback to emoji
  return (
    <Text style={[styles.flagEmoji, { fontSize: size }, style]}>
      {flagEmoji}
    </Text>
  );
}

const styles = StyleSheet.create({
  flagImage: {
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  flagEmoji: {
    lineHeight: 24,
  },
});
