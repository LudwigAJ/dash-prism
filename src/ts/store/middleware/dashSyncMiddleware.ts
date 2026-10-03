// src/ts/store/middleware/dashSyncMiddleware.ts
import { isAction, type Middleware } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { Workspace } from '@types';
import { pruneSearchBarModes } from '../uiSlice';
import { getLeafPanelIds } from '@utils/panels';
import { resetWorkspace } from '../workspaceSlice';
import { selectWorkspaceSnapshot } from '../selectors';
import { validateWorkspace } from '@utils/workspace';
import { logger } from '@utils/logger';

const DEBOUNCE_MS = 500;

/** Return type for createDashSyncMiddleware - includes cleanup function */
export type DashSyncMiddlewareResult = {
  middleware: Middleware<object, RootState>;
  /** Cleans up the event listeners and pending timeouts. */
  cleanup: () => void;
};

/**
 * Middleware that syncs workspace state to Dash via setProps callback.
 * Replaces the useDashSync hook with middleware-based approach.
 *
 * Features:
 * - First sync is immediate
 * - Subsequent syncs are debounced (500ms)
 * - Deduplication via serialization comparison
 * - Flushes on page unload
 * - Returns cleanup function to prevent memory leaks
 *
 * @returns Object with middleware and cleanup function
 */
export function createDashSyncMiddleware(
  setProps: ((props: Record<string, unknown>) => void) | undefined
): DashSyncMiddlewareResult {
  let lastSyncRef = '';
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isFirstSync = true;
  let pendingWorkspace: Workspace | null = null;
  let flushPendingSync: (() => void) | null = null;

  const doSync = (workspace: Workspace) => {
    if (!setProps) return;
    const serialized = JSON.stringify(workspace);
    if (serialized === lastSyncRef) return;
    lastSyncRef = serialized;
    setProps({ readWorkspace: workspace });
    pendingWorkspace = null;
  };

  // Flush pending sync on page unload
  if (typeof window !== 'undefined') {
    flushPendingSync = () => {
      if (pendingWorkspace) {
        if (timeoutId) clearTimeout(timeoutId);
        doSync(pendingWorkspace);
      }
    };
    window.addEventListener('beforeunload', flushPendingSync);
    window.addEventListener('pagehide', flushPendingSync);
  }

  /**
   * Cleanup function to remove event listeners and clear pending timeouts.
   * Should be called when the store is being disposed (e.g., component unmount).
   */
  const cleanup = () => {
    // Clear any pending debounced sync
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // Remove event listeners
    if (typeof window !== 'undefined' && flushPendingSync) {
      window.removeEventListener('beforeunload', flushPendingSync);
      window.removeEventListener('pagehide', flushPendingSync);
    }

    // Clear references
    pendingWorkspace = null;
    lastSyncRef = '';
  };

  const middleware: Middleware<object, RootState> = (store) => (next) => (action: unknown) => {
    const result = next(action);
    if (!isAction(action)) return result;

    // Sync on workspace actions, undo/redo actions, AND after persistence rehydration
    const isWorkspaceAction =
      typeof action.type === 'string' &&
      (action.type.startsWith('workspace/') ||
        action.type === '@@redux-undo/UNDO' ||
        action.type === '@@redux-undo/REDO' ||
        action.type === '@@redux-undo/JUMP' ||
        action.type === 'persist/REHYDRATE');

    if (isWorkspaceAction) {
      const state = store.getState();
      const workspace = selectWorkspaceSnapshot(state);

      if (timeoutId) clearTimeout(timeoutId);

      if (isFirstSync) {
        isFirstSync = false;
        doSync(workspace);
      } else {
        pendingWorkspace = workspace;
        timeoutId = setTimeout(() => {
          doSync(workspace);
        }, DEBOUNCE_MS);
      }

      // Drop search-bar modes of panels that disappeared in this change, whatever
      // removed them (collapsePanel, removeTab/moveTab/splitPanel collapsing an
      // empty panel, reconciliation, rehydration).
      const leafPanelIds = getLeafPanelIds(workspace.panel);
      const leafSet = new Set<string>(leafPanelIds);
      const stale = Object.keys(state.ui.searchBarModes).some((id) => !leafSet.has(id));
      if (stale) {
        store.dispatch(pruneSearchBarModes({ leafPanelIds }));
      }
    }

    return result;
  };

  return { middleware, cleanup };
}

// =============================================================================
// Validation Middleware
// =============================================================================

/**
 * Middleware that validates state after workspace actions.
 * In development: validates on all workspace actions.
 * In production: validates only after rehydration (corrupted localStorage protection).
 * If rehydration produces invalid state, dispatches resetWorkspace() to recover.
 */
export const validationMiddleware: Middleware<object, RootState> =
  (store) => (next) => (action: unknown) => {
    const result = next(action);
    if (!isAction(action)) return result;

    const isRehydrate = typeof action.type === 'string' && action.type === 'persist/REHYDRATE';

    // In production, only validate after rehydration
    if (process.env.NODE_ENV === 'production' && !isRehydrate) return result;

    // Validate on workspace actions, undo/redo, and rehydration
    const shouldValidate =
      isRehydrate ||
      (typeof action.type === 'string' &&
        (action.type.startsWith('workspace/') || action.type.startsWith('@@redux-undo/')));

    if (shouldValidate) {
      const state = store.getState();
      // Access .present because workspace is wrapped with redux-undo
      const workspace = state.workspace.present;
      const validation = validateWorkspace(workspace);

      if (!validation.ok) {
        const { errors } = validation;
        logger.validation(errors);

        // On rehydration failure, reset to clean state to prevent crash
        if (isRehydrate) {
          store.dispatch(resetWorkspace());
        }
      }
    }

    return result;
  };
