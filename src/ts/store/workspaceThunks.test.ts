// Tests for the limit policy of the workspace thunks: addTab, duplicateTab, splitPanel,
// switchToOpenTab and the two limit checks.

import { describe, it, expect, vi } from 'vitest';
import { moveTab, switchToOpenTab } from './workspaceSlice';
import { addTab, duplicateTab, splitPanel, canAddTab, canAddPanel } from './workspaceThunks';
import type { WorkspaceState } from './types';
import { countLeafPanels } from '@utils/panels';
import {
  createTestStore,
  getTab,
  getWorkspace,
  makeTab,
  makeWorkspace,
  PANEL_1,
  PANEL_2,
  TAB_1,
  TAB_2,
  TAB_3,
} from './testing';
import { MAX_LEAF_PANELS } from '@constants/panels';

describe('addTab', () => {
  it('adds a new tab to the specified panel', async () => {
    const store = createTestStore(makeWorkspace());
    const initialCount = getWorkspace(store).tabs.length;

    await store.dispatch(addTab({ panelId: PANEL_1, name: 'New Tab' }));

    expect(getWorkspace(store).tabs.length).toBe(initialCount + 1);
    const newTab = getWorkspace(store).tabs[1];
    expect(newTab.name).toBe('New Tab');
    expect(newTab.panelId).toBe(PANEL_1);
  });

  it('adds tab to panelTabs tracking', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(addTab({ panelId: PANEL_1 }));

    const newTabId = getWorkspace(store).tabs[1].id;
    expect(getWorkspace(store).panelTabs[PANEL_1]).toContain(newTabId);
  });

  it('sets new tab as active', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(addTab({ panelId: PANEL_1 }));

    const newTabId = getWorkspace(store).tabs[1].id;
    expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe(newTabId);
    expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
  });

  it('creates tab with layoutId when provided', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(
      addTab({
        panelId: PANEL_1,
        name: 'Chart Tab',
        layoutId: 'chart-layout',
        params: { type: 'bar' },
      })
    );

    const newTab = getWorkspace(store).tabs[1];
    expect(newTab.layoutId).toBe('chart-layout');
    expect(newTab.layoutParams).toEqual({ type: 'bar' });
  });

  it('generates unique mountKey for new tabs', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(addTab({ panelId: PANEL_1 }));

    const newTab = getWorkspace(store).tabs[1];
    expect(newTab.mountKey).toBeDefined();
    expect(newTab.mountKey).not.toBe(getWorkspace(store).tabs[0].mountKey);
  });
});

describe('duplicateTab', () => {
  it('creates a copy of the tab', async () => {
    const state = makeWorkspace();
    state.tabs[0].layoutId = 'test-layout';
    state.tabs[0].layoutParams = { foo: 'bar' };
    const store = createTestStore(state);

    await store.dispatch(duplicateTab({ tabId: TAB_1 }));

    expect(getWorkspace(store).tabs.length).toBe(2);
    const duplicate = getWorkspace(store).tabs[1];
    expect(duplicate.name).toBe(`${TAB_1} (copy)`);
    expect(duplicate.layoutId).toBe('test-layout');
    expect(duplicate.layoutParams).toEqual({ foo: 'bar' });
    expect(duplicate.id).not.toBe(TAB_1);
  });

  it('duplicated tab is not locked even if original was', async () => {
    const state = makeWorkspace();
    state.tabs[0].locked = true;
    const store = createTestStore(state);

    await store.dispatch(duplicateTab({ tabId: TAB_1 }));

    const duplicate = getWorkspace(store).tabs[1];
    expect(duplicate.locked).toBe(false);
  });

  it('adds duplicate to same panel as original', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(duplicateTab({ tabId: TAB_1 }));

    const duplicate = getWorkspace(store).tabs[1];
    expect(duplicate.panelId).toBe(PANEL_1);
    expect(getWorkspace(store).panelTabs[PANEL_1]).toContain(duplicate.id);
  });

  it('creates independent copy of layoutParams', async () => {
    const state = makeWorkspace();
    state.tabs[0].layoutParams = { key: 'original' };
    const store = createTestStore(state);

    await store.dispatch(duplicateTab({ tabId: TAB_1 }));

    const duplicate = getWorkspace(store).tabs[1];
    expect(duplicate.layoutParams).toEqual({ key: 'original' });
    expect(duplicate.layoutParams).not.toBe(state.tabs[0].layoutParams);
  });

  it('rejects when tab does not exist', async () => {
    const store = createTestStore(makeWorkspace());
    const tabCountBefore = getWorkspace(store).tabs.length;

    const result = await store.dispatch(duplicateTab({ tabId: 'nonexistent' }));

    expect(result.type).toBe('workspace/duplicateTab/rejected');
    expect(getWorkspace(store).tabs.length).toBe(tabCountBefore);
  });
});

describe('splitPanel', () => {
  it('creates two child panels from one', async () => {
    const store = createTestStore(makeWorkspace());

    // Add a second tab so we can split
    await store.dispatch(addTab({ panelId: PANEL_1, name: 'Tab 2' }));
    const tab2Id = getWorkspace(store).tabs[1].id;

    await store.dispatch(
      splitPanel({
        panelId: PANEL_1,
        direction: 'horizontal',
        tabId: tab2Id,
      })
    );

    expect(countLeafPanels(getWorkspace(store).panel)).toBe(2);
  });

  it('preserves original panel ID', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(addTab({ panelId: PANEL_1 }));
    const tab2Id = getWorkspace(store).tabs[1].id;

    await store.dispatch(
      splitPanel({
        panelId: PANEL_1,
        direction: 'horizontal',
        tabId: tab2Id,
      })
    );

    const panel = getWorkspace(store).panel;
    const hasOriginalPanelId = panel.children.some((c) => c.id === PANEL_1);
    expect(hasOriginalPanelId).toBe(true);
  });

  it('moves tab to new panel', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(addTab({ panelId: PANEL_1, name: 'Tab 2' }));
    const tab2Id = getWorkspace(store).tabs[1].id;

    await store.dispatch(
      splitPanel({
        panelId: PANEL_1,
        direction: 'horizontal',
        tabId: tab2Id,
      })
    );

    const tab2 = getTab(store, tab2Id);
    expect(tab2?.panelId).not.toBe(PANEL_1);
    expect(getWorkspace(store).panelTabs[PANEL_1]).not.toContain(tab2Id);
  });

  it('rejects a split of a panel that is not in the tree and tells the user', async () => {
    const notify = vi.fn();
    const store = createTestStore(makeWorkspace(), { notify });
    await store.dispatch(addTab({ panelId: PANEL_1 }));
    const before = getWorkspace(store);

    const result = await store.dispatch(
      splitPanel({ panelId: 'missing', direction: 'horizontal', tabId: before.tabs[1].id })
    );

    expect(splitPanel.rejected.match(result)).toBe(true);
    expect(getWorkspace(store)).toBe(before);
    expect(notify).toHaveBeenCalledExactlyOnceWith('error', 'Cannot split: panel not found');
  });

  it('rejects a split of a panel that is not a leaf and tells the user', async () => {
    const notify = vi.fn();
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]), { notify });
    const before = getWorkspace(store);

    const result = await store.dispatch(
      splitPanel({ panelId: before.panel.id, direction: 'horizontal', tabId: TAB_1 })
    );

    expect(splitPanel.rejected.match(result)).toBe(true);
    expect(getWorkspace(store)).toBe(before);
    expect(notify).toHaveBeenCalledExactlyOnceWith('error', 'Cannot split a non-leaf panel');
  });

  it('does not split panel with only one tab', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(
      splitPanel({
        panelId: PANEL_1,
        direction: 'horizontal',
        tabId: TAB_1,
      })
    );

    expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
  });

  it('respects position=before for left/top placement', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(addTab({ panelId: PANEL_1 }));
    const tab2Id = getWorkspace(store).tabs[1].id;

    await store.dispatch(
      splitPanel({
        panelId: PANEL_1,
        direction: 'horizontal',
        tabId: tab2Id,
        position: 'before',
      })
    );

    const tab2 = getTab(store, tab2Id);
    const newPanelId = tab2?.panelId;
    const panel = getWorkspace(store).panel;
    const newPanel = panel.children.find((c) => c.id === newPanelId);

    expect(newPanel?.order).toBe(0);
  });
});

describe('maxTabs enforcement', () => {
  function createStateWithTabs(tabCount: number): WorkspaceState {
    return makeWorkspace([Array.from({ length: tabCount }, (_, i) => `tab-${i}`)]);
  }

  describe('addTab with maxTabs', () => {
    it('blocks addTab when at maxTabs limit', async () => {
      const store = createTestStore(createStateWithTabs(3), { maxTabs: 3 });

      await store.dispatch(addTab({ panelId: PANEL_1, name: 'New Tab' }));

      expect(getWorkspace(store).tabs.length).toBe(3);
    });

    it('allows addTab when below maxTabs limit', async () => {
      const store = createTestStore(createStateWithTabs(3), { maxTabs: 5 });

      await store.dispatch(addTab({ panelId: PANEL_1, name: 'New Tab' }));

      expect(getWorkspace(store).tabs.length).toBe(4);
    });

    it('allows unlimited tabs when maxTabs is 0', async () => {
      const store = createTestStore(createStateWithTabs(100), { maxTabs: 0 });

      await store.dispatch(addTab({ panelId: PANEL_1, name: 'New Tab' }));

      expect(getWorkspace(store).tabs.length).toBe(101);
    });

    it('allows unlimited tabs when maxTabs is negative', async () => {
      const store = createTestStore(createStateWithTabs(50), { maxTabs: -1 });

      await store.dispatch(addTab({ panelId: PANEL_1, name: 'New Tab' }));

      expect(getWorkspace(store).tabs.length).toBe(51);
    });
  });

  describe('duplicateTab with maxTabs', () => {
    it('blocks duplicateTab when at maxTabs limit', async () => {
      const store = createTestStore(createStateWithTabs(3), { maxTabs: 3 });

      await store.dispatch(duplicateTab({ tabId: 'tab-0' }));

      expect(getWorkspace(store).tabs.length).toBe(3);
    });

    it('allows duplicateTab when below maxTabs limit', async () => {
      const store = createTestStore(createStateWithTabs(3), { maxTabs: 5 });

      await store.dispatch(duplicateTab({ tabId: 'tab-0' }));

      expect(getWorkspace(store).tabs.length).toBe(4);
      expect(getWorkspace(store).tabs[3].name).toBe('tab-0 (copy)');
    });

    it('allows unlimited tabs when maxTabs is 0 (via duplicate)', async () => {
      const store = createTestStore(createStateWithTabs(100), { maxTabs: 0 });

      await store.dispatch(duplicateTab({ tabId: 'tab-0' }));

      expect(getWorkspace(store).tabs.length).toBe(101);
    });
  });

  describe('addTab with allowMultiple constraint', () => {
    it('blocks addTab when allowMultiple=false and layout already open', async () => {
      const state = makeWorkspace([[TAB_1]], {
        tabs: [makeTab(TAB_1, PANEL_1, { name: 'Analytics', layoutId: 'analytics' })],
      });
      const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
      const store = createTestStore(state, { registeredLayouts: layouts });

      await store.dispatch(addTab({ panelId: PANEL_1, layoutId: 'analytics', name: 'Analytics' }));

      // Tab should not be added
      expect(getWorkspace(store).tabs.length).toBe(1);
    });

    it('allows addTab when allowMultiple=false and layout not yet open', async () => {
      const state = makeWorkspace();
      const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
      const store = createTestStore(state, { registeredLayouts: layouts });

      await store.dispatch(addTab({ panelId: PANEL_1, layoutId: 'analytics', name: 'Analytics' }));

      expect(getWorkspace(store).tabs.length).toBe(2);
      expect(getWorkspace(store).tabs[1].layoutId).toBe('analytics');
    });

    it('allows addTab when allowMultiple=true even if layout already open', async () => {
      const state = makeWorkspace([[TAB_1]], {
        tabs: [makeTab(TAB_1, PANEL_1, { name: 'Chart', layoutId: 'chart' })],
      });
      const layouts = { chart: { name: 'Chart', allowMultiple: true } };
      const store = createTestStore(state, { registeredLayouts: layouts });

      await store.dispatch(addTab({ panelId: PANEL_1, layoutId: 'chart', name: 'Chart 2' }));

      expect(getWorkspace(store).tabs.length).toBe(2);
    });

    it('allows addTab without layoutId (blank tab) regardless of constraints', async () => {
      const store = createTestStore();

      await store.dispatch(addTab({ panelId: getWorkspace(store).activePanelId }));

      expect(getWorkspace(store).tabs.length).toBe(2);
    });
  });

  describe('switchToOpenTab', () => {
    function twoPanelStateWithOpenLayout(): WorkspaceState {
      const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
      state.tabs[0].layoutId = 'analytics';
      return state;
    }

    it('activates the open tab of a single-instance layout and tells the user', () => {
      const state = twoPanelStateWithOpenLayout();
      state.activePanelId = PANEL_2;
      const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
      const notify = vi.fn();
      const store = createTestStore(state, { registeredLayouts: layouts, notify });

      const switched = store.dispatch(switchToOpenTab('analytics'));

      expect(switched).toBe(true);
      expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
      expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe(TAB_1);
      expect(notify).toHaveBeenCalledExactlyOnceWith(
        'info',
        'Layout "Analytics" is already open. Switching to it.'
      );
    });

    it('does nothing for a layout that allows several tabs', () => {
      const layouts = { analytics: { name: 'Analytics', allowMultiple: true } };
      const store = createTestStore(twoPanelStateWithOpenLayout(), {
        registeredLayouts: layouts,
      });
      const before = getWorkspace(store);

      expect(store.dispatch(switchToOpenTab('analytics'))).toBe(false);
      expect(getWorkspace(store)).toBe(before);
    });

    it('does nothing when no tab shows the layout or the layout is unknown', () => {
      const layouts = { other: { name: 'Other', allowMultiple: false } };
      const store = createTestStore(twoPanelStateWithOpenLayout(), {
        registeredLayouts: layouts,
      });

      expect(store.dispatch(switchToOpenTab('other'))).toBe(false);
      expect(store.dispatch(switchToOpenTab('unknown'))).toBe(false);
    });
  });

  describe('a layout without allowMultiple', () => {
    // The registry always sends allowMultiple. If it is missing, every layer reads it as false.
    const layouts = { analytics: { name: 'Analytics' } };
    const openAnalytics = () =>
      makeWorkspace([[TAB_1]], {
        tabs: [makeTab(TAB_1, PANEL_1, { name: 'Analytics', layoutId: 'analytics' })],
      });

    it('blocks addTab and duplicateTab like allowMultiple=false', async () => {
      const store = createTestStore(openAnalytics(), { registeredLayouts: layouts });

      await store.dispatch(addTab({ panelId: PANEL_1, layoutId: 'analytics' }));
      await store.dispatch(duplicateTab({ tabId: TAB_1 }));

      expect(getWorkspace(store).tabs.length).toBe(1);
    });

    it('lets switchToOpenTab switch to the open tab', () => {
      const store = createTestStore(openAnalytics(), { registeredLayouts: layouts });

      expect(store.dispatch(switchToOpenTab('analytics'))).toBe(true);
    });
  });

  describe('duplicateTab with allowMultiple constraint', () => {
    it('blocks duplicateTab when allowMultiple=false', async () => {
      const state = makeWorkspace([[TAB_1]], {
        tabs: [makeTab(TAB_1, PANEL_1, { name: 'Analytics', layoutId: 'analytics' })],
      });
      const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
      const store = createTestStore(state, { registeredLayouts: layouts });

      await store.dispatch(duplicateTab({ tabId: TAB_1 }));

      expect(getWorkspace(store).tabs.length).toBe(1);
    });

    it('allows duplicateTab when allowMultiple=true', async () => {
      const state = makeWorkspace([[TAB_1]], {
        tabs: [makeTab(TAB_1, PANEL_1, { name: 'Chart', layoutId: 'chart' })],
      });
      const layouts = { chart: { name: 'Chart', allowMultiple: true } };
      const store = createTestStore(state, { registeredLayouts: layouts });

      await store.dispatch(duplicateTab({ tabId: TAB_1 }));

      expect(getWorkspace(store).tabs.length).toBe(2);
    });
  });

  describe('moveTab does not check maxTabs', () => {
    it('allows moveTab regardless of tab count', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]), { maxTabs: 2 });

      store.dispatch(moveTab({ tabId: TAB_1, targetPanelId: PANEL_2 }));

      expect(getWorkspace(store).tabs.length).toBe(3);
      const movedTab = getTab(store, TAB_1);
      expect(movedTab?.panelId).toBe(PANEL_2);
    });
  });
});

describe('MAX_LEAF_PANELS enforcement', () => {
  /** Builds one tab in each panel, and a second tab 'extra-tab' in panel-1 to split off. */
  function createStateWithManyPanels(panelCount: number): WorkspaceState {
    return makeWorkspace(
      Array.from({ length: panelCount }, (_, i) =>
        i === 0 ? ['tab-0', 'extra-tab'] : [`tab-${i}`]
      )
    );
  }

  it('rejects a split at the panel limit and tells the user', async () => {
    const notify = vi.fn();
    const store = createTestStore(createStateWithManyPanels(MAX_LEAF_PANELS), { notify });
    const before = getWorkspace(store);

    const result = await store.dispatch(
      splitPanel({ panelId: PANEL_1, direction: 'horizontal', tabId: 'extra-tab' })
    );

    expect(splitPanel.rejected.match(result)).toBe(true);
    expect(getWorkspace(store)).toBe(before);
    expect(notify).toHaveBeenCalledExactlyOnceWith(
      'warning',
      `Cannot split: maximum of ${MAX_LEAF_PANELS} panels reached`,
      expect.any(String)
    );
  });

  it('reads the limit from the thunk extra argument (maxPanels prop)', async () => {
    const store = createTestStore(createStateWithManyPanels(2), { maxPanels: 2 });
    const before = getWorkspace(store);

    await store.dispatch(
      splitPanel({ panelId: PANEL_1, direction: 'horizontal', tabId: 'extra-tab' })
    );

    expect(getWorkspace(store)).toBe(before);
  });

  it('treats maxPanels below 1 as unlimited', async () => {
    const store = createTestStore(createStateWithManyPanels(MAX_LEAF_PANELS), { maxPanels: 0 });

    await store.dispatch(
      splitPanel({ panelId: PANEL_1, direction: 'horizontal', tabId: 'extra-tab' })
    );

    expect(Object.keys(getWorkspace(store).panelTabs)).toHaveLength(MAX_LEAF_PANELS + 1);
  });

  it('allows split when below MAX_LEAF_PANELS limit', async () => {
    const store = createTestStore(createStateWithManyPanels(MAX_LEAF_PANELS - 1));
    const leafCountBefore = countLeafPanels(getWorkspace(store).panel);

    await store.dispatch(
      splitPanel({ panelId: PANEL_1, direction: 'horizontal', tabId: 'extra-tab' })
    );

    expect(countLeafPanels(getWorkspace(store).panel)).toBe(leafCountBefore + 1);
  });
});

describe('async thunk rejections', () => {
  it('addTab.rejected does not modify state', async () => {
    const store = createTestStore(makeWorkspace(), { maxTabs: 1 }); // maxTabs = 1, already has 1 tab
    const stateBefore = getWorkspace(store);

    const result = await store.dispatch(addTab({ panelId: PANEL_1 }));

    expect(result.type).toBe('workspace/addTab/rejected');
    expect(getWorkspace(store).tabs).toEqual(stateBefore.tabs);
  });

  it('duplicateTab.rejected does not modify state', async () => {
    const store = createTestStore(makeWorkspace(), { maxTabs: 1 });
    const stateBefore = getWorkspace(store);

    const result = await store.dispatch(duplicateTab({ tabId: TAB_1 }));

    expect(result.type).toBe('workspace/duplicateTab/rejected');
    expect(getWorkspace(store).tabs).toEqual(stateBefore.tabs);
  });
});

describe('canAddTab', () => {
  it('treats a limit below 1 as unlimited', () => {
    expect(canAddTab(5, 0)).toBe(true);
    expect(canAddTab(5, -1)).toBe(true);
  });

  it('allows a tab only below the limit', () => {
    expect(canAddTab(1, 2)).toBe(true);
    expect(canAddTab(2, 2)).toBe(false);
  });
});

describe('canAddPanel', () => {
  it('treats a limit below 1 as unlimited', () => {
    expect(canAddPanel(5, 0)).toBe(true);
    expect(canAddPanel(5, -1)).toBe(true);
  });

  it('allows a panel only below the limit', () => {
    expect(canAddPanel(1, 2)).toBe(true);
    expect(canAddPanel(2, 2)).toBe(false);
  });
});
