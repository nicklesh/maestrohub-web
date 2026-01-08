import { Dimensions, Platform } from 'react-native';
import { useState, useEffect } from 'react';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Breakpoints
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
};

// Get current breakpoint
export const getBreakpoint = (width: number): 'mobile' | 'tablet' | 'desktop' | 'wide' => {
  if (width >= breakpoints.wide) return 'wide';
  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'mobile';
};

// Hook for responsive values
export const useResponsive = () => {
  const [dimensions, setDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  });

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({ width: window.width, height: window.height });
    });
    return () => subscription?.remove();
  }, []);

  const breakpoint = getBreakpoint(dimensions.width);
  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop' || breakpoint === 'wide';
  const isWide = breakpoint === 'wide';

  return {
    width: dimensions.width,
    height: dimensions.height,
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
  };
};

// Responsive value helper
export const responsive = <T,>(
  width: number,
  values: { mobile: T; tablet?: T; desktop?: T; wide?: T }
): T => {
  const breakpoint = getBreakpoint(width);
  
  switch (breakpoint) {
    case 'wide':
      return values.wide ?? values.desktop ?? values.tablet ?? values.mobile;
    case 'desktop':
      return values.desktop ?? values.tablet ?? values.mobile;
    case 'tablet':
      return values.tablet ?? values.mobile;
    default:
      return values.mobile;
  }
};

// Container max width based on breakpoint
export const getContainerMaxWidth = (width: number): number | undefined => {
  const breakpoint = getBreakpoint(width);
  switch (breakpoint) {
    case 'wide':
      return 1200;
    case 'desktop':
      return 960;
    case 'tablet':
      return 720;
    default:
      return undefined;
  }
};

// Grid columns based on breakpoint
export const getGridColumns = (width: number): number => {
  const breakpoint = getBreakpoint(width);
  switch (breakpoint) {
    case 'wide':
      return 4;
    case 'desktop':
      return 3;
    case 'tablet':
      return 2;
    default:
      return 1;
  }
};

// Card width for grid layout
export const getCardWidth = (width: number, gap: number = 16): number | string => {
  const columns = getGridColumns(width);
  const maxWidth = getContainerMaxWidth(width);
  const containerWidth = maxWidth ? Math.min(width, maxWidth) : width;
  const totalGap = (columns - 1) * gap;
  const padding = 40; // 20px on each side
  return (containerWidth - totalGap - padding) / columns;
};

// Spacing multiplier based on screen size
export const getSpacing = (width: number, baseSpacing: number = 8): number => {
  const breakpoint = getBreakpoint(width);
  switch (breakpoint) {
    case 'wide':
    case 'desktop':
      return baseSpacing * 1.5;
    case 'tablet':
      return baseSpacing * 1.25;
    default:
      return baseSpacing;
  }
};

// Font size scaling
export const getFontScale = (width: number): number => {
  const breakpoint = getBreakpoint(width);
  switch (breakpoint) {
    case 'wide':
    case 'desktop':
      return 1.1;
    case 'tablet':
      return 1.05;
    default:
      return 1;
  }
};

export default {
  breakpoints,
  useResponsive,
  responsive,
  getContainerMaxWidth,
  getGridColumns,
  getCardWidth,
  getSpacing,
  getFontScale,
};
