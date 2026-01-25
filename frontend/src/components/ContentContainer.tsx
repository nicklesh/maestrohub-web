import React from 'react';
import { View, useWindowDimensions, StyleSheet, ViewStyle } from 'react-native';

interface ContentContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  type?: 'detail' | 'list' | 'narrow';
}

/**
 * A wrapper component that applies consistent max-width constraints
 * for responsive layouts on tablet and desktop.
 */
export default function ContentContainer({ children, style, type = 'detail' }: ContentContainerProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  
  // Max widths based on type
  const maxWidths = {
    detail: { desktop: 640, tablet: 560 },
    list: { desktop: 720, tablet: 640 },
    narrow: { desktop: 520, tablet: 480 },
  };
  
  const config = maxWidths[type];
  const contentMaxWidth = isDesktop ? config.desktop : isTablet ? config.tablet : undefined;
  
  return (
    <View style={[
      styles.container,
      contentMaxWidth ? { maxWidth: contentMaxWidth } : undefined,
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
});
