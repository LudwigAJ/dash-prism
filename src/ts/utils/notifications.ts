import { logger } from './logger';
import { toastEmitter } from './toastEmitter';

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
