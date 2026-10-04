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
    expect(validateWorkspace(makeWorkspace())).toEqual([]);
  });

  it('accepts null for an optional field, as JSON gives it', () => {
    const workspace = makeWorkspace();
    expect(
      validateWorkspace({
        ...workspace,
        favoriteLayouts: null,
        tabs: [{ ...workspace.tabs[0], layoutId: null, locked: null }],
      })
    ).toEqual([]);
  });

  it('ignores a legacy theme key instead of validating it', () => {
    // theme was never populated by the sync middleware; it is a Dash prop.
    expect(validateWorkspace({ ...makeWorkspace(), theme: 'sepia' })).toEqual([]);
  });

  it('accepts a string serverSessionId and rejects other types', () => {
    expect(validateWorkspace({ ...makeWorkspace(), serverSessionId: 'abc' })).toEqual([]);
    expect(validateWorkspace({ ...makeWorkspace(), serverSessionId: null })).toEqual([]);
    expect(validateWorkspace({ ...makeWorkspace(), serverSessionId: 42 })).toEqual([
      'serverSessionId: expected string or null',
    ]);
  });

  it('rejects a value that is not an object', () => {
    expect(validateWorkspace(null)).toEqual(['workspace: expected object']);
  });

  it('reports each field of a tab and a panel with the wrong type', () => {
    const workspace = makeWorkspace();
    const errors = validateWorkspace({
      ...workspace,
      tabs: [{ ...workspace.tabs[0], createdAt: 'yesterday' }],
      panel: { ...workspace.panel, children: [{ id: 7 }] },
    });

    expect(errors).toContain('tabs[0].createdAt: expected number');
    expect(errors).toContain('panel.children[0].id: expected string');
  });

  it('reports tabs that are not listed in panelTabs', () => {
    const workspace = makeWorkspace();
    workspace.panelTabs = { [PANEL_1]: [] };

    expect(validateWorkspace(workspace)).toContain(
      `Tab '${TAB_1}' exists in tabs but not in any panelTabs list`
    );
  });

  it('reports an activePanelId that is not a leaf panel', () => {
    expect(validateWorkspace({ ...makeWorkspace(), activePanelId: 'nope' })).toEqual([
      "activePanelId 'nope' is not a valid leaf panel",
    ]);
  });
});
