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

function isStatusBarItem(value: unknown): value is StatusBarItem {
  return typeof value === 'string' && KNOWN.has(value);
}

/**
 * Normalises the `statusBarItems` prop: it keeps only known segment names, drops
 * duplicates and keeps the caller's order. Dash props are untyped at runtime, so a
 * typo in Python must not crash the bar. Pure; exported for unit tests.
 */
export function resolveStatusBarItems(items: readonly unknown[] | undefined): StatusBarItem[] {
  if (!Array.isArray(items)) return [...DEFAULT_STATUS_BAR_ITEMS];
  const out: StatusBarItem[] = [];
  for (const item of items) {
    if (isStatusBarItem(item) && !out.includes(item)) out.push(item);
  }
  return out;
}
