// src/ts/store/middleware/dashSyncMiddleware.ts
import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { Workspace, PanelId } from '@types';
import { clearSearchBarMode } from '../uiSlice';

const DEBOUNCE_MS = 500;

/** Return type for createDashSyncMiddleware - includes cleanup function */
export type DashSyncMiddlewareResult = {
  middleware: Middleware<object, RootState>;
  /** Call this to clean up event listeners and pending timeouts */
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
  let pendingWorkspace: Partial<Workspace> | null = null;
  let flushPendingSync: (() => void) | null = null;

  const doSync = (workspace: Partial<Workspace>) => {
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

  const middleware: Middleware<object, RootState> =
    (store) => (next) => (action: UnknownAction) => {
      const result = next(action);

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
        // Access .present because workspace is wrapped with redux-undo
        const present = state.workspace.present;
        const workspace: Partial<Workspace> = {
          tabs: present.tabs,
          panel: present.panel,
          panelTabs: present.panelTabs,
          activeTabIds: present.activeTabIds,
          activePanelId: present.activePanelId,
          favoriteLayouts: present.favoriteLayouts,
          searchBarsHidden: present.searchBarsHidden,
        };

        if (timeoutId) clearTimeout(timeoutId);

        if (isFirstSync) {
          isFirstSync = false;
          doSync(workspace);
        } else {
          pendingWorkspace = workspace;
          timeoutId = setTimeout(() => doSync(workspace), DEBOUNCE_MS);
        }

        // Clean up searchBarModes when a panel is collapsed
        if (action.type === 'workspace/collapsePanel') {
          const panelId = (action as unknown as { payload: { panelId: PanelId } }).payload?.panelId;
          if (panelId) {
            store.dispatch(clearSearchBarMode({ panelId }));
          }
        }
      }

      return result;
    };

  return { middleware, cleanup };
}
