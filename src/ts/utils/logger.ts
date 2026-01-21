/**
 * Centralized logging utility for Dash Prism.
 * All logs are prefixed with [Prism] for easy filtering.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Check if logging is enabled for the given level.
 * In production, only warnings and errors are logged.
 */
function isLogEnabled(level: LogLevel): boolean {
  if (process.env.NODE_ENV === 'production') {
    return level === 'warn' || level === 'error';
  }
  return true;
}

/**
 * Centralized logger for Dash Prism.
 */
export const logger = {
  /**
   * Debug-level logging (development only).
   * Use for detailed execution flow information.
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (!isLogEnabled('debug')) return;
    console.debug(`[Prism] ${message}`, ...args);
  },

  /**
   * Info-level logging (development only).
   * Use for general informational messages.
   */
  info: (message: string, ...args: unknown[]): void => {
    if (!isLogEnabled('info')) return;
    console.info(`[Prism] ${message}`, ...args);
  },

  /**
   * Warning-level logging (always shown).
   * Use for recoverable errors or unexpected states.
   */
  warn: (message: string, ...args: unknown[]): void => {
    console.warn(`[Prism] ${message}`, ...args);
  },

  /**
   * Error-level logging (always shown).
   * Use for errors that affect functionality.
   */
  error: (message: string, ...args: unknown[]): void => {
    console.error(`[Prism] ${message}`, ...args);
  },

  /**
   * Log state validation errors (development only).
   */
  validation: (errors: string[]): void => {
    if (process.env.NODE_ENV === 'production') return;
    console.error('[Prism] State invariant violations:', errors);
  },
};
