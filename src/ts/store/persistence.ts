// Persistence of the workspace: the storage keys, the storage engines, the version of the stored
// format with its migrations, and the removal of a stored workspace.
import type { MigrationManifest, Storage } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import storageSession from 'redux-persist/lib/storage/session';
import type { PersistenceType } from '@types';
import { generateShortId } from '@utils/uuid';

/** Gives the start of every workspace persistence key. */
const WORKSPACE_PERSIST_PREFIX = 'prism-workspace';

/**
 * Builds the redux-persist config key of a workspace, the key that `persistReducer` gets.
 * Without `componentId`, the key is the prefix alone. redux-persist adds its own `persist:`
 * prefix when it writes to the storage.
 */
export function getWorkspacePersistKey(componentId?: string): string {
  return componentId ? `${WORKSPACE_PERSIST_PREFIX}-${componentId}` : WORKSPACE_PERSIST_PREFIX;
}

/**
 * Builds the full storage key as it appears in localStorage or sessionStorage. Use it to read
 * or remove the stored workspace without redux-persist.
 */
export function getWorkspaceStorageKey(componentId?: string): string {
  return `persist:${getWorkspacePersistKey(componentId)}`;
}

/**
 * Resolves the storage engine that the store uses.
 *
 * `persistence` is the on/off switch (as in Dash core components) and
 * `persistence_type` only selects where to store when it is on. With
 * `persistence=false` nothing may be written, whatever `persistence_type` says.
 */
export function resolvePersistenceType(
  persistence: boolean,
  persistenceType: PersistenceType
): PersistenceType {
  return persistence ? persistenceType : 'memory';
}

/** Stores nothing. The 'memory' type keeps the workspace in the store only. */
const memoryStorage: Storage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

/** Gives the redux-persist storage engine of a persistence type. */
export function getStorage(type: PersistenceType): Storage {
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

/**
 * Removes the stored workspace of a Prism from the storage that `persistenceType` selects. The
 * 'memory' type stores nothing, so there is nothing to remove.
 */
export function clearPersistedWorkspace(
  componentId: string | undefined,
  persistenceType: PersistenceType
): void {
  const key = getWorkspaceStorageKey(componentId);
  try {
    if (persistenceType === 'local') localStorage.removeItem(key);
    else if (persistenceType === 'session') sessionStorage.removeItem(key);
  } catch {
    // The browser can block storage access, for example in a sandboxed iframe. Then nothing was
    // stored either.
  }
}

/** Gives the version of the stored format. Add a migration to `migrations` with each increase. */
export const PERSIST_VERSION = 2;

/**
 * Upgrades a stored workspace of an older version. Each key is a version, and its function
 * changes the state of the version before it into that version.
 */
export const migrations: MigrationManifest = {
  // Version 1: the first Redux format. Every tab gets a mountKey, and favoriteLayouts exists.
  // A stored payload of an older version has no static shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  1: (state: any) => {
    if (!state || typeof state !== 'object') return state;

    const tabs =
      state.tabs?.map((tab: Record<string, unknown>) => ({
        ...tab,
        mountKey: tab.mountKey ?? generateShortId(),
      })) ?? [];

    return {
      ...state,
      tabs,
      favoriteLayouts: state.favoriteLayouts ?? [],
    };
  },

  // Version 2: the stored payload is redux-undo's `present` only, under a single `present` key
  // (persistReducer wraps undoable(), see createPrismStore). Wrap the old flat workspace object.
  // A stored payload of an older version has no static shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  2: (state: any) => {
    if (!state || typeof state !== 'object') return state;
    if ('present' in state) return state;
    const { _persist, ...present } = state;
    return { present };
  },
};
