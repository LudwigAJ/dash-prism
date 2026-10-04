/**
 * Tests for the persistence helpers. The key helpers must give the same key for the write
 * (the redux-persist config) and for the removal (`clearPersistedWorkspace`). A key without the
 * componentId, or without the `persist:` prefix of redux-persist, once made a reset leave the
 * stored workspace in place.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  clearPersistedWorkspace,
  getStorage,
  getWorkspacePersistKey,
  getWorkspaceStorageKey,
  migrations,
  resolvePersistenceType,
} from './persistence';

describe('getWorkspacePersistKey', () => {
  it('returns base key when no componentId is provided', () => {
    expect(getWorkspacePersistKey()).toBe('prism-workspace');
    expect(getWorkspacePersistKey(undefined)).toBe('prism-workspace');
  });

  it('includes componentId in the key', () => {
    expect(getWorkspacePersistKey('my-prism')).toBe('prism-workspace-my-prism');
  });

  it('handles various componentId formats', () => {
    expect(getWorkspacePersistKey('workspace-1')).toBe('prism-workspace-workspace-1');
    expect(getWorkspacePersistKey('a')).toBe('prism-workspace-a');
  });
});

describe('getWorkspaceStorageKey', () => {
  it('adds persist: prefix for default key', () => {
    expect(getWorkspaceStorageKey()).toBe('persist:prism-workspace');
  });

  it('adds persist: prefix with componentId', () => {
    expect(getWorkspaceStorageKey('my-prism')).toBe('persist:prism-workspace-my-prism');
  });

  it('is consistent with getWorkspacePersistKey (persist: prefix)', () => {
    const componentId = 'test-component';
    const persistKey = getWorkspacePersistKey(componentId);
    const storageKey = getWorkspaceStorageKey(componentId);
    expect(storageKey).toBe(`persist:${persistKey}`);
  });

  it('is consistent for the default (no componentId) case', () => {
    const persistKey = getWorkspacePersistKey();
    const storageKey = getWorkspaceStorageKey();
    expect(storageKey).toBe(`persist:${persistKey}`);
  });
});

describe('resolvePersistenceType', () => {
  it('returns memory whenever persistence is off, regardless of persistence_type', () => {
    expect(resolvePersistenceType(false, 'local')).toBe('memory');
    expect(resolvePersistenceType(false, 'session')).toBe('memory');
    expect(resolvePersistenceType(false, 'memory')).toBe('memory');
  });

  it('passes persistence_type through when persistence is on', () => {
    expect(resolvePersistenceType(true, 'local')).toBe('local');
    expect(resolvePersistenceType(true, 'session')).toBe('session');
    expect(resolvePersistenceType(true, 'memory')).toBe('memory');
  });
});

describe('clearPersistedWorkspace', () => {
  function stubStorages() {
    const local = { removeItem: vi.fn() };
    const session = { removeItem: vi.fn() };
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    return { local, session };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes the key from the storage that the persistence type selects', () => {
    const { local, session } = stubStorages();

    clearPersistedWorkspace('my-prism', 'session');

    expect(session.removeItem).toHaveBeenCalledWith('persist:prism-workspace-my-prism');
    expect(local.removeItem).not.toHaveBeenCalled();
  });

  it('touches no storage for the memory type', () => {
    const { local, session } = stubStorages();

    clearPersistedWorkspace('my-prism', 'memory');

    expect(local.removeItem).not.toHaveBeenCalled();
    expect(session.removeItem).not.toHaveBeenCalled();
  });

  it('ignores a storage that the browser blocks', () => {
    vi.stubGlobal('localStorage', {
      removeItem: () => {
        throw new Error('SecurityError');
      },
    });

    expect(() => {
      clearPersistedWorkspace('my-prism', 'local');
    }).not.toThrow();
  });
});

describe('getStorage', () => {
  it('stores nothing for the memory type', async () => {
    const memory = getStorage('memory');
    await memory.setItem('key', 'value');

    expect(await memory.getItem('key')).toBeNull();
  });
});

// A migration gets a payload of an older format, which the PersistedState type of redux-persist
// does not describe, so the tests cast their payloads.
describe('migrations', () => {
  it('version 1 gives each tab a mountKey and adds favoriteLayouts', () => {
    const migrated = migrations[1]({
      tabs: [{ id: 't1' }, { id: 't2', mountKey: 'kept' }],
      _persist: { version: 0, rehydrated: false },
    } as never);

    expect(migrated).toMatchObject({
      tabs: [
        { id: 't1', mountKey: expect.any(String) },
        { id: 't2', mountKey: 'kept' },
      ],
      favoriteLayouts: [],
    });
  });

  it('version 2 wraps a flat workspace in present and drops the old _persist', () => {
    const migrated = migrations[2]({
      tabs: [],
      _persist: { version: 1, rehydrated: true },
    } as never);

    expect(migrated).toEqual({ present: { tabs: [] } });
  });

  it('version 2 keeps a payload that already has present', () => {
    const payload = { present: { tabs: [] }, _persist: { version: 2, rehydrated: true } };

    expect(migrations[2](payload as never)).toBe(payload);
  });
});
