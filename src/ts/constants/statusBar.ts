import type { StatusBarItem } from '@types';

/** Every built-in segment, in the order the status bar shows them by default. */
export const DEFAULT_STATUS_BAR_ITEMS: readonly StatusBarItem[] = [
  'reset',
  'help',
  'undo',
  'mode',
  'panels',
  'tab',
  'count',
  'updated',
];

const KNOWN = new Set<string>(DEFAULT_STATUS_BAR_ITEMS);

/**
 * Normalise the `statusBarItems` prop: keep only known segment names, drop
 * duplicates, keep the caller's order. Dash props are untyped at runtime, so a
 * typo in Python must not crash the bar. Pure; exported for unit tests.
 */
export function resolveStatusBarItems(items: readonly string[] | undefined): StatusBarItem[] {
  if (!Array.isArray(items)) return [...DEFAULT_STATUS_BAR_ITEMS];
  const seen = new Set<string>();
  const out: StatusBarItem[] = [];
  for (const item of items) {
    if (typeof item === 'string' && KNOWN.has(item) && !seen.has(item)) {
      seen.add(item);
      out.push(item as StatusBarItem);
    }
  }
  return out;
}
