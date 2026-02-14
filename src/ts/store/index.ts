// src/ts/store/index.ts
import { configureStore, combineReducers, ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
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
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import storageSession from 'redux-persist/lib/storage/session';
import undoable, { excludeAction, ActionCreators as UndoActionCreators } from 'redux-undo';

import workspaceReducer, { initialWorkspaceState } from './workspaceSlice';
import uiReducer, { initialUiState } from './uiSlice';
import { createDashSyncMiddleware, validationMiddleware } from './middleware/dashSyncMiddleware';
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

  // Version 2: Future migrations go here
  // 2: (state) => { ... },
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
  const { componentId, persistenceType, maxTabs, setProps, getRegisteredLayouts } = config;

  // Configure persistence for workspace slice only
  // Important: We persist the workspace reducer BEFORE wrapping with redux-undo
  // This ensures only the workspace state is persisted, not the undo history.
  // On page reload, undo history starts fresh.
  const workspacePersistConfig = {
    key: getWorkspacePersistKey(componentId),
    version: 1, // Increment this when adding new migrations
    storage: getStorage(persistenceType),
    migrate: createMigrate(migrations, { debug: process.env.NODE_ENV !== 'production' }),
  };

  // Persist workspace reducer, then wrap with redux-undo
  const persistedWorkspaceReducer = persistReducer(workspacePersistConfig, workspaceReducer);
  const undoablePersistedWorkspaceReducer = undoable(persistedWorkspaceReducer, {
    limit: 50,
    filter: excludeAction(UNDO_EXCLUDED_ACTIONS),
    groupBy: (action) => {
      if (action.type === 'workspace/renameTab') return 'rename';
      return null;
    },
    ignoreInitialState: true,
    syncFilter: true,
  });

  // Combine reducers
  const rootReducer = combineReducers({
    workspace: undoablePersistedWorkspaceReducer,
    ui: uiReducer,
  });

  // Create thunk extra argument
  const thunkExtra: ThunkExtra = {
    maxTabs,
    getRegisteredLayouts: getRegisteredLayouts ?? (() => ({})),
  };

  // Create dash sync middleware (returns middleware + cleanup function)
  const dashSync = createDashSyncMiddleware(setProps);

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
        .concat(validationMiddleware),
    devTools: process.env.NODE_ENV !== 'production',
  });

  // Create persistor
  const persistor = persistStore(store);

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

/**
 * Jump to a specific point in history.
 * @example dispatch(jump(-2)) // Go back 2 steps
 */
export const jump = UndoActionCreators.jump;

// =============================================================================
// Re-exports
// =============================================================================

// Export initial states
export { initialWorkspaceState, initialUiState };

// Export slice actions
export * from './workspaceSlice';
export * from './uiSlice';

// Export selectors
export * from './selectors';

// Export hooks
export * from './hooks';

// Export types
export type { WorkspaceState, UiState, SearchBarMode, StoreConfig, ThunkExtra } from './types';
