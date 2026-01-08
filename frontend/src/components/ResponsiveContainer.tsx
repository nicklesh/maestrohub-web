import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useResponsive, getContainerMaxWidth } from '../utils/responsive';
import { colors } from '../theme/colors';

interface ResponsiveContainerProps {
  children: ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
  centered?: boolean;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  style,
  fullWidth = false,
  centered = true,
}) => {
  const { width } = useResponsive();
  const maxWidth = fullWidth ? undefined : getContainerMaxWidth(width);

  return (
    <View
      style={[
        styles.container,
        centered && styles.centered,
        maxWidth ? { maxWidth, width: '100%' } : undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
};

interface ResponsiveGridProps {
  children: ReactNode;
  columns?: { mobile: number; tablet?: number; desktop?: number };
  gap?: number;
  style?: ViewStyle;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 16,
  style,
}) => {
  const { width, isMobile, isTablet, isDesktop } = useResponsive();
  
  const numColumns = isDesktop
    ? columns.desktop ?? columns.tablet ?? columns.mobile
    : isTablet
    ? columns.tablet ?? columns.mobile
    : columns.mobile;

  return (
    <View style={[styles.grid, { gap }, style]}>
      {React.Children.map(children, (child, index) => (
        <View
          style={{
            width: numColumns === 1 ? '100%' : `${100 / numColumns - 2}%`,
            minWidth: numColumns === 1 ? undefined : 280,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
};

interface ResponsiveCardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  style,
}) => {
  const { isDesktop } = useResponsive();

  return (
    <View
      style={[
        styles.card,
        isDesktop && styles.cardDesktop,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  centered: {
    alignSelf: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardDesktop: {
    padding: 24,
    borderRadius: 20,
  },
});

export default ResponsiveContainer;
