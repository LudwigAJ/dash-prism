/**
 * Regression tests for persistence key helpers.
 *
 * The original bug: clearPersistedState in usePrism.ts used a hardcoded key
 * that didn't include the componentId, so it never actually cleared the
 * persisted workspace for named Prism instances. A second bug existed in
 * PrismComponent.tsx where the 'persist:' prefix (added by redux-persist)
 * was missing entirely.
 *
 * These tests ensure the key helpers produce the correct format and stay
 * consistent — since the same key must be used when writing (redux-persist
 * config) and clearing (manual localStorage.removeItem).
 */

import { describe, it, expect } from 'vitest';
import { getWorkspacePersistKey, getWorkspaceStorageKey } from './index';

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
