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
  primary: {
    label: 'Primary',
    light: 'bg-primary/10 border-primary/30 data-[state=active]:bg-primary/20',
    dark: 'bg-primary/20 border-primary/40 data-[state=active]:bg-primary/30',
  },
  secondary: {
    label: 'Secondary',
    light: 'bg-secondary/20 border-secondary/30 data-[state=active]:bg-secondary/30',
    dark: 'bg-secondary/30 border-secondary/40 data-[state=active]:bg-secondary/40',
  },
  success: {
    label: 'Success',
    light: 'bg-emerald-100 border-emerald-300 data-[state=active]:bg-emerald-200',
    dark: 'bg-emerald-900/30 border-emerald-700 data-[state=active]:bg-emerald-800/40',
  },
  danger: {
    label: 'Danger',
    light: 'bg-red-100 border-red-300 data-[state=active]:bg-red-200',
    dark: 'bg-red-900/30 border-red-700 data-[state=active]:bg-red-800/40',
  },
  warning: {
    label: 'Warning',
    light: 'bg-amber-100 border-amber-300 data-[state=active]:bg-amber-200',
    dark: 'bg-amber-900/30 border-amber-700 data-[state=active]:bg-amber-800/40',
  },
  info: {
    label: 'Info',
    light: 'bg-blue-100 border-blue-300 data-[state=active]:bg-blue-200',
    dark: 'bg-blue-900/30 border-blue-700 data-[state=active]:bg-blue-800/40',
  },
  light: {
    label: 'Light',
    light: 'bg-gray-100 border-gray-300 data-[state=active]:bg-gray-200',
    dark: 'bg-gray-700 border-gray-600 data-[state=active]:bg-gray-600',
  },
  dark: {
    label: 'Dark',
    light: 'bg-gray-700 border-gray-600 text-white data-[state=active]:bg-gray-800',
    dark: 'bg-gray-900 border-gray-800 text-white data-[state=active]:bg-gray-950',
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
