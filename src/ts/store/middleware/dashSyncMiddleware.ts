// src/ts/store/middleware/dashSyncMiddleware.ts
import type { Middleware, UnknownAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { Workspace } from '@types';

const DEBOUNCE_MS = 500;

/**
 * Middleware that syncs workspace state to Dash via setProps callback.
 * Replaces the useDashSync hook with middleware-based approach.
 *
 * Features:
 * - First sync is immediate
 * - Subsequent syncs are debounced (500ms)
 * - Deduplication via serialization comparison
 * - Flushes on page unload
 */
export function createDashSyncMiddleware(
  setProps: ((props: Record<string, unknown>) => void) | undefined
): Middleware<object, RootState> {
  let lastSyncRef = '';
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isFirstSync = true;
  let pendingWorkspace: Partial<Workspace> | null = null;

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
    const flushPendingSync = () => {
      if (pendingWorkspace) {
        if (timeoutId) clearTimeout(timeoutId);
        doSync(pendingWorkspace);
      }
    };
    window.addEventListener('beforeunload', flushPendingSync);
    window.addEventListener('pagehide', flushPendingSync);
  }

  return (store) => (next) => (action: UnknownAction) => {
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
    }

    return result;
  };
}
