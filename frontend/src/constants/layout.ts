/**
 * Layout constants for consistent responsive design across the app
 */

// Breakpoints
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  largeDesktop: 1440,
} as const;

// Content max widths for different page types
export const CONTENT_MAX_WIDTH = {
  // For detail pages (booking details, coach details, kid details)
  detail: {
    mobile: undefined,
    tablet: 560,
    desktop: 640,
  },
  // For list pages (bookings, search results, notifications)
  list: {
    mobile: undefined,
    tablet: 720,
    desktop: 960,
  },
  // For full-width pages (home, dashboard)
  full: {
    mobile: undefined,
    tablet: undefined,
    desktop: 1200,
  },
  // For narrow/form pages
  narrow: {
    mobile: undefined,
    tablet: 480,
    desktop: 520,
  },
} as const;

// Helper function to get content max width based on screen width
export const getContentMaxWidth = (
  screenWidth: number, 
  type: keyof typeof CONTENT_MAX_WIDTH = 'list'
): number | undefined => {
  const config = CONTENT_MAX_WIDTH[type];
  if (screenWidth >= BREAKPOINTS.desktop) {
    return config.desktop;
  }
  if (screenWidth >= BREAKPOINTS.tablet) {
    return config.tablet;
  }
  return config.mobile;
};

// Standard spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Card widths for grid layouts
export const CARD_WIDTHS = {
  single: '100%',
  twoColumn: '48%',
  threeColumn: '32%',
} as const;
