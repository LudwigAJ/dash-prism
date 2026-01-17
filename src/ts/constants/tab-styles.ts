/**
 * Tab Style Variants
 *
 * Predefined visual styles for tabs that work with both light and dark themes.
 * Each style has theme-specific CSS classes for proper contrast.
 */

export const TAB_STYLE_VARIANTS = {
  default: {
    label: 'Default',
    light: '',
    dark: '',
  },
  rosewater: {
    label: 'Rosewater',
    light: 'bg-rosewater/20 border-rosewater/40 data-[state=active]:bg-rosewater/30',
    dark: 'bg-rosewater/15 border-rosewater/35 data-[state=active]:bg-rosewater/25',
  },
  flamingo: {
    label: 'Flamingo',
    light: 'bg-flamingo/20 border-flamingo/40 data-[state=active]:bg-flamingo/30',
    dark: 'bg-flamingo/15 border-flamingo/35 data-[state=active]:bg-flamingo/25',
  },
  pink: {
    label: 'Pink',
    light: 'bg-pink/20 border-pink/40 data-[state=active]:bg-pink/30',
    dark: 'bg-pink/15 border-pink/35 data-[state=active]:bg-pink/25',
  },
  mauve: {
    label: 'Mauve',
    light: 'bg-mauve/20 border-mauve/40 data-[state=active]:bg-mauve/30',
    dark: 'bg-mauve/15 border-mauve/35 data-[state=active]:bg-mauve/25',
  },
  red: {
    label: 'Red',
    light: 'bg-red/20 border-red/40 data-[state=active]:bg-red/30',
    dark: 'bg-red/15 border-red/35 data-[state=active]:bg-red/25',
  },
  maroon: {
    label: 'Maroon',
    light: 'bg-maroon/20 border-maroon/40 data-[state=active]:bg-maroon/30',
    dark: 'bg-maroon/15 border-maroon/35 data-[state=active]:bg-maroon/25',
  },
  peach: {
    label: 'Peach',
    light: 'bg-peach/20 border-peach/40 data-[state=active]:bg-peach/30',
    dark: 'bg-peach/15 border-peach/35 data-[state=active]:bg-peach/25',
  },
  yellow: {
    label: 'Yellow',
    light: 'bg-yellow/20 border-yellow/40 data-[state=active]:bg-yellow/30',
    dark: 'bg-yellow/15 border-yellow/35 data-[state=active]:bg-yellow/25',
  },
  green: {
    label: 'Green',
    light: 'bg-green/20 border-green/40 data-[state=active]:bg-green/30',
    dark: 'bg-green/15 border-green/35 data-[state=active]:bg-green/25',
  },
  teal: {
    label: 'Teal',
    light: 'bg-teal/20 border-teal/40 data-[state=active]:bg-teal/30',
    dark: 'bg-teal/15 border-teal/35 data-[state=active]:bg-teal/25',
  },
  sky: {
    label: 'Sky',
    light: 'bg-sky/20 border-sky/40 data-[state=active]:bg-sky/30',
    dark: 'bg-sky/15 border-sky/35 data-[state=active]:bg-sky/25',
  },
  sapphire: {
    label: 'Sapphire',
    light: 'bg-sapphire/20 border-sapphire/40 data-[state=active]:bg-sapphire/30',
    dark: 'bg-sapphire/15 border-sapphire/35 data-[state=active]:bg-sapphire/25',
  },
  blue: {
    label: 'Blue',
    light: 'bg-blue/20 border-blue/40 data-[state=active]:bg-blue/30',
    dark: 'bg-blue/15 border-blue/35 data-[state=active]:bg-blue/25',
  },
  lavender: {
    label: 'Lavender',
    light: 'bg-lavender/20 border-lavender/40 data-[state=active]:bg-lavender/30',
    dark: 'bg-lavender/15 border-lavender/35 data-[state=active]:bg-lavender/25',
  },
} as const;

export type TabStyleVariant = keyof typeof TAB_STYLE_VARIANTS;

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
