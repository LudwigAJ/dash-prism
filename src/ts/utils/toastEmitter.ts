/**
 * Toast Event Emitter & User Notifications
 *
 * This utility provides a simple event emitter pattern for toast notifications.
 * The reducer emits toast events when operations fail/succeed, and the PrismContext
 * subscribes to these events to trigger actual toasts via Sonner.
 *
 * This approach maintains single source of truth (reducer) while keeping the reducer
 * testable and avoiding direct coupling to the toast library.
 */

import { logger } from './logger';

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

/**
 * Notify the user with a toast message and log the details.
 * Consolidates the common pattern of logging + toast emission.
 *
 * @param level - The severity level ('info', 'warning', or 'error')
 * @param message - User-facing message shown in toast
 * @param logDetails - Optional detailed message for logging (defaults to message)
 */
export function notifyUser(
  level: 'info' | 'warning' | 'error',
  message: string,
  logDetails?: string
): void {
  // Map 'warning' to 'warn' for logger (logger uses 'warn', toast uses 'warning')
  const logLevel = level === 'warning' ? 'warn' : level;
  logger[logLevel](logDetails ?? message);
  toastEmitter.emit({ type: level, message });
}
