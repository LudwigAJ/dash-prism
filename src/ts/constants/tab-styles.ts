/**
 * Tab Style Variants
 *
 * Predefined visual styles for tabs that work with both light and dark themes.
 * Uses CVA compound variants for type-safe theme × color combinations.
 *
 * Colors are defined in global.css as --tab-* CSS variables.
 */

import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Labels for UI display (kept separate from styling)
 */
export const TAB_STYLE_LABELS = {
  default: 'Default',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
} as const;

/**
 * CVA definition for tab styling with theme × color compound variants
 */
export const tabStyleVariants = cva('', {
  variants: {
    color: {
      default: '',
      red: '',
      orange: '',
      yellow: '',
      green: '',
      blue: '',
      purple: '',
      pink: '',
    },
    theme: {
      light: '',
      dark: '',
    },
  },
  compoundVariants: [
    // Red
    {
      color: 'red',
      theme: 'light',
      className: 'tw:bg-tab-red/20 tw:border-tab-red/40 tw:data-[state=active]:bg-tab-red/30',
    },
    {
      color: 'red',
      theme: 'dark',
      className: 'tw:bg-tab-red/15 tw:border-tab-red/35 tw:data-[state=active]:bg-tab-red/25',
    },
    // Orange
    {
      color: 'orange',
      theme: 'light',
      className:
        'tw:bg-tab-orange/20 tw:border-tab-orange/40 tw:data-[state=active]:bg-tab-orange/30',
    },
    {
      color: 'orange',
      theme: 'dark',
      className:
        'tw:bg-tab-orange/15 tw:border-tab-orange/35 tw:data-[state=active]:bg-tab-orange/25',
    },
    // Yellow
    {
      color: 'yellow',
      theme: 'light',
      className:
        'tw:bg-tab-yellow/20 tw:border-tab-yellow/40 tw:data-[state=active]:bg-tab-yellow/30',
    },
    {
      color: 'yellow',
      theme: 'dark',
      className:
        'tw:bg-tab-yellow/15 tw:border-tab-yellow/35 tw:data-[state=active]:bg-tab-yellow/25',
    },
    // Green
    {
      color: 'green',
      theme: 'light',
      className: 'tw:bg-tab-green/20 tw:border-tab-green/40 tw:data-[state=active]:bg-tab-green/30',
    },
    {
      color: 'green',
      theme: 'dark',
      className: 'tw:bg-tab-green/15 tw:border-tab-green/35 tw:data-[state=active]:bg-tab-green/25',
    },
    // Blue
    {
      color: 'blue',
      theme: 'light',
      className: 'tw:bg-tab-blue/20 tw:border-tab-blue/40 tw:data-[state=active]:bg-tab-blue/30',
    },
    {
      color: 'blue',
      theme: 'dark',
      className: 'tw:bg-tab-blue/15 tw:border-tab-blue/35 tw:data-[state=active]:bg-tab-blue/25',
    },
    // Purple
    {
      color: 'purple',
      theme: 'light',
      className:
        'tw:bg-tab-purple/20 tw:border-tab-purple/40 tw:data-[state=active]:bg-tab-purple/30',
    },
    {
      color: 'purple',
      theme: 'dark',
      className:
        'tw:bg-tab-purple/15 tw:border-tab-purple/35 tw:data-[state=active]:bg-tab-purple/25',
    },
    // Pink
    {
      color: 'pink',
      theme: 'light',
      className: 'tw:bg-tab-pink/20 tw:border-tab-pink/40 tw:data-[state=active]:bg-tab-pink/30',
    },
    {
      color: 'pink',
      theme: 'dark',
      className: 'tw:bg-tab-pink/15 tw:border-tab-pink/35 tw:data-[state=active]:bg-tab-pink/25',
    },
  ],
  defaultVariants: {
    color: 'default',
    theme: 'light',
  },
});

type TabStyleVariantProps = VariantProps<typeof tabStyleVariants>;
export type TabStyleColor = NonNullable<TabStyleVariantProps['color']>;

/**
 * Migration map from old Catppuccin color names to new semantic colors.
 * Used when loading tabs from storage that may have old style names.
 */
const TAB_STYLE_MIGRATION_MAP: Record<string, TabStyleColor> = {
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
 * Migrates a tab style from old Catppuccin names to new semantic colors.
 * Returns 'default' for unknown styles, undefined, or 'default'.
 */
export function migrateTabStyle(style: string | undefined): TabStyleColor {
  if (!style || style === 'default') {
    return 'default';
  }

  // Already a valid new style
  if (style in TAB_STYLE_LABELS) {
    return style as TabStyleColor;
  }

  // Try migration map
  const migrated = TAB_STYLE_MIGRATION_MAP[style];
  if (migrated) {
    return migrated;
  }

  // Unknown style, fall back to default
  return 'default';
}
