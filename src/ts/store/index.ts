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
  type Storage,
  type MigrationManifest,
  type PersistState,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import storageSession from 'redux-persist/lib/storage/session';
import undoable, { excludeAction, ActionCreators as UndoActionCreators } from 'redux-undo';

import { workspaceReducer, createInitialWorkspaceState } from './workspaceSlice';
import { uiReducer, initialUiState } from './uiSlice';
import { createDashSyncMiddleware, validationMiddleware } from './middleware/dashSyncMiddleware';
import { createReconcileMiddleware } from './middleware/reconcileMiddleware';
import type { StoreConfig, ThunkExtra, WorkspaceState, UiState } from './types';
import { generateShortId } from '@utils/uuid';

// =============================================================================
// Persistence Key Helpers
// =============================================================================

/** Base prefix for workspace persistence keys (used by redux-persist config). */
const WORKSPACE_PERSIST_PREFIX = 'prism-workspace';

/**
 * Build the redux-persist config key for a workspace.
 * This is the key passed to `persistReducer({ key: ... })`.
 * redux-persist adds its own `persist:` prefix when writing to storage.
 */
export function getWorkspacePersistKey(componentId?: string): string {
  return componentId ? `${WORKSPACE_PERSIST_PREFIX}-${componentId}` : WORKSPACE_PERSIST_PREFIX;
}

/**
 * Build the full storage key as it appears in localStorage / sessionStorage.
 * redux-persist prefixes config keys with `persist:` by default.
 * Use this when directly removing persisted data via `storage.removeItem()`.
 */
export function getWorkspaceStorageKey(componentId?: string): string {
  return `persist:${getWorkspacePersistKey(componentId)}`;
}

// =============================================================================
// Storage Configuration
// =============================================================================

/** No-op storage for memory persistence mode */
const memoryStorage: Storage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

/**
 * Resolve the storage engine that should actually be used.
 *
 * `persistence` is the on/off switch (as in Dash core components) and
 * `persistence_type` only selects where to store when it is on. With
 * `persistence=false` nothing may be written, whatever `persistence_type` says.
 */
export function resolvePersistenceType(
  persistence: boolean,
  persistenceType: 'local' | 'session' | 'memory'
): 'local' | 'session' | 'memory' {
  return persistence ? persistenceType : 'memory';
}

function getStorage(type: 'local' | 'session' | 'memory'): Storage {
  switch (type) {
    case 'local':
      return storage;
    case 'session':
      return storageSession;
    case 'memory':
    default:
      return memoryStorage;
  }
}

// =============================================================================
// Persistence Migration
// =============================================================================

/**
 * Migration manifest for handling persisted state upgrades.
 * Each key is a version number, and the function transforms state from the previous version.
 *
 * Note: Type cast is required because redux-persist's MigrationManifest has strict
 * typing around _persist that doesn't match our migration patterns.
 */
const migrations = {
  // Version 1: Initial Redux migration from useReducer
  // - Ensure all tabs have mountKey
  // - Normalize panel structure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  1: (state: any) => {
    if (!state || typeof state !== 'object') return state;

    // Ensure all tabs have mountKey (required field that may be missing in old data)
    const tabs =
      state.tabs?.map((tab: Record<string, unknown>) => ({
        ...tab,
        mountKey: tab.mountKey ?? generateShortId(),
      })) ?? [];

    return {
      ...state,
      tabs,
      // Ensure favoriteLayouts exists
      favoriteLayouts: state.favoriteLayouts ?? [],
    };
  },

  // Version 2: the persisted payload is redux-undo's `present` only, stored
  // under a single `present` key (persistReducer now wraps undoable(), see
  // createPrismStore). Wrap the old flat workspace object.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  2: (state: any) => {
    if (!state || typeof state !== 'object') return state;
    if ('present' in state) return state;
    const { _persist: _ignored, ...present } = state;
    return { present };
  },
} as MigrationManifest;

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
 * Create a configured Redux store with persistence, undo/redo, and middleware.
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
    version: 2, // Increment this when adding new migrations
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
    getRegisteredLayouts: getRegisteredLayouts ?? (() => ({})),
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

/**
 * Helper type to access present workspace state (unwraps redux-undo)
 */
export type WorkspacePresent = RootState['workspace']['present'];

// =============================================================================
// Undo/Redo Action Creators
// =============================================================================

/**
 * Undo the last workspace action.
 * @example dispatch(undo())
 */
export const undo = UndoActionCreators.undo;

/**
 * Redo the last undone workspace action.
 * @example dispatch(redo())
 */
export const redo = UndoActionCreators.redo;

/**
 * Clear all undo/redo history.
 * @example dispatch(clearHistory())
 */
export const clearHistory = UndoActionCreators.clearHistory;

// =============================================================================
// Re-exports
// =============================================================================

// Export initial states
export { createInitialWorkspaceState, initialUiState };

// Export slice actions
export * from './workspaceSlice';
export * from './uiSlice';

// Export selectors
export * from './selectors';

// Export hooks
export * from './hooks';

// Export types
export type { WorkspaceState, UiState, SearchBarMode, StoreConfig, ThunkExtra } from './types';
