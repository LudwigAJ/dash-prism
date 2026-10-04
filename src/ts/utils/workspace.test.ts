/**
 * Unit tests for validateWorkspace. It checks the resulting store state after
 * `persist/REHYDRATE` (always) and after workspace actions in development;
 * `updateWorkspace` payloads pushed from Dash are healed by `syncWorkspace`,
 * not validated here.
 */

import { describe, it, expect } from 'vitest';
import { makeWorkspace, PANEL_1, TAB_1 } from '@store/testing';
import { validateWorkspace } from './workspace';

describe('validateWorkspace', () => {
  it('accepts a minimal valid workspace', () => {
    const result = validateWorkspace(makeWorkspace());
    expect(result.ok).toBe(true);
  });

  it('ignores a legacy theme key instead of validating it', () => {
    // theme was never populated by the sync middleware; it is a Dash prop.
    const result = validateWorkspace({ ...makeWorkspace(), theme: 'sepia' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect('theme' in result.workspace).toBe(false);
    }
  });

  it('accepts a string serverSessionId and rejects other types', () => {
    expect(validateWorkspace({ ...makeWorkspace(), serverSessionId: 'abc' }).ok).toBe(true);
    expect(validateWorkspace({ ...makeWorkspace(), serverSessionId: null }).ok).toBe(true);
    const bad = validateWorkspace({ ...makeWorkspace(), serverSessionId: 42 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors).toContain('serverSessionId: expected string or null');
    }
  });

  it('reports tabs that are not listed in panelTabs', () => {
    const ws = makeWorkspace();
    ws.panelTabs = { [PANEL_1]: [] };
    const result = validateWorkspace(ws);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes(`Tab '${TAB_1}' exists in tabs but not`))).toBe(
        true
      );
    }
  });

  it('reports an activePanelId that is not a leaf panel', () => {
    const result = validateWorkspace({ ...makeWorkspace(), activePanelId: 'nope' });
    expect(result.ok).toBe(false);
  });
});
