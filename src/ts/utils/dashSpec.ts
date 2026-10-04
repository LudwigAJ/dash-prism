import type { DashComponent } from '@types';

/** Default layout timeout in seconds; mirrors DEFAULT_LAYOUT_TIMEOUT in dash_prism/app_init.py. */
const DEFAULT_LAYOUT_TIMEOUT = 30;

/**
 * Applies the same rule as the server's _coerce_timeout: only a finite, positive
 * number is a usable timeout, anything else (an explicit None from Python
 * arrives as null; 0 and negatives are not "unlimited") means the default.
 */
export function normalizeLayoutTimeout(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_LAYOUT_TIMEOUT;
}

/**
 * Builds the Dash component spec that renders one tab's content.
 *
 * The spec is handed to Dash's ExternalWrapper, which mounts a PrismContent and
 * fires the pattern-matching render callback registered by dash_prism.init().
 *
 * `timeout` (seconds, from the Prism `layoutTimeout` prop) is sent twice on
 * purpose: as the real `layoutTimeout` prop, which drives PrismContent's
 * client-side loading timer, and inside `data`, which is the only input the
 * server-side render callback receives.
 */
export function buildDashSpec(
  id: string,
  layoutId: string | undefined,
  layoutParams: Record<string, string> | undefined,
  layoutOption: string | undefined,
  timeout: number
): DashComponent {
  const effectiveTimeout = normalizeLayoutTimeout(timeout);
  return {
    namespace: 'dash_prism',
    type: 'PrismContent',
    props: {
      // CRITICAL: ID must be an OBJECT, not stringified!
      id: { type: 'prism-content', index: id },
      layoutTimeout: effectiveTimeout,
      data: {
        layoutId,
        // Keep undefined for absent values (consistent with Tab type)
        layoutParams,
        layoutOption,
        timeout: effectiveTimeout,
      },
    },
  };
}
