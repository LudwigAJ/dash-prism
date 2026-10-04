// src/ts/store/index.ts
import {
  configureStore,
  combineReducers,
  type ThunkDispatch,
  type UnknownAction,
} from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  createMigrate,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  type PersistState,
} from 'redux-persist';
import undoable, { excludeAction, ActionCreators as UndoActionCreators } from 'redux-undo';

import { workspaceReducer } from './workspaceSlice';
import { uiReducer } from './uiSlice';
import { createDashSyncMiddleware, validationMiddleware } from './middleware/dashSyncMiddleware';
import { createReconcileMiddleware } from './middleware/reconcileMiddleware';
import type { StoreConfig, ThunkExtra, WorkspaceState, UiState } from './types';
import { prismToast } from '@utils/prismToast';
import { PERSIST_VERSION, getStorage, getWorkspacePersistKey, migrations } from './persistence';

// =============================================================================
// Redux-Undo Configuration
// =============================================================================

/**
 * Actions that should NOT create undo history entries.
 * These are either UI-only actions or sync actions from the backend.
 */
const UNDO_EXCLUDED_ACTIONS = [
  'workspace/syncWorkspace', // Backend sync should not be undoable
  'workspace/activateTab', // Tab selection is not undoable
  'workspace/setActivePanel', // Panel focus is not undoable
  'workspace/resizePanel', // Resize is continuous, not undoable
  'workspace/reconcileWithServer', // Closing tabs for removed layouts cannot be undone
  // redux-persist lifecycle actions. persistReducer forwards them to the
  // undoable reducer it wraps; they must never become undo steps, otherwise a
  // fresh page load would start with Undo enabled and one undo could revert
  // the restored workspace.
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
];

// =============================================================================
// Store Factory
// =============================================================================

/**
 * Creates a configured Redux store with persistence, undo/redo, and middleware.
 *
 * @example
 * ```tsx
 * const { store, persistor } = createPrismStore({
 *   componentId: 'my-prism',
 *   persistenceType: 'local',
 *   maxTabs: 16,
 *   setProps: dashSetProps,
 * });
 * ```
 */
export function createPrismStore(config: StoreConfig) {
  const {
    componentId,
    serverSessionId,
    persistenceType,
    maxTabs,
    maxPanels,
    setProps,
    getRegisteredLayouts,
    storage,
  } = config;

  // Configure persistence for the workspace slice only.
  // persistReducer wraps the undoable reducer and persists just its `present`
  // (whitelist), so the undo history is never stored and starts fresh on every
  // page load. Wrapping in this order matters: redux-undo handles UNDO/REDO
  // itself without calling the reducer it wraps, so with persistReducer on the
  // inside an undo was never written to storage until the next ordinary action
  // and a reload right after an undo silently lost it.
  const workspacePersistConfig = {
    key: getWorkspacePersistKey(componentId),
    version: PERSIST_VERSION,
    storage: storage ?? getStorage(persistenceType),
    whitelist: ['present'],
    migrate: createMigrate(migrations, { debug: process.env.NODE_ENV !== 'production' }),
  };

  // Wrap workspace reducer with redux-undo, then persist its `present`
  const undoableWorkspaceReducer = undoable(workspaceReducer, {
    limit: 50,
    filter: excludeAction(UNDO_EXCLUDED_ACTIONS),
    groupBy: (action) => {
      if (action.type === 'workspace/renameTab') return 'rename';
      return null;
    },
    // The undo baseline is established by clearHistory() once rehydration has
    // finished (see persistStore below), so the loaded workspace is exactly one
    // undo away from the user's first action. `ignoreInitialState: true` would
    // instead null that baseline and make the first action impossible to undo.
    ignoreInitialState: false,
    syncFilter: true,
  });
  const persistedWorkspaceReducer = persistReducer(
    workspacePersistConfig,
    undoableWorkspaceReducer
  );

  // Combine reducers
  const rootReducer = combineReducers({
    workspace: persistedWorkspaceReducer,
    ui: uiReducer,
  });

  // Create thunk extra argument
  const thunkExtra: ThunkExtra = {
    getMaxTabs: typeof maxTabs === 'function' ? maxTabs : () => maxTabs,
    getMaxPanels: typeof maxPanels === 'function' ? maxPanels : () => maxPanels,
    getRegisteredLayouts: getRegisteredLayouts ?? (() => ({})),
    notify: (level, message, logDetails) => {
      prismToast(level, message, { logDetails, toasterId: componentId });
    },
  };

  // Create dash sync middleware (returns middleware + cleanup function)
  const dashSync = createDashSyncMiddleware(setProps);

  // Reconcile the rehydrated workspace with the server's layout registry.
  // Placed before validationMiddleware in the chain so that, after the reducer
  // runs, validation (and its corrupt-state reset) happens first and the
  // reconciliation sees a valid workspace.
  const reconcile = createReconcileMiddleware(
    () => serverSessionId,
    thunkExtra.getRegisteredLayouts
  );

  // Configure store
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore redux-persist action types
          ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
        thunk: {
          extraArgument: thunkExtra,
        },
      })
        .concat(dashSync.middleware)
        .concat(reconcile)
        .concat(validationMiddleware),
    devTools: process.env.NODE_ENV !== 'production',
  });

  // Create persistor. Once rehydration has finished, reset the undo history so
  // the restored workspace is the baseline: nothing that happened while loading
  // (the persist lifecycle, or the resetWorkspace() that validationMiddleware
  // dispatches for corrupt persisted data) is one undo away, and the user's
  // first real action can be undone back to exactly what was loaded.
  const persistor = persistStore(store, undefined, () => {
    store.dispatch(UndoActionCreators.clearHistory());
  });

  /**
   * Cleanup function to dispose of store resources.
   * Call this when unmounting the Prism component to prevent memory leaks.
   */
  const cleanup = () => {
    dashSync.cleanup();
  };

  return { store, persistor, cleanup };
}

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Root state type - manually defined to match redux-undo wrapped workspace
 */
export type RootState = {
  workspace: {
    past: WorkspaceState[];
    present: WorkspaceState;
    future: WorkspaceState[];
    _latestUnfiltered?: WorkspaceState;
    /** redux-persist bookkeeping (version + rehydrated flag); lives beside the history. */
    _persist?: PersistState;
  };
  ui: UiState;
};

/**
 * App dispatch type with thunk support.
 */
export type AppDispatch = ThunkDispatch<RootState, ThunkExtra, UnknownAction>;

// =============================================================================
// Undo/Redo Action Creators
// =============================================================================

/**
 * Undoes the last workspace action.
 * @example dispatch(undo())
 */
export const undo = UndoActionCreators.undo;

// Re-exports. The components import the store through this module (`@store`), and src/ts/index.ts
// re-exports part of it, so each name below has an importer.

export {
  createInitialWorkspaceState,
  removeTab,
  activateTab,
  renameTab,
  lockTab,
  unlockTab,
  toggleTabLock,
  updateTabLayout,
  moveTab,
  reorderTab,
  setTabIcon,
  setTabStyle,
  refreshTab,
  setActivePanel,
  resizePanel,
  pinPanel,
  unpinPanel,
  toggleSearchBars,
  toggleFavoriteLayout,
  resetWorkspace,
  syncWorkspace,
  switchToOpenTab,
} from './workspaceSlice';
export { addTab, duplicateTab, splitPanel, canAddPanel } from './workspaceThunks';
export {
  initialUiState,
  setSearchBarMode,
  pruneSearchBarModes,
  startRenameTab,
  clearRenameTab,
  requestLayoutSelection,
  clearLayoutSelectionRequest,
  requestSearchFocus,
  clearSearchFocusRequest,
  openInfoModal,
  closeInfoModal,
  openHelpModal,
  closeHelpModal,
  openSetIconModal,
  closeSetIconModal,
  setLoadNotice,
  clearLoadNotice,
} from './uiSlice';
export {
  clearPersistedWorkspace,
  getWorkspaceStorageKey,
  resolvePersistenceType,
} from './persistence';
export {
  selectTabs,
  selectPanel,
  selectPanelTabs,
  selectActiveTabIds,
  selectActivePanelId,
  selectFavoriteLayouts,
  selectSearchBarsHidden,
  selectCanUndo,
  selectSearchBarModes,
  selectRenamingTabId,
  selectLayoutSelectionRequest,
  selectSearchFocusPanelId,
  selectInfoModalTabId,
  selectHelpModalOpen,
  selectSetIconModalTabId,
  selectLoadNotice,
  selectTabCount,
  selectPanelCount,
  selectIsSingleTabMode,
  selectWorkspaceSnapshot,
} from './selectors';
export { useAppDispatch, useAppSelector } from './hooks';
export type { WorkspaceState, UiState, SearchBarMode, StoreConfig, ThunkExtra } from './types';
