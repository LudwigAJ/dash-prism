/**
 * Unit tests for validateWorkspace. It checks the resulting store state after
 * `persist/REHYDRATE` (always) and after workspace actions in development;
 * `updateWorkspace` payloads pushed from Dash are healed by `syncWorkspace`,
 * not validated here.
 */

import { describe, it, expect } from 'vitest';
import { validateWorkspace } from './workspace';

function validWorkspace(): Record<string, unknown> {
  return {
    tabs: [{ id: 't1', name: 'Tab', panelId: 'p1', createdAt: 1, mountKey: 'm1' }],
    panel: { id: 'p1', order: 0, direction: 'horizontal', children: [], size: '100%' },
    panelTabs: { p1: ['t1'] },
    activeTabIds: { p1: 't1' },
    activePanelId: 'p1',
    favoriteLayouts: [],
    searchBarsHidden: false,
  };
}

describe('validateWorkspace', () => {
  it('accepts a minimal valid workspace', () => {
    const result = validateWorkspace(validWorkspace());
    expect(result.ok).toBe(true);
  });

  it('ignores a legacy theme key instead of validating it (02 B-4)', () => {
    // theme was never populated by the sync middleware; it is a Dash prop.
    const result = validateWorkspace({ ...validWorkspace(), theme: 'sepia' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('theme' in result.workspace).toBe(false);
    }
  });

  it('accepts a string serverSessionId and rejects other types (02 B-2)', () => {
    expect(validateWorkspace({ ...validWorkspace(), serverSessionId: 'abc' }).ok).toBe(true);
    expect(validateWorkspace({ ...validWorkspace(), serverSessionId: null }).ok).toBe(true);
    const bad = validateWorkspace({ ...validWorkspace(), serverSessionId: 42 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors).toContain('serverSessionId: expected string or null');
    }
  });

  it('reports tabs that are not listed in panelTabs', () => {
    const ws = validWorkspace();
    ws.panelTabs = { p1: [] };
    const result = validateWorkspace(ws);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("Tab 't1' exists in tabs but not"))).toBe(true);
    }
  });

  it('reports an activePanelId that is not a leaf panel', () => {
    const result = validateWorkspace({ ...validWorkspace(), activePanelId: 'nope' });
    expect(result.ok).toBe(false);
  });
});
