/**
 * Toasts of Prism.
 *
 * Every toast in Prism goes through `prismToast`, which applies the house options: the Dismiss
 * button and a log entry. Each Prism instance has its own Toaster, which has the component ID
 * as its `id`. A toast with that `toasterId` shows in that Toaster only, so a toast that one
 * instance raises does not show in another instance on the page.
 *
 * A thunk reaches `prismToast` through `ThunkExtra.notify`, which the store binds to its
 * instance. A component calls `usePrismToast`. Reducers do not toast. A reducer that cannot
 * apply an action returns early.
 */

import { toast } from 'sonner';
import { logger } from './logger';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

/**
 * Shows a toast with the house options and logs it.
 *
 * @param type - The severity of the toast
 * @param message - User-facing message shown in the toast
 * @param options - A description for the toast, a text for the log that replaces `message`, a
 * log level and the ID of the Toaster that shows the toast. The log level defaults to the level
 * that matches the toast. An error toast that reports bad user input must set 'warn', because
 * the logger writes an error to `console.error` in production too.
 */
export function prismToast(
  type: ToastType,
  message: string,
  options: {
    description?: string;
    logDetails?: string;
    logLevel?: 'info' | 'warn' | 'error';
    toasterId?: string;
  } = {}
): void {
  // The logger has no 'warning' or 'success' level.
  const matchingLevel = type === 'warning' ? 'warn' : type === 'success' ? 'info' : type;
  logger[options.logLevel ?? matchingLevel](options.logDetails ?? message);
  toast[type](message, {
    description: options.description,
    toasterId: options.toasterId,
    cancel: { label: 'Dismiss', onClick: () => {} },
  });
}
