import type { LucideIcon } from 'lucide-react';
import {
  Rocket,
  Lightbulb,
  Zap,
  Sparkles,
  Coffee,
  Brain,
  Bot,
  Cpu,
  CircuitBoard,
  GitBranch,
  Atom,
  Beaker,
  FlaskConical,
  TrendingDown,
  Cat,
  Dog,
  Bug,
  Banana,
  Trophy,
  TrendingUpDown,
  Activity,
  TrendingUp,
  DollarSign,
  Wallet,
  Banknote,
  PiggyBank,
  Bitcoin,
  Coins,
  Landmark,
  Euro,
  PoundSterling,
  JapaneseYen,
  SwissFranc,
  Calculator,
  Infinity,
  Binary,
  BarChart3,
  PieChart,
  LineChart,
  Globe,
  Heart,
} from 'lucide-react';

import iconsConfig from '../../icons.json';

/**
 * Map of icon names to icon components.
 * Icons are defined in src/icons.json (single source of truth for both TS and Python).
 * Only icons explicitly imported are available - prevents bundling entire library.
 */
const ICON_COMPONENTS: Record<string, LucideIcon> = {
  Rocket,
  Lightbulb,
  Zap,
  Sparkles,
  Coffee,
  Brain,
  Bot,
  Cpu,
  CircuitBoard,
  GitBranch,
  Atom,
  Beaker,
  FlaskConical,
  TrendingDown,
  Cat,
  Dog,
  Bug,
  Banana,
  Trophy,
  TrendingUpDown,
  Activity,
  TrendingUp,
  DollarSign,
  Wallet,
  Banknote,
  PiggyBank,
  Bitcoin,
  Coins,
  Landmark,
  Euro,
  PoundSterling,
  JapaneseYen,
  SwissFranc,
  Calculator,
  Infinity,
  Binary,
  BarChart3,
  PieChart,
  LineChart,
  Globe,
  Heart,
};

/**
 * List of available icon names from config.
 * Source of truth: src/icons.json (shared with Python)
 */
export const TAB_ICON_NAMES: readonly string[] = iconsConfig.icons;

export type TabIconName = (typeof TAB_ICON_NAMES)[number];

/**
 * Get a lucide-react icon component by name.
 * Returns undefined if the icon name is not found or empty.
 */
export function getTabIcon(name: string | undefined): LucideIcon | undefined {
  if (!name || name === '') return undefined;
  return ICON_COMPONENTS[name];
}

/**
 * Convert icon name to display label (e.g., "BarChart3" -> "Bar Chart 3")
 */
export function getIconLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/(\d+)/g, ' $1') // Add space before numbers
    .trim();
}
