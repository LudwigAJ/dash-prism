/**
 * Tab Style Variants
 *
 * Predefined visual styles for tabs that work with both light and dark themes.
 * Each style has theme-specific CSS classes for proper contrast.
 *
 * Colors are defined in global.css as --tab-* CSS variables.
 */

export const TAB_STYLE_VARIANTS = {
  default: {
    label: 'Default',
    light: '',
    dark: '',
  },
  red: {
    label: 'Red',
    light: 'bg-tab-red/20 border-tab-red/40 data-[state=active]:bg-tab-red/30',
    dark: 'bg-tab-red/15 border-tab-red/35 data-[state=active]:bg-tab-red/25',
  },
  orange: {
    label: 'Orange',
    light: 'bg-tab-orange/20 border-tab-orange/40 data-[state=active]:bg-tab-orange/30',
    dark: 'bg-tab-orange/15 border-tab-orange/35 data-[state=active]:bg-tab-orange/25',
  },
  yellow: {
    label: 'Yellow',
    light: 'bg-tab-yellow/20 border-tab-yellow/40 data-[state=active]:bg-tab-yellow/30',
    dark: 'bg-tab-yellow/15 border-tab-yellow/35 data-[state=active]:bg-tab-yellow/25',
  },
  green: {
    label: 'Green',
    light: 'bg-tab-green/20 border-tab-green/40 data-[state=active]:bg-tab-green/30',
    dark: 'bg-tab-green/15 border-tab-green/35 data-[state=active]:bg-tab-green/25',
  },
  blue: {
    label: 'Blue',
    light: 'bg-tab-blue/20 border-tab-blue/40 data-[state=active]:bg-tab-blue/30',
    dark: 'bg-tab-blue/15 border-tab-blue/35 data-[state=active]:bg-tab-blue/25',
  },
  purple: {
    label: 'Purple',
    light: 'bg-tab-purple/20 border-tab-purple/40 data-[state=active]:bg-tab-purple/30',
    dark: 'bg-tab-purple/15 border-tab-purple/35 data-[state=active]:bg-tab-purple/25',
  },
  pink: {
    label: 'Pink',
    light: 'bg-tab-pink/20 border-tab-pink/40 data-[state=active]:bg-tab-pink/30',
    dark: 'bg-tab-pink/15 border-tab-pink/35 data-[state=active]:bg-tab-pink/25',
  },
} as const;

export type TabStyleVariant = keyof typeof TAB_STYLE_VARIANTS;

/**
 * Migration map from old Catppuccin color names to new semantic colors.
 * Used when loading tabs from storage that may have old style names.
 */
export const TAB_STYLE_MIGRATION_MAP: Record<string, TabStyleVariant> = {
  // Direct mappings (colors that exist in both systems)
  red: 'red',
  yellow: 'yellow',
  green: 'green',
  blue: 'blue',
  pink: 'pink',

  // Warm colors -> closest match
  rosewater: 'pink',
  flamingo: 'pink',
  maroon: 'red',
  peach: 'orange',

  // Cool colors -> closest match
  mauve: 'purple',
  lavender: 'purple',
  teal: 'green',
  sky: 'blue',
  sapphire: 'blue',
};

/**
 * Migrate a tab style from old Catppuccin names to new semantic colors.
 * Returns 'default' for unknown styles, undefined, or 'default'.
 */
export function migrateTabStyle(style: string | undefined): TabStyleVariant {
  if (!style || style === 'default') {
    return 'default';
  }

  // Already a valid new style
  if (style in TAB_STYLE_VARIANTS) {
    return style as TabStyleVariant;
  }

  // Try migration map
  const migrated = TAB_STYLE_MIGRATION_MAP[style];
  if (migrated) {
    return migrated;
  }

  // Unknown style, fall back to default
  return 'default';
}

/**
 * Get the CSS classes for a tab style based on the current theme.
 * Returns empty string for default or invalid styles.
 */
export function getTabStyleClasses(style: string | undefined, theme: 'light' | 'dark'): string {
  if (!style || style === '' || style === 'default') {
    return '';
  }
  const variant = TAB_STYLE_VARIANTS[style as TabStyleVariant];
  if (!variant) {
    return '';
  }
  return theme === 'dark' ? variant.dark : variant.light;
}
