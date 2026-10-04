/** Default for the maxPanels prop: the most leaf panels a workspace may be split into. */
export const MAX_LEAF_PANELS = 20;

/**
 * Normalises the `maxPanels` prop into the number the split guard expects.
 *
 * An omitted prop (`undefined`) means the default limit. An explicit `None` from
 * Python arrives as `null` and means "no limit", the same reading `maxTabs` gives
 * it. Dash sends `null` past every destructuring default, so the prop needs this
 * one function to tell the two cases apart.
 */
export function resolveMaxPanels(value: number | null | undefined): number {
  if (value === undefined) return MAX_LEAF_PANELS;
  if (value === null) return 0; // 0 (like any value below 1) means unlimited
  return value;
}
