// Tests for the tab reducers of workspaceSlice, for the helpers that move a tab between panels,
// and for the invariants that a mix of tab and panel actions keeps.

import { describe, it, expect } from 'vitest';
import {
  removeTab,
  activateTab,
  renameTab,
  lockTab,
  unlockTab,
  toggleTabLock,
  updateTabLayout,
  moveTab,
  reorderTab,
  setTabIcon,
  setTabStyle,
  refreshTab,
  MAX_TAB_NAME_LENGTH,
  detachTab,
  attachTab,
} from './workspaceSlice';
import { addTab, duplicateTab, splitPanel } from './workspaceThunks';
import { countLeafPanels } from '@utils/panels';
import {
  createTestStore,
  getTab,
  getWorkspace,
  makeWorkspace,
  PANEL_1,
  PANEL_2,
  ROOT_CONTAINER,
  TAB_1,
  TAB_2,
  TAB_3,
} from './testing';

describe('detachTab', () => {
  it('takes the tab out of its panel and keeps it in tabs', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    detachTab(state, state.tabs[1]);

    expect(state.panelTabs[PANEL_1]).toEqual([TAB_1]);
    expect(state.tabs).toHaveLength(3);
    expect(state.tabs[1].panelId).toBe(PANEL_1);
  });

  it('activates the last remaining tab when the active tab leaves', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    state.panelTabs[PANEL_1].push('tab-x');
    detachTab(state, state.tabs[0]);

    expect(state.activeTabIds[PANEL_1]).toBe('tab-x');
  });

  it('leaves the active tab alone when another tab leaves', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    detachTab(state, state.tabs[1]);

    expect(state.activeTabIds[PANEL_1]).toBe(TAB_1);
  });

  it('clears the active tab of a panel that becomes empty', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    detachTab(state, state.tabs[2]);

    expect(state.panelTabs[PANEL_2]).toEqual([]);
    expect(state.activeTabIds[PANEL_2]).toBeUndefined();
  });
});

describe('attachTab', () => {
  it('appends the tab to the panel and focuses it', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    const tab = state.tabs[0];
    detachTab(state, tab);
    attachTab(state, tab, PANEL_2);

    expect(tab.panelId).toBe(PANEL_2);
    expect(state.panelTabs[PANEL_2]).toEqual([TAB_3, TAB_1]);
    expect(state.activeTabIds[PANEL_2]).toBe(TAB_1);
    expect(state.activePanelId).toBe(PANEL_2);
  });

  it('inserts at the index and clamps an index past the end', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    const [tab1, tab2] = state.tabs;
    detachTab(state, tab1);
    attachTab(state, tab1, PANEL_2, 0);
    detachTab(state, tab2);
    attachTab(state, tab2, PANEL_2, 99);

    expect(state.panelTabs[PANEL_2]).toEqual([TAB_1, TAB_3, TAB_2]);
  });

  it('creates the tab list of a panel that has none', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    const tab = state.tabs[2];
    detachTab(state, tab);
    delete state.panelTabs[PANEL_2];
    attachTab(state, tab, PANEL_2);

    expect(state.panelTabs[PANEL_2]).toEqual([TAB_3]);
  });
});

describe('removeTab', () => {
  it('removes tab from tabs array', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(removeTab({ tabId: TAB_1 }));

    expect(getWorkspace(store).tabs.length).toBe(2);
    expect(getTab(store, TAB_1)).toBeUndefined();
  });

  it('removes tab from panelTabs tracking', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(removeTab({ tabId: TAB_1 }));

    expect(getWorkspace(store).panelTabs[PANEL_1]).not.toContain(TAB_1);
  });

  it('does not remove locked tabs', () => {
    const state = makeWorkspace();
    state.tabs[0].locked = true;
    const store = createTestStore(state);

    store.dispatch(removeTab({ tabId: TAB_1 }));

    expect(getWorkspace(store).tabs.length).toBe(1);
    expect(getTab(store, TAB_1)).toBeDefined();
  });

  it('updates activeTabId when removing active tab', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));
    // tab-1 is active in panel-1

    store.dispatch(removeTab({ tabId: TAB_1 }));

    // Should select remaining tab in panel
    expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe(TAB_2);
  });

  it('is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace());
    const tabCountBefore = getWorkspace(store).tabs.length;

    store.dispatch(removeTab({ tabId: 'nonexistent' }));

    expect(getWorkspace(store).tabs.length).toBe(tabCountBefore);
  });
});

describe('moveTab', () => {
  it('moves tab between panels', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(moveTab({ tabId: TAB_1, targetPanelId: PANEL_2 }));

    const movedTab = getTab(store, TAB_1);
    expect(movedTab?.panelId).toBe(PANEL_2);
    expect(getWorkspace(store).panelTabs[PANEL_1]).not.toContain(TAB_1);
    expect(getWorkspace(store).panelTabs[PANEL_2]).toContain(TAB_1);
  });

  it('updates activeTabIds for both panels', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(moveTab({ tabId: TAB_1, targetPanelId: PANEL_2 }));

    expect(getWorkspace(store).activeTabIds[PANEL_2]).toBe(TAB_1);
    expect(getWorkspace(store).activePanelId).toBe(PANEL_2);
    expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe(TAB_2);
  });

  it('is a no-op when moving to same panel', () => {
    const store = createTestStore(makeWorkspace());
    const stateBefore = store.getState().workspace;

    store.dispatch(moveTab({ tabId: TAB_1, targetPanelId: PANEL_1 }));

    expect(store.getState().workspace).toEqual(stateBefore);
  });

  it('moves tab to specific index when provided', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(moveTab({ tabId: TAB_1, targetPanelId: PANEL_2, targetIndex: 0 }));

    expect(getWorkspace(store).panelTabs[PANEL_2][0]).toBe(TAB_1);
    expect(getWorkspace(store).panelTabs[PANEL_2][1]).toBe(TAB_3);
  });

  it('is a no-op when target panel does not exist', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));
    const stateBefore = getWorkspace(store);

    store.dispatch(
      moveTab({
        tabId: TAB_1,
        targetPanelId: 'nonexistent-panel',
      })
    );

    expect(getWorkspace(store)).toEqual(stateBefore);
  });

  it('is a no-op when target panel is a container (non-leaf)', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));
    const stateBefore = getWorkspace(store);

    // container-1 is the parent container, not a leaf panel
    store.dispatch(
      moveTab({
        tabId: TAB_1,
        targetPanelId: ROOT_CONTAINER,
      })
    );

    expect(getWorkspace(store)).toEqual(stateBefore);
  });

  it('is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));
    const stateBefore = store.getState().workspace;

    store.dispatch(moveTab({ tabId: 'nonexistent', targetPanelId: PANEL_2 }));

    expect(store.getState().workspace).toEqual(stateBefore);
  });

  it('initializes panelTabs for new target panel', () => {
    const state = makeWorkspace([[TAB_1], []]);
    delete state.panelTabs[PANEL_2];
    const store = createTestStore(state);

    store.dispatch(moveTab({ tabId: TAB_1, targetPanelId: PANEL_2 }));

    expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_1]);
  });
});

describe('reorderTab', () => {
  it('reorders tabs within a panel', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(reorderTab({ panelId: PANEL_1, fromIndex: 0, toIndex: 1 }));

    expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
  });

  it('clamps toIndex to valid range', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(reorderTab({ panelId: PANEL_1, fromIndex: 0, toIndex: 100 }));

    expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
  });

  it('ignores invalid fromIndex', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(reorderTab({ panelId: PANEL_1, fromIndex: -1, toIndex: 0 }));

    expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_1, TAB_2]);
  });
});

describe('renameTab', () => {
  it('renames the specified tab', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(renameTab({ tabId: TAB_1, name: 'Renamed Tab' }));

    expect(getTab(store, TAB_1)?.name).toBe('Renamed Tab');
  });

  it('truncates name to MAX_TAB_NAME_LENGTH', () => {
    const store = createTestStore(makeWorkspace());
    const longName = 'A'.repeat(MAX_TAB_NAME_LENGTH + 10);

    store.dispatch(renameTab({ tabId: TAB_1, name: longName }));

    expect(getTab(store, TAB_1)?.name.length).toBe(MAX_TAB_NAME_LENGTH);
  });

  it('is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace());
    const originalName = getTab(store, TAB_1)?.name;

    store.dispatch(renameTab({ tabId: 'nonexistent', name: 'New Name' }));

    expect(getTab(store, TAB_1)?.name).toBe(originalName);
  });

  it('handles empty string name', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(renameTab({ tabId: TAB_1, name: '' }));

    expect(getTab(store, TAB_1)?.name).toBe('');
  });
});

describe('lockTab / unlockTab / toggleTabLock', () => {
  it('lockTab locks a tab', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(lockTab({ tabId: TAB_1 }));

    expect(getTab(store, TAB_1)?.locked).toBe(true);
  });

  it('unlockTab unlocks a tab', () => {
    const state = makeWorkspace();
    state.tabs[0].locked = true;
    const store = createTestStore(state);

    store.dispatch(unlockTab({ tabId: TAB_1 }));

    expect(getTab(store, TAB_1)?.locked).toBe(false);
  });

  it('toggleTabLock toggles lock state', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(toggleTabLock({ tabId: TAB_1 }));
    expect(getTab(store, TAB_1)?.locked).toBe(true);

    store.dispatch(toggleTabLock({ tabId: TAB_1 }));
    expect(getTab(store, TAB_1)?.locked).toBe(false);
  });

  it('lockTab is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(lockTab({ tabId: 'nonexistent' }));

    // No error thrown, existing tabs unaffected
    expect(getTab(store, TAB_1)?.locked).toBeFalsy();
  });

  it('unlockTab is a no-op when tab does not exist', () => {
    const state = makeWorkspace();
    state.tabs[0].locked = true;
    const store = createTestStore(state);

    store.dispatch(unlockTab({ tabId: 'nonexistent' }));

    // Existing tab still locked
    expect(getTab(store, TAB_1)?.locked).toBe(true);
  });
});

describe('setTabIcon / setTabStyle', () => {
  it('setTabIcon sets the tab icon', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(setTabIcon({ tabId: TAB_1, icon: 'Star' }));

    expect(getTab(store, TAB_1)?.icon).toBe('Star');
  });

  it('setTabStyle sets the tab style', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(setTabStyle({ tabId: TAB_1, style: 'blue' }));

    expect(getTab(store, TAB_1)?.style).toBe('blue');
  });

  it('setTabIcon is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(setTabIcon({ tabId: 'nonexistent', icon: 'Star' }));

    expect(getTab(store, TAB_1)?.icon).toBeUndefined();
  });

  it('setTabStyle is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(setTabStyle({ tabId: 'nonexistent', style: 'blue' }));

    expect(getTab(store, TAB_1)?.style).toBeUndefined();
  });

  it('setTabIcon clears icon when undefined', () => {
    const state = makeWorkspace();
    state.tabs[0].icon = 'Star';
    const store = createTestStore(state);

    store.dispatch(setTabIcon({ tabId: TAB_1, icon: undefined }));

    expect(getTab(store, TAB_1)?.icon).toBeUndefined();
  });
});

describe('refreshTab', () => {
  it('updates mountKey to trigger remount', () => {
    const state = makeWorkspace();
    state.tabs[0].layoutId = 'test-layout';
    const originalMountKey = state.tabs[0].mountKey;
    const store = createTestStore(state);

    store.dispatch(refreshTab({ tabId: TAB_1 }));

    expect(getTab(store, TAB_1)?.mountKey).not.toBe(originalMountKey);
  });

  it('does nothing for tabs without layoutId', () => {
    const state = makeWorkspace();
    state.tabs[0].layoutId = undefined;
    const originalMountKey = state.tabs[0].mountKey;
    const store = createTestStore(state);

    store.dispatch(refreshTab({ tabId: TAB_1 }));

    expect(getTab(store, TAB_1)?.mountKey).toBe(originalMountKey);
  });

  it('is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace());
    const originalMountKey = getTab(store, TAB_1)?.mountKey;

    store.dispatch(refreshTab({ tabId: 'nonexistent' }));

    expect(getTab(store, TAB_1)?.mountKey).toBe(originalMountKey);
  });
});

describe('activateTab', () => {
  it('sets the active tab for the panel', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(activateTab({ tabId: TAB_2, panelId: PANEL_1 }));

    expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe(TAB_2);
    expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
  });

  it('is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace());
    const originalActiveTabId = getWorkspace(store).activeTabIds[PANEL_1];

    store.dispatch(activateTab({ tabId: 'nonexistent', panelId: PANEL_1 }));

    // Should not change activeTabId when tab doesn't exist
    expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe(originalActiveTabId);
  });

  it('is a no-op when tab belongs to different panel', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    const store = createTestStore(state);

    // Try to select tab-1 (belongs to panel-1) in panel-2
    store.dispatch(activateTab({ tabId: TAB_1, panelId: PANEL_2 }));

    // Should not change panel-2's activeTabId
    expect(getWorkspace(store).activeTabIds[PANEL_2]).toBe(TAB_3);
  });
});

describe('updateTabLayout', () => {
  it('updates layout fields on the tab', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(
      updateTabLayout({
        tabId: TAB_1,
        layoutId: 'chart-layout',
        name: 'Chart View',
        params: { type: 'bar' },
        option: 'default',
      })
    );

    const tab = getTab(store, TAB_1);
    expect(tab?.layoutId).toBe('chart-layout');
    expect(tab?.name).toBe('Chart View');
    expect(tab?.layoutParams).toEqual({ type: 'bar' });
    expect(tab?.layoutOption).toBe('default');
  });

  it('regenerates mountKey when changing layoutId', () => {
    const state = makeWorkspace();
    state.tabs[0].layoutId = 'old-layout';
    const originalMountKey = state.tabs[0].mountKey;
    const store = createTestStore(state);

    store.dispatch(
      updateTabLayout({
        tabId: TAB_1,
        layoutId: 'new-layout',
        name: 'New View',
      })
    );

    const tab = getTab(store, TAB_1);
    expect(tab?.mountKey).not.toBe(originalMountKey);
  });

  it('does not regenerate mountKey when setting same layoutId', () => {
    const state = makeWorkspace();
    state.tabs[0].layoutId = 'same-layout';
    const originalMountKey = state.tabs[0].mountKey;
    const store = createTestStore(state);

    store.dispatch(
      updateTabLayout({
        tabId: TAB_1,
        layoutId: 'same-layout',
        name: 'Same View',
      })
    );

    const tab = getTab(store, TAB_1);
    expect(tab?.mountKey).toBe(originalMountKey);
  });

  it('does not regenerate mountKey when setting layoutId on tab without existing layout', () => {
    const state = makeWorkspace();
    state.tabs[0].layoutId = undefined;
    const originalMountKey = state.tabs[0].mountKey;
    const store = createTestStore(state);

    store.dispatch(
      updateTabLayout({
        tabId: TAB_1,
        layoutId: 'new-layout',
        name: 'New View',
      })
    );

    const tab = getTab(store, TAB_1);
    expect(tab?.mountKey).toBe(originalMountKey);
  });

  it('is a no-op when tab does not exist', () => {
    const store = createTestStore(makeWorkspace());
    const tabCountBefore = getWorkspace(store).tabs.length;

    store.dispatch(
      updateTabLayout({
        tabId: 'nonexistent',
        layoutId: 'new-layout',
        name: 'Test',
      })
    );

    expect(getWorkspace(store).tabs.length).toBe(tabCountBefore);
  });
});

describe('state invariants', () => {
  it('maintains consistent panelTabs after multiple operations', async () => {
    const store = createTestStore(makeWorkspace());

    // Add several tabs
    await store.dispatch(addTab({ panelId: PANEL_1, name: 'Tab 2' }));
    await store.dispatch(addTab({ panelId: PANEL_1, name: 'Tab 3' }));

    // Remove a tab
    const tab2Id = getWorkspace(store).tabs[1].id;
    store.dispatch(removeTab({ tabId: tab2Id }));

    // Verify panelTabs matches tabs array
    const { tabs, panelTabs } = getWorkspace(store);
    const panelTabsFlat = Object.values(panelTabs).flat();
    expect(panelTabsFlat.length).toBe(tabs.length);
    for (const tab of tabs) {
      expect(panelTabsFlat).toContain(tab.id);
    }
  });

  it('maintains consistent activeTabIds after tab removal', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));
    const { activeTabIds, panelTabs } = getWorkspace(store);

    // Verify all activeTabIds point to tabs that exist in their panel
    for (const [panelId, activeTabId] of Object.entries(activeTabIds)) {
      expect(panelTabs[panelId]).toContain(activeTabId);
    }

    // Remove active tab
    store.dispatch(removeTab({ tabId: TAB_1 }));

    // Verify activeTabIds are still valid
    const stateAfter = getWorkspace(store);
    for (const [panelId, activeTabId] of Object.entries(stateAfter.activeTabIds)) {
      expect(stateAfter.panelTabs[panelId]).toContain(activeTabId);
    }
  });

  it('maintains consistent tab.panelId with panelTabs mapping', async () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    // Move a tab
    store.dispatch(moveTab({ tabId: TAB_1, targetPanelId: PANEL_2 }));

    // Verify each tab's panelId matches its location in panelTabs
    const { tabs, panelTabs } = getWorkspace(store);
    for (const tab of tabs) {
      expect(panelTabs[tab.panelId]).toContain(tab.id);
      // Tab should NOT be in other panels' panelTabs
      for (const [pid, tabIds] of Object.entries(panelTabs)) {
        if (pid !== tab.panelId) {
          expect(tabIds).not.toContain(tab.id);
        }
      }
    }
  });

  it('all tabs have unique IDs', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(addTab({ panelId: PANEL_1 }));
    await store.dispatch(addTab({ panelId: PANEL_1 }));
    await store.dispatch(duplicateTab({ tabId: TAB_1 }));

    const { tabs } = getWorkspace(store);
    const ids = tabs.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all tabs have unique mountKeys', async () => {
    const store = createTestStore(makeWorkspace());

    await store.dispatch(addTab({ panelId: PANEL_1 }));
    await store.dispatch(addTab({ panelId: PANEL_1 }));

    const { tabs } = getWorkspace(store);
    const mountKeys = tabs.map((t) => t.mountKey);
    const uniqueMountKeys = new Set(mountKeys);
    expect(uniqueMountKeys.size).toBe(mountKeys.length);
  });
});

describe('complex workflows', () => {
  it('handles split -> move back -> collapse workflow', async () => {
    const store = createTestStore(makeWorkspace());

    // Add second tab to enable split
    await store.dispatch(addTab({ panelId: PANEL_1, name: 'Tab 2' }));
    const tab2Id = getWorkspace(store).tabs[1].id;

    // Split panel
    await store.dispatch(
      splitPanel({
        panelId: PANEL_1,
        direction: 'horizontal',
        tabId: tab2Id,
      })
    );

    expect(countLeafPanels(getWorkspace(store).panel)).toBe(2);
    const newPanelId = getTab(store, tab2Id)?.panelId ?? '';
    expect(newPanelId).not.toBe(PANEL_1);

    // Moving the only tab back empties the new panel, which collapses
    store.dispatch(moveTab({ tabId: tab2Id, targetPanelId: PANEL_1 }));

    expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
    expect(getWorkspace(store).tabs.length).toBe(2);
    // Both tabs should be in the same panel now
    const tabsInPanel = getWorkspace(store).panelTabs[PANEL_1];
    expect(tabsInPanel).toContain(TAB_1);
    expect(tabsInPanel).toContain(tab2Id);
  });

  it('handles add -> duplicate -> remove workflow', async () => {
    const store = createTestStore(makeWorkspace());

    // Add tab
    await store.dispatch(addTab({ panelId: PANEL_1, name: 'Chart', layoutId: 'chart' }));
    expect(getWorkspace(store).tabs.length).toBe(2);

    // Duplicate it
    const chartTabId = getWorkspace(store).tabs[1].id;
    await store.dispatch(duplicateTab({ tabId: chartTabId }));
    expect(getWorkspace(store).tabs.length).toBe(3);

    const duplicateTabId = getWorkspace(store).tabs[2].id;
    expect(getTab(store, duplicateTabId)?.name).toBe('Chart (copy)');
    expect(getTab(store, duplicateTabId)?.layoutId).toBe('chart');

    // Remove duplicate
    store.dispatch(removeTab({ tabId: duplicateTabId }));
    expect(getWorkspace(store).tabs.length).toBe(2);
  });

  it('handles lock -> remove attempt -> unlock -> remove workflow', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    // Lock tab
    store.dispatch(lockTab({ tabId: TAB_1 }));
    expect(getTab(store, TAB_1)?.locked).toBe(true);

    // Try to remove (should fail)
    store.dispatch(removeTab({ tabId: TAB_1 }));
    expect(getTab(store, TAB_1)).toBeDefined();

    // Unlock
    store.dispatch(unlockTab({ tabId: TAB_1 }));
    expect(getTab(store, TAB_1)?.locked).toBe(false);

    // Now remove succeeds
    store.dispatch(removeTab({ tabId: TAB_1 }));
    expect(getTab(store, TAB_1)).toBeUndefined();
  });
});
