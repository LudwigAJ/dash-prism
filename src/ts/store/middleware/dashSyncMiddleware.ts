import { isAction, type Action, type Middleware } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import { ActionTypes as UndoActionTypes } from 'redux-undo';
import type { RootState } from '@store';
import type { Workspace } from '@types';
import { pruneSearchBarModes } from '@store/uiSlice';
import { getLeafPanelIds } from '@utils/panels';
import { resetWorkspace } from '@store/workspaceSlice';
import { selectWorkspaceSnapshot } from '@store/selectors';
import { validateWorkspace } from '@utils/workspace';
import { logger } from '@utils/logger';

// The docstrings of the readWorkspace prop promise a sync 500 ms after the last change, and
// tests/test_components.py pins that wording. Change the constant, the docstrings and the test
// together.
const DEBOUNCE_MS = 500;

/** Holds the redux-undo actions that move the present workspace through the history. */
const HISTORY_MOVES = new Set([
  UndoActionTypes.UNDO,
  UndoActionTypes.REDO,
  UndoActionTypes.JUMP,
  UndoActionTypes.JUMP_TO_PAST,
  UndoActionTypes.JUMP_TO_FUTURE,
]);

/**
 * Tells if an action can change the present workspace: a workspace action, a move through the
 * undo history, or the rehydration from storage.
 */
export function isWorkspaceChange(action: Action): boolean {
  return (
    action.type.startsWith('workspace/') ||
    HISTORY_MOVES.has(action.type) ||
    action.type === REHYDRATE
  );
}

/** Holds the Dash sync middleware and the function that connects it to the page. */
export interface DashSyncMiddlewareResult {
  middleware: Middleware<object, RootState>;
  /**
   * Starts the flush of a pending sync on page unload. Returns the function that stops the flush
   * and drops the pending sync.
   */
  connect: () => () => void;
}

/**
 * Creates the middleware that writes the present workspace to the `readWorkspace` prop of Dash.
 *
 * - The first change, which is the rehydration on page load, syncs at once. A Dash callback with
 *   the input `readWorkspace` then gets the loaded workspace before the user does anything.
 * - Each later change starts the `DEBOUNCE_MS` timer again, so a burst of changes such as a drag
 *   or a resize sends one Dash request.
 * - A workspace that serializes to the last synced JSON is not sent again.
 * - A pending sync goes out when the page unloads, while the middleware is connected.
 *
 * The creation adds no listener, because React can create a store and then discard it. Call
 * `connect` in an effect, and call the function that it returns in the cleanup of that effect.
 */
export function createDashSyncMiddleware(
  setProps: ((props: Record<string, unknown>) => void) | undefined
): DashSyncMiddlewareResult {
  let lastSyncedJson = '';
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isFirstSync = true;
  let pendingWorkspace: Workspace | null = null;

  const doSync = (workspace: Workspace) => {
    if (!setProps) return;
    const serialized = JSON.stringify(workspace);
    if (serialized === lastSyncedJson) return;
    lastSyncedJson = serialized;
    setProps({ readWorkspace: workspace });
    pendingWorkspace = null;
  };

  const flushPendingSync = () => {
    if (!pendingWorkspace) return;
    if (timeoutId) clearTimeout(timeoutId);
    doSync(pendingWorkspace);
  };

  // React StrictMode disconnects and connects again right after the mount. The disconnect keeps
  // lastSyncedJson, so the middleware does not send the same workspace again after it reconnects.
  const connect = () => {
    window.addEventListener('beforeunload', flushPendingSync);
    window.addEventListener('pagehide', flushPendingSync);
    return () => {
      window.removeEventListener('beforeunload', flushPendingSync);
      window.removeEventListener('pagehide', flushPendingSync);
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = null;
      pendingWorkspace = null;
    };
  };

  const middleware: Middleware<object, RootState> = (store) => (next) => (action: unknown) => {
    const result = next(action);
    if (!isAction(action)) return result;

    if (isWorkspaceChange(action)) {
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
      // removed them (removeTab/moveTab/splitPanel collapsing an empty panel,
      // reconciliation, rehydration).
      const leafPanelIds = getLeafPanelIds(workspace.panel);
      const leafSet = new Set<string>(leafPanelIds);
      const stale = Object.keys(state.ui.searchBarModes).some((id) => !leafSet.has(id));
      if (stale) {
        store.dispatch(pruneSearchBarModes({ leafPanelIds }));
      }
    }

    return result;
  };

  return { middleware, connect };
}

/**
 * Checks the present workspace after each change and logs each broken invariant. After the
 * rehydration, a workspace that fails the check is replaced by a fresh one, because a corrupt
 * stored workspace would otherwise crash the first render.
 *
 * In development the check runs after every workspace change, so a broken invariant shows up at
 * the action that broke it. In production it runs after the rehydration only, because a walk of
 * the whole tree on each action costs time and the reducers keep the invariants.
 */
export const validationMiddleware: Middleware<object, RootState> =
  (store) => (next) => (action: unknown) => {
    const result = next(action);
    if (!isAction(action) || !isWorkspaceChange(action)) return result;

    const isRehydrate = action.type === REHYDRATE;
    if (process.env.NODE_ENV === 'production' && !isRehydrate) return result;

    const errors = validateWorkspace(store.getState().workspace.present);
    if (errors.length > 0) {
      logger.validation(errors);
      if (isRehydrate) {
        store.dispatch(resetWorkspace());
      }
    }

    return result;
  };
