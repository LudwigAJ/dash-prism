/**
 * Toast Event Emitter & User Notifications
 *
 * Every toast in Prism goes through `prismToast`, which applies the house options:
 * the Dismiss button and a log entry.
 *
 * A thunk calls `notifyUser` instead. `notifyUser` emits a toast event, so a test of the thunk
 * can listen for the event and does not need the toast library. The subscriber in PrismInner
 * passes each event to `prismToast`. Reducers do not toast. A reducer that cannot apply an
 * action returns early.
 */

import { toast } from 'sonner';
import { logger } from './logger';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastEvent {
  type: ToastType;
  message: string;
  description?: string;
  /** Text for the log in place of `message`. */
  logDetails?: string;
}

type Listener = (event: ToastEvent) => void;
const listeners = new Set<Listener>();

const toastEmitter = {
  /**
   * Emits a toast event to all subscribers.
   */
  emit: (event: ToastEvent): void => {
    listeners.forEach((fn) => {
      fn(event);
    });
  },

  /**
   * Subscribes to toast events.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe: (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/**
 * Subscribes to toast events.
 * Returns an unsubscribe function for cleanup.
 */
export function subscribeToToasts(fn: Listener): () => void {
  return toastEmitter.subscribe(fn);
}

/**
 * Shows a toast with the house options and logs it.
 *
 * @param type - The severity of the toast
 * @param message - User-facing message shown in the toast
 * @param options - A description for the toast, a text for the log that replaces `message`, and a
 * log level. The log level defaults to the level that matches the toast. An error toast that
 * reports bad user input must set 'warn', because the logger writes an error to `console.error`
 * in production too.
 */
export function prismToast(
  type: ToastType,
  message: string,
  options: { description?: string; logDetails?: string; logLevel?: 'info' | 'warn' | 'error' } = {}
): void {
  // The logger has no 'warning' or 'success' level.
  const matchingLevel = type === 'warning' ? 'warn' : type === 'success' ? 'info' : type;
  logger[options.logLevel ?? matchingLevel](options.logDetails ?? message);
  toast[type](message, {
    description: options.description,
    cancel: { label: 'Dismiss', onClick: () => {} },
  });
}

/**
 * Asks the subscriber in PrismInner to show a toast. Thunks use it.
 *
 * @param level - The severity of the toast
 * @param message - User-facing message shown in the toast
 * @param logDetails - Optional detailed message for the log (defaults to the message)
 */
export function notifyUser(
  level: 'info' | 'warning' | 'error',
  message: string,
  logDetails?: string
): void {
  toastEmitter.emit({ type: level, message, logDetails });
}
