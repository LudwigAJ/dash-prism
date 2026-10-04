// Tests for healWorkspace on plain workspaces, without a store. The syncWorkspace tests in
// workspaceSlice.workspace.test.ts check the same rules through the reducer.

import { describe, it, expect } from 'vitest';
import { healWorkspace } from './workspaceHeal';
import {
  makeTab,
  makeWorkspace,
  PANEL_1,
  PANEL_2,
  ROOT_CONTAINER,
  TAB_1,
  TAB_2,
  TAB_3,
} from './testing';

describe('healWorkspace', () => {
  it('gives back the same arrays and objects for a consistent workspace', () => {
    const workspace = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);

    const healed = healWorkspace(workspace);

    expect(healed).toEqual(workspace);
    expect(healed.tabs).toBe(workspace.tabs);
    expect(healed.activeTabIds).toBe(workspace.activeTabIds);
  });

  it('does not change its input', () => {
    const workspace = makeWorkspace([[TAB_1]], { activePanelId: 'gone' });
    const copy = structuredClone(workspace);

    healWorkspace(workspace);

    expect(workspace).toEqual(copy);
  });

  it('drops a tab whose panel is not a leaf of the tree', () => {
    const workspace = makeWorkspace([[TAB_1]], {
      tabs: [makeTab(TAB_1, PANEL_1), makeTab(TAB_2, 'gone')],
    });

    expect(healWorkspace(workspace).tabs.map((tab) => tab.id)).toEqual([TAB_1]);
  });

  it('keeps the panelTabs order and drops unknown, foreign and repeated ids', () => {
    const workspace = makeWorkspace([[TAB_1, TAB_2], [TAB_3]], {
      panelTabs: { [PANEL_1]: [TAB_2, 'ghost', TAB_3, TAB_1, TAB_1], [PANEL_2]: [TAB_3] },
    });

    expect(healWorkspace(workspace).panelTabs).toEqual({
      [PANEL_1]: [TAB_2, TAB_1],
      [PANEL_2]: [TAB_3],
    });
  });

  it('appends a tab that its panel does not list, and rebuilds a missing list', () => {
    const workspace = makeWorkspace([[TAB_1, TAB_2], [TAB_3]], {
      panelTabs: { [PANEL_1]: [TAB_2] },
    });

    expect(healWorkspace(workspace).panelTabs).toEqual({
      [PANEL_1]: [TAB_2, TAB_1],
      [PANEL_2]: [TAB_3],
    });
  });

  it('drops the panelTabs entry of a panel that is not a leaf', () => {
    const workspace = makeWorkspace([[TAB_1], [TAB_2]]);
    workspace.panelTabs[ROOT_CONTAINER] = [TAB_1];

    expect(Object.keys(healWorkspace(workspace).panelTabs)).toEqual([PANEL_1, PANEL_2]);
  });

  it('moves an active tab that is not in its panel to the first tab of the panel', () => {
    const workspace = makeWorkspace([[TAB_1, TAB_2], [TAB_3]], {
      activeTabIds: { [PANEL_1]: TAB_3, [PANEL_2]: 'ghost' },
    });

    expect(healWorkspace(workspace).activeTabIds).toEqual({ [PANEL_1]: TAB_1, [PANEL_2]: TAB_3 });
  });

  it('drops the active tab of an empty panel and of a panel that is gone', () => {
    const workspace = makeWorkspace([[TAB_1], []], {
      activeTabIds: { [PANEL_1]: TAB_1, [PANEL_2]: TAB_1, gone: TAB_1 },
    });

    expect(healWorkspace(workspace).activeTabIds).toEqual({ [PANEL_1]: TAB_1 });
  });

  it('moves an active panel that is not a leaf to the first leaf panel', () => {
    const workspace = makeWorkspace([[TAB_1], [TAB_2]], { activePanelId: ROOT_CONTAINER });

    expect(healWorkspace(workspace).activePanelId).toBe(PANEL_1);
  });
});
