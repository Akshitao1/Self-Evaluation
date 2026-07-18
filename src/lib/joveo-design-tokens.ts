/**
 * Joveo Dashboard Design Tokens
 * Centralized design system for consistent chart styling
 */

// ==================== COLOR PALETTE ====================

/**
 * Joveo Brand Colors (Hardcoded for consistency)
 */
export const JOVEO_COLORS = {
  // Primary Colors
  primary: '#303F9F',
  primaryLight: '#7681E8', 
  primaryDark: '#1C2536',
  
  // Secondary Colors
  secondary: '#7681E8',
  secondaryLight: '#A5B4FC',
  secondaryDark: '#4F46E5',
  
  // Status Colors
  success: '#43A047',
  successLight: '#81C784',
  successDark: '#2E7D32',
  
  warning: '#FFAB00',
  warningLight: '#FFD54F',
  warningDark: '#F57C00',
  
  error: '#FF5252',
  errorLight: '#FF8A80',
  errorDark: '#D32F2F',
  
  // Neutral Colors
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Text Colors
  textPrimary: '#3D4759',
  textSecondary: '#718096',
  textTertiary: '#A0AEC0',
  
  // Background Colors
  backgroundPrimary: '#FFFFFF',
  backgroundSecondary: '#F7FAFC',
  backgroundTertiary: '#EDF2F7',
  
  // Border Colors
  border: '#E2E6F1',
  borderLight: 'rgba(255, 255, 255, 0.1)',
  
  // Chart-specific colors
  chartBackground: '#FFFFFF',
  chartGrid: '#E2E6F1',
  chartTooltipBg: '#1C2536',
  chartTooltipText: '#FFFFFF'
} as const;

/**
 * Chart Color Palettes
 */
export const CHART_COLOR_PALETTES = {
  // Default palette for most charts
  default: [
    JOVEO_COLORS.primary,      // #303F9F
    JOVEO_COLORS.secondary,    // #7681E8  
    JOVEO_COLORS.success,      // #43A047
    JOVEO_COLORS.warning,      // #FFAB00
    JOVEO_COLORS.error,        // #FF5252
    '#7C4DFF',                 // Purple
    '#00ACC1',                 // Cyan
    '#8BC34A',                 // Light Green
  ],
  
  // Performance-focused palette (spend, revenue, etc.)
  performance: [
    JOVEO_COLORS.primary,      // Main metric
    JOVEO_COLORS.success,      // Positive performance  
    JOVEO_COLORS.warning,      // Warning/caution
    JOVEO_COLORS.error,        // Negative performance
    JOVEO_COLORS.secondary,    // Secondary metric
  ],
  
  // Channel-focused palette (different marketing channels)
  channels: [
    '#303F9F', // Search
    '#7681E8', // Social
    '#43A047', // Display
    '#FFAB00', // Video
    '#FF5252', // Email
    '#7C4DFF', // Referral
    '#00ACC1', // Direct
    '#8BC34A', // Other
  ],
  
  // Status-focused palette (active, inactive, pending, etc.)
  status: [
    JOVEO_COLORS.success,      // Active/Good
    JOVEO_COLORS.warning,      // Pending/Caution
    JOVEO_COLORS.error,        // Inactive/Bad
    JOVEO_COLORS.gray500,      // Neutral/Unknown
  ],
  
  // Monochromatic blue palette
  monochrome: [
    '#303F9F',
    '#4A5AAF', 
    '#6575BF',
    '#7F90CF',
    '#99ABDF',
    '#B3C6EF',
    '#CCE1FF'
  ]
} as const;

// ==================== TYPOGRAPHY ====================

/**
 * Typography tokens aligned with Joveo design system
 */
export const TYPOGRAPHY = {
  fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  
  // Font sizes (in pixels)
  fontSize: {
    xs: 11,
    sm: 12, 
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24
  },
  
  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  
  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75
  }
} as const;

// ==================== SPACING & SIZING ====================

/**
 * Spacing tokens (in pixels)
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48
} as const;

/**
 * Chart-specific dimensions
 */
export const CHART_DIMENSIONS = {
  // Default heights for different chart types
  heights: {
    compact: 200,
    default: 300,
    large: 400,
    fullHeight: 500
  },
  
  // Margins and padding
  margins: {
    default: { top: 20, right: 30, bottom: 20, left: 20 },
    withLegend: { top: 40, right: 30, bottom: 20, left: 20 },
    compact: { top: 10, right: 15, bottom: 10, left: 15 }
  },
  
  // Bar and line dimensions
  barSize: {
    default: 40,
    compact: 24,
    large: 60
  },
  
  strokeWidth: {
    thin: 1,
    default: 2,
    thick: 3
  }
} as const;

// ==================== ANIMATION ====================

/**
 * Animation tokens for smooth transitions
 */
export const ANIMATIONS = {
  duration: {
    fast: 150,
    default: 300,
    slow: 500
  },
  
  easing: {
    default: 'ease-in-out',
    bouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get color palette by name
 */
export function getColorPalette(palette: keyof typeof CHART_COLOR_PALETTES = 'default'): string[] {
  return [...CHART_COLOR_PALETTES[palette]];
}

/**
 * Get color by index from a palette
 */
export function getColorByIndex(
  index: number, 
  palette: keyof typeof CHART_COLOR_PALETTES = 'default'
): string {
  const colors = getColorPalette(palette);
  return colors[index % colors.length];
}

/**
 * Generate chart theme configuration
 */
export function getChartTheme(variant: 'default' | 'compact' | 'large' = 'default') {
  const height = CHART_DIMENSIONS.heights[variant] || CHART_DIMENSIONS.heights.default;
  const margins = variant === 'compact' 
    ? CHART_DIMENSIONS.margins.compact 
    : CHART_DIMENSIONS.margins.default;
  
  return {
    colors: getColorPalette('default'),
    height,
    margins,
    typography: TYPOGRAPHY,
    spacing: SPACING,
    animations: ANIMATIONS
  };
}

/**
 * Chart container styles
 */
export const CHART_STYLES = {
  container: {
    backgroundColor: JOVEO_COLORS.chartBackground,
    border: `1px solid ${JOVEO_COLORS.border}`,
    borderRadius: '4px',
    padding: `${SPACING.lg}px`,
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
  },
  
  title: {
    color: JOVEO_COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: SPACING.md
  },
  
  subtitle: {
    color: JOVEO_COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontWeight: TYPOGRAPHY.fontWeight.normal,
    fontFamily: TYPOGRAPHY.fontFamily,
    marginBottom: SPACING.lg
  }
} as const;

// ==================== EXPORT TYPES ====================

export type JoveoColorKey = keyof typeof JOVEO_COLORS;
export type ChartColorPalette = keyof typeof CHART_COLOR_PALETTES;
export type ChartVariant = 'default' | 'compact' | 'large';
