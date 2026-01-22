/**
 * Toast Event Emitter
 *
 * This utility provides a simple event emitter pattern for toast notifications.
 * The reducer emits toast events when operations fail/succeed, and the PrismContext
 * subscribes to these events to trigger actual toasts via Sonner.
 *
 * This approach maintains single source of truth (reducer) while keeping the reducer
 * testable and avoiding direct coupling to the toast library.
 */

export type ToastEvent = {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  description?: string;
};

type Listener = (event: ToastEvent) => void;
const listeners = new Set<Listener>();

export const toastEmitter = {
  /**
   * Emit a toast event to all subscribers.
   * Called from reducer when operations fail/succeed.
   */
  emit: (event: ToastEvent): void => {
    listeners.forEach((fn) => fn(event));
  },

  /**
   * Subscribe to toast events.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe: (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
