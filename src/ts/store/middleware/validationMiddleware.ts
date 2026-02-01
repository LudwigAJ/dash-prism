// src/ts/store/middleware/validationMiddleware.ts
import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { validateWorkspace } from '@utils/workspace';
import { logger } from '@utils/logger';

/**
 * Development-only middleware that validates state after each action.
 * Logs warnings if state invariants are violated.
 */
export const validationMiddleware: Middleware<object, RootState> =
  (store) => (next) => (action: UnknownAction) => {
    const result = next(action);

    // Only validate in development
    if (process.env.NODE_ENV === 'production') return result;

    // Validate on workspace actions and undo/redo
    const shouldValidate =
      typeof action.type === 'string' &&
      (action.type.startsWith('workspace/') || action.type.startsWith('@@redux-undo/'));

    if (shouldValidate) {
      const state = store.getState();
      // Access .present because workspace is wrapped with redux-undo
      const workspace = state.workspace.present;
      const validation = validateWorkspace(workspace);

      if (!validation.ok) {
        const { errors } = validation as { ok: false; errors: string[] };
        logger.validation(errors);
      }
    }

    return result;
  };
