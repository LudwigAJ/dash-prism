/**
 * Unit tests for workspaceSlice - the core Redux state for Prism workspace management.
 *
 * These tests verify:
 * - Tab operations: addTab, removeTab, duplicateTab, moveTab, reorderTab, rename, lock
 * - Panel operations: splitPanel, collapsePanel, resizePanel, pin/unpin
 * - State invariants: panelTabs, activeTabIds consistency
 * - Edge cases: locked tabs, max tabs, panel limits
 * - Workspace actions: toggleSearchBars, toggleFavoriteLayout, resetWorkspace, syncWorkspace
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createInitialWorkspaceState,
  addTab,
  removeTab,
  duplicateTab,
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
  setActivePanel,
  resizePanel,
  pinPanel,
  unpinPanel,
  splitPanel,
  collapsePanel,
  toggleSearchBars,
  toggleFavoriteLayout,
  resetWorkspace,
  syncWorkspace,
  reconcileWithServer,
  MAX_TAB_NAME_LENGTH,
  switchToOpenTab,
  detachTab,
  attachTab,
} from './workspaceSlice';
import type { WorkspaceState } from './types';
import type { Tab, PanelNode } from '@types';
import {
  createTestStore,
  getWorkspace,
  makeTab,
  makeWorkspace,
  PANEL_1,
  PANEL_2,
  ROOT_CONTAINER,
  TAB_1,
  TAB_2,
  TAB_3,
  type TestStore,
} from './testing';
import { MAX_LEAF_PANELS } from '@constants/panels';

/**
 * Gets a tab by ID from the store state.
 */
function getTab(store: TestStore, tabId: string): Tab | undefined {
  return getWorkspace(store).tabs.find((t) => t.id === tabId);
}

/**
 * Counts the leaf panels.
 */
function countLeafPanels(panel: PanelNode): number {
  if (panel.children.length === 0) return 1;
  return panel.children.reduce((count, child) => count + countLeafPanels(child), 0);
}

// =============================================================================
// Tab Operation Tests
// =============================================================================

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

describe('workspaceSlice', () => {
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
  });

  // ===========================================================================
  // Panel Operation Tests
  // ===========================================================================

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

  describe('collapsePanel', () => {
    it('moves all tabs to remaining panel', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(collapsePanel({ panelId: PANEL_2 }));

      expect(getTab(store, TAB_3)?.panelId).toBe(PANEL_1);
      expect(getWorkspace(store).panelTabs[PANEL_1]).toContain(TAB_3);
    });

    it('cleans up collapsed panel state', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(collapsePanel({ panelId: PANEL_2 }));

      expect(getWorkspace(store).panelTabs[PANEL_2]).toBeUndefined();
      expect(getWorkspace(store).activeTabIds[PANEL_2]).toBeUndefined();
    });

    it('does not collapse last remaining panel', () => {
      const store = createTestStore(makeWorkspace());

      store.dispatch(collapsePanel({ panelId: PANEL_1 }));

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
    });

    it('does nothing for a panel that does not exist', () => {
      const notify = vi.fn();
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]), { notify });
      const before = getWorkspace(store);

      store.dispatch(collapsePanel({ panelId: 'missing' }));

      expect(getWorkspace(store)).toBe(before);
      expect(notify).not.toHaveBeenCalled();
    });

    it('does not toast when it refuses to close the last panel', () => {
      const notify = vi.fn();
      const store = createTestStore(makeWorkspace(), { notify });

      store.dispatch(collapsePanel({ panelId: PANEL_1 }));

      expect(notify).not.toHaveBeenCalled();
    });

    it('updates activePanelId to remaining panel', () => {
      const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
      state.activePanelId = PANEL_2;
      const store = createTestStore(state);

      store.dispatch(collapsePanel({ panelId: PANEL_2 }));

      expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
    });
  });

  describe('resizePanel', () => {
    it('updates panel size with string value', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(resizePanel({ panelId: PANEL_1, size: '30%' }));

      const panel1 = getWorkspace(store).panel.children.find((c) => c.id === PANEL_1);
      expect(panel1?.size).toBe('30%');
    });

    it('accepts numeric size values', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(resizePanel({ panelId: PANEL_1, size: 300 }));

      const panel1 = getWorkspace(store).panel.children.find((c) => c.id === PANEL_1);
      expect(panel1?.size).toBe(300);
    });
  });

  describe('pinPanel / unpinPanel', () => {
    it('pinPanel sets pinned to true', () => {
      const store = createTestStore(makeWorkspace());

      store.dispatch(pinPanel({ panelId: PANEL_1 }));

      expect(getWorkspace(store).panel.pinned).toBe(true);
    });

    it('unpinPanel sets pinned to false', () => {
      const state = makeWorkspace();
      state.panel.pinned = true;
      const store = createTestStore(state);

      store.dispatch(unpinPanel({ panelId: PANEL_1 }));

      expect(getWorkspace(store).panel.pinned).toBe(false);
    });
  });

  // ===========================================================================
  // Workspace Action Tests
  // ===========================================================================

  describe('toggleSearchBars', () => {
    it('toggles searchBarsHidden', () => {
      const store = createTestStore(makeWorkspace());
      expect(getWorkspace(store).searchBarsHidden).toBe(false);

      store.dispatch(toggleSearchBars());
      expect(getWorkspace(store).searchBarsHidden).toBe(true);

      store.dispatch(toggleSearchBars());
      expect(getWorkspace(store).searchBarsHidden).toBe(false);
    });
  });

  describe('toggleFavoriteLayout', () => {
    it('adds layout to favorites', () => {
      const store = createTestStore(makeWorkspace());

      store.dispatch(toggleFavoriteLayout({ layoutId: 'my-layout' }));

      expect(getWorkspace(store).favoriteLayouts).toContain('my-layout');
    });

    it('removes layout from favorites if already present', () => {
      const state = makeWorkspace();
      state.favoriteLayouts = ['my-layout'];
      const store = createTestStore(state);

      store.dispatch(toggleFavoriteLayout({ layoutId: 'my-layout' }));

      expect(getWorkspace(store).favoriteLayouts).not.toContain('my-layout');
    });
  });

  describe('resetWorkspace', () => {
    it('resets state to a fresh initial workspace', () => {
      const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
      state.favoriteLayouts = ['layout-1', 'layout-2'];
      state.searchBarsHidden = true;
      const store = createTestStore(state);

      store.dispatch(resetWorkspace());

      expect(getWorkspace(store).tabs.length).toBe(1);
      expect(getWorkspace(store).favoriteLayouts).toEqual([]);
      expect(getWorkspace(store).searchBarsHidden).toBe(false);
    });

    it('generates new tab and panel IDs instead of reusing the initial ones', () => {
      // No preloaded state: the reducer builds its own initial state lazily.
      const store = createTestStore();
      const before = getWorkspace(store);

      store.dispatch(resetWorkspace());
      const after = getWorkspace(store);

      expect(after.tabs).toHaveLength(1);
      expect(after.tabs[0].id).not.toBe(before.tabs[0].id);
      expect(after.tabs[0].mountKey).not.toBe(before.tabs[0].mountKey);
      expect(after.panel.id).not.toBe(before.panel.id);
      expect(after.panelTabs).toEqual({ [after.panel.id]: [after.tabs[0].id] });
      expect(after.activeTabIds).toEqual({ [after.panel.id]: after.tabs[0].id });
      expect(after.activePanelId).toBe(after.panel.id);
    });

    it('resets twice in a row without reusing IDs', () => {
      const store = createTestStore();
      store.dispatch(resetWorkspace());
      const first = getWorkspace(store);
      store.dispatch(resetWorkspace());
      const second = getWorkspace(store);

      expect(second.tabs[0].id).not.toBe(first.tabs[0].id);
      expect(second.panel.id).not.toBe(first.panel.id);
    });
  });

  describe('createInitialWorkspaceState', () => {
    it('returns an internally consistent single-panel, single-tab state', () => {
      const s = createInitialWorkspaceState();

      expect(s.tabs).toHaveLength(1);
      expect(s.tabs[0].name).toBe('New Tab');
      expect(s.tabs[0].layoutId).toBeUndefined();
      expect(s.tabs[0].panelId).toBe(s.panel.id);
      expect(s.panel.children).toEqual([]);
      expect(s.panelTabs).toEqual({ [s.panel.id]: [s.tabs[0].id] });
      expect(s.activeTabIds).toEqual({ [s.panel.id]: s.tabs[0].id });
      expect(s.activePanelId).toBe(s.panel.id);
      expect(s.favoriteLayouts).toEqual([]);
      expect(s.searchBarsHidden).toBe(false);
    });

    it('returns fresh objects and fresh IDs on every call', () => {
      const a = createInitialWorkspaceState();
      const b = createInitialWorkspaceState();

      expect(a).not.toBe(b);
      expect(a.tabs[0].id).not.toBe(b.tabs[0].id);
      expect(a.tabs[0].mountKey).not.toBe(b.tabs[0].mountKey);
      expect(a.panel.id).not.toBe(b.panel.id);
    });

    it('computes createdAt at call time, not at module load', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(1_000);
        const a = createInitialWorkspaceState();
        vi.setSystemTime(2_000);
        const b = createInitialWorkspaceState();

        expect(a.tabs[0].createdAt).toBe(1_000);
        expect(b.tabs[0].createdAt).toBe(2_000);
      } finally {
        vi.useRealTimers();
      }
    });

    it('gives two stores on the same page independent initial IDs', () => {
      const a = getWorkspace(createTestStore());
      const b = getWorkspace(createTestStore());

      expect(a.tabs[0].id).not.toBe(b.tabs[0].id);
      expect(a.panel.id).not.toBe(b.panel.id);
    });

    it('lets the slice module load when crypto.randomUUID is unavailable', async () => {
      // Regression: IDs used to be generated at module scope via crypto.randomUUID(),
      // which is undefined on plain-HTTP, non-localhost origins, so the bundle threw
      // while loading and window.dash_prism was never defined.
      vi.resetModules();
      vi.stubGlobal('crypto', undefined);
      try {
        const mod = await import('./workspaceSlice');
        const state = mod.createInitialWorkspaceState();
        expect(state.tabs[0].id).toMatch(/^[0-9a-f]{8}$/);
        expect(state.panel.id).toMatch(/^[0-9a-f]{8}$/);
      } finally {
        vi.unstubAllGlobals();
        vi.resetModules();
      }
    });

    it('never generates IDs while the module is being evaluated', async () => {
      // Stricter than the crypto stub above: with the fallback generator in place a
      // module-scope call would no longer throw, so make the generator itself throw
      // during module evaluation. Importing must still succeed.
      vi.resetModules();
      vi.doMock('@utils/uuid', () => ({
        generateShortId: () => {
          throw new Error('generateShortId() called at module scope');
        },
      }));
      try {
        await expect(import('./workspaceSlice')).resolves.toBeDefined();
      } finally {
        vi.doUnmock('@utils/uuid');
        vi.resetModules();
      }
    });
  });

  describe('syncWorkspace', () => {
    it('syncs partial workspace state from Dash', () => {
      const store = createTestStore(makeWorkspace());

      store.dispatch(
        syncWorkspace({
          searchBarsHidden: true,
          favoriteLayouts: ['layout-1', 'layout-2'],
        })
      );

      expect(getWorkspace(store).searchBarsHidden).toBe(true);
      expect(getWorkspace(store).favoriteLayouts).toEqual(['layout-1', 'layout-2']);
    });

    it('preserves unsynced fields', () => {
      const store = createTestStore(makeWorkspace());
      const originalTabs = getWorkspace(store).tabs;

      store.dispatch(
        syncWorkspace({
          searchBarsHidden: true,
        })
      );

      expect(getWorkspace(store).tabs).toEqual(originalTabs);
    });

    it('removes tabs that reference non-existent panels', () => {
      const state = makeWorkspace();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      // Sync tabs with one referencing a non-existent panel
      store.dispatch(
        syncWorkspace({
          tabs: [makeTab(TAB_1, panelId), makeTab(TAB_2, 'non-existent-panel')],
        })
      );

      // Should only have the valid tab
      expect(getWorkspace(store).tabs.length).toBe(1);
      expect(getWorkspace(store).tabs[0].id).toBe(TAB_1);
    });

    it('replaces stale ids in panelTabs with the tabs that exist', () => {
      const state = makeWorkspace();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      // Sync with mismatched panelTabs
      store.dispatch(
        syncWorkspace({
          tabs: [makeTab('new-tab', panelId)],
          panelTabs: {
            [panelId]: ['wrong-tab-id'], // Doesn't match tabs
          },
        })
      );

      // The unknown id is dropped and the real tab is appended
      expect(getWorkspace(store).panelTabs[panelId]).toEqual(['new-tab']);
    });

    describe('panelTabs order', () => {
      /** Three tabs in one panel, created a-b-c but displayed c-a-b. */
      function createReorderedState(): WorkspaceState {
        return makeWorkspace([['tab-c', 'tab-a', 'tab-b']], {
          tabs: [makeTab('tab-a', PANEL_1), makeTab('tab-b', PANEL_1), makeTab('tab-c', PANEL_1)],
        });
      }

      it('keeps the order from the payload when a readWorkspace snapshot is echoed back', () => {
        const store = createTestStore(createReorderedState());
        const snapshot = getWorkspace(store);

        // What a Dash callback wired Input('readWorkspace') -> Output('updateWorkspace') sends
        store.dispatch(
          syncWorkspace({
            tabs: snapshot.tabs,
            panel: snapshot.panel,
            panelTabs: snapshot.panelTabs,
            activeTabIds: snapshot.activeTabIds,
            activePanelId: snapshot.activePanelId,
          })
        );

        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-a', 'tab-b']);
        expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe('tab-c');
      });

      it('survives a real reorderTab followed by a readWorkspace/updateWorkspace round trip', () => {
        const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));
        store.dispatch(reorderTab({ panelId: PANEL_1, fromIndex: 0, toIndex: 1 }));
        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);

        const snapshot = getWorkspace(store);
        store.dispatch(syncWorkspace({ ...snapshot }));

        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
        expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_3]);
      });

      it('keeps the current order when the payload does not include panelTabs', () => {
        const store = createTestStore(createReorderedState());

        store.dispatch(syncWorkspace({ searchBarsHidden: true }));

        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-a', 'tab-b']);
      });

      it('keeps the current order when only tabs are sent, appending new tabs at the end', () => {
        const state = createReorderedState();
        const store = createTestStore(state);
        const panelId = state.panel.id;

        store.dispatch(
          syncWorkspace({
            tabs: [...state.tabs, makeTab('tab-d', panelId)],
          })
        );

        expect(getWorkspace(store).panelTabs[panelId]).toEqual([
          'tab-c',
          'tab-a',
          'tab-b',
          'tab-d',
        ]);
      });

      it('appends tabs missing from their panel list without reordering the rest', () => {
        const state = createReorderedState();
        state.panelTabs = { [PANEL_1]: ['tab-c', 'tab-a'] }; // tab-b missing
        const store = createTestStore(state);

        store.dispatch(syncWorkspace({ panelTabs: state.panelTabs }));

        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-a', 'tab-b']);
      });

      it('drops ids that are unknown, duplicated, or belong to another panel', () => {
        const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

        store.dispatch(
          syncWorkspace({
            panelTabs: {
              // tab-3 lives in panel-2 (tab.panelId wins), ghost does not exist, tab-1 twice
              [PANEL_1]: [TAB_3, 'ghost', TAB_2, TAB_1, TAB_1],
              [PANEL_2]: [],
            },
          })
        );

        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
        expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_3]);
      });

      it('tolerates a non-array per-panel value from updateWorkspace', () => {
        const store = createTestStore(createReorderedState());

        expect(() =>
          store.dispatch(syncWorkspace({ panelTabs: { [PANEL_1]: 'tab-a' as never } }))
        ).not.toThrow();

        // Malformed list: that panel is rebuilt from tabs order
        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-a', 'tab-b', 'tab-c']);
      });

      it('builds the list for a panel missing from the payload from tabs order', () => {
        const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

        store.dispatch(syncWorkspace({ panelTabs: { [PANEL_1]: [TAB_2, TAB_1] } }));

        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
        expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_3]);
      });

      it('drops panelTabs keys that are not leaf panels', () => {
        const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

        store.dispatch(
          syncWorkspace({
            panelTabs: {
              [PANEL_1]: [TAB_2, TAB_1],
              [PANEL_2]: [TAB_3],
              [ROOT_CONTAINER]: [TAB_1],
              'gone-panel': [TAB_3],
            },
          })
        );

        expect(Object.keys(getWorkspace(store).panelTabs).sort()).toEqual([PANEL_1, PANEL_2]);
        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
        expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_3]);
      });

      it('falls back to the first displayed tab (not the first created) when the active tab disappears', () => {
        const state = createReorderedState();
        state.panelTabs = { [PANEL_1]: ['tab-b', 'tab-c', 'tab-a'] };
        state.activeTabIds = { [PANEL_1]: 'tab-b' };
        const store = createTestStore(state);

        store.dispatch(syncWorkspace({ tabs: state.tabs.filter((t) => t.id !== 'tab-b') }));

        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-a']);
        expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe('tab-c');
      });

      it('removes tabs from panelTabs when they are removed from tabs', () => {
        const state = createReorderedState();
        const store = createTestStore(state);

        store.dispatch(syncWorkspace({ tabs: state.tabs.filter((t) => t.id !== 'tab-a') }));

        expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-b']);
        expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe('tab-c');
      });
    });

    it('fixes activeTabIds referencing non-existent tabs', () => {
      const state = makeWorkspace();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      // Sync with activeTabId pointing to non-existent tab
      store.dispatch(
        syncWorkspace({
          tabs: [makeTab('real-tab', panelId)],
          activeTabIds: {
            [panelId]: 'deleted-tab',
          },
        })
      );

      // Should fall back to first tab in panel
      expect(getWorkspace(store).activeTabIds[panelId]).toBe('real-tab');
    });

    it('fixes activePanelId referencing non-existent panel', () => {
      const state = makeWorkspace();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      store.dispatch(
        syncWorkspace({
          activePanelId: 'non-existent',
        })
      );

      // Should fall back to first leaf panel
      expect(getWorkspace(store).activePanelId).toBe(panelId);
    });
  });

  describe('reconcileWithServer', () => {
    /** Two panels: panel-1 has a locked tab on layout 'gone' and a tab on 'home'; panel-2 one tab on 'gone'. */
    function createStaleState(): WorkspaceState {
      const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
      state.tabs[0].layoutId = 'gone';
      state.tabs[0].locked = true;
      state.tabs[1].layoutId = 'home';
      state.tabs[2].layoutId = 'gone';
      state.serverSessionId = 'old';
      return state;
    }

    it('is a no-op (same reference) when the id matches and every layout is known', () => {
      const state = createStaleState();
      state.serverSessionId = 'same';
      const store = createTestStore(state);
      const before = getWorkspace(store);

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'same', registeredLayoutIds: ['gone', 'home'] })
      );

      expect(getWorkspace(store)).toBe(before);
    });

    it('records a new server session id without touching tabs when nothing is stale', () => {
      const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
      const store = createTestStore(state);

      store.dispatch(reconcileWithServer({ serverSessionId: 'v1', registeredLayoutIds: ['home'] }));

      expect(getWorkspace(store).serverSessionId).toBe('v1');
      expect(getWorkspace(store).tabs.map((t) => t.id)).toEqual([TAB_1, TAB_2, TAB_3]);
    });

    it('closes tabs whose layout is no longer registered, locked ones included, without toasting from the reducer', () => {
      const notify = vi.fn();
      const store = createTestStore(createStaleState(), { notify });

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] })
      );

      const ws = getWorkspace(store);
      expect(ws.tabs.map((t) => t.id)).toEqual([TAB_2]);
      // panel-2 lost its only tab and collapsed; panel-1 remains as the single leaf
      expect(Object.keys(ws.panelTabs)).toEqual([PANEL_1]);
      expect(ws.panelTabs[PANEL_1]).toEqual([TAB_2]);
      expect(ws.activeTabIds[PANEL_1]).toBe(TAB_2);
      expect(ws.activePanelId).toBe(PANEL_1);
      expect(ws.serverSessionId).toBe('new');
      // The toast is raised later by <LoadNotice /> from ui.loadNotice (set by the
      // reconcile middleware): during REHYDRATE nobody is subscribed yet.
      expect(notify).not.toHaveBeenCalled();
    });

    it('keeps the saved active panel when a different panel collapses', () => {
      const state = createStaleState();
      // panel-2 (only tab on 'gone') will collapse; the user had panel-1 focused.
      state.activePanelId = PANEL_1;
      state.tabs[0].layoutId = 'home';
      state.tabs[0].locked = false;
      const store = createTestStore(state);

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] })
      );

      expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
    });

    it('moves focus when the active panel itself collapses', () => {
      const state = createStaleState();
      state.activePanelId = PANEL_2;
      state.tabs[0].layoutId = 'home';
      state.tabs[0].locked = false;
      const store = createTestStore(state);

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] })
      );

      expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
    });

    it('prunes unknown layouts even when the session id has not changed (safety net)', () => {
      const state = createStaleState();
      state.serverSessionId = 'same';
      const store = createTestStore(state);

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'same', registeredLayoutIds: ['home'] })
      );

      expect(getWorkspace(store).tabs.map((t) => t.id)).toEqual([TAB_2]);
    });

    it('spawns a blank tab when every tab is closed', () => {
      const state = makeWorkspace();
      state.tabs[0].layoutId = 'gone';
      const store = createTestStore(state);

      store.dispatch(reconcileWithServer({ serverSessionId: 'v2', registeredLayoutIds: ['home'] }));

      const ws = getWorkspace(store);
      expect(ws.tabs).toHaveLength(1);
      expect(ws.tabs[0].layoutId).toBeUndefined();
      expect(ws.tabs[0].name).toBe('New Tab');
      expect(ws.panelTabs[state.panel.id]).toEqual([ws.tabs[0].id]);
      expect(ws.activeTabIds[state.panel.id]).toBe(ws.tabs[0].id);
    });

    it('keeps tabs that have no layout', () => {
      const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]); // no layoutIds at all
      const store = createTestStore(state);

      store.dispatch(reconcileWithServer({ serverSessionId: 'v1', registeredLayoutIds: ['home'] }));

      expect(getWorkspace(store).tabs).toHaveLength(3);
    });

    it('never prunes when the registry is empty (metadata may not be injected)', () => {
      const notify = vi.fn();
      const store = createTestStore(createStaleState(), { notify });

      store.dispatch(reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: [] }));

      expect(getWorkspace(store).tabs).toHaveLength(3);
      expect(getWorkspace(store).serverSessionId).toBe('new');
      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe('setActivePanel', () => {
    it('sets the active panel', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(setActivePanel({ panelId: PANEL_2 }));

      expect(getWorkspace(store).activePanelId).toBe(PANEL_2);
    });
  });

  describe('activateTab', () => {
    it('sets the active tab for the panel', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(activateTab({ tabId: TAB_2, panelId: PANEL_1 }));

      expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe(TAB_2);
      expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
    });
  });

  // ===========================================================================
  // maxTabs Enforcement Tests
  // ===========================================================================

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

        await store.dispatch(
          addTab({ panelId: PANEL_1, layoutId: 'analytics', name: 'Analytics' })
        );

        // Tab should not be added
        expect(getWorkspace(store).tabs.length).toBe(1);
      });

      it('allows addTab when allowMultiple=false and layout not yet open', async () => {
        const state = makeWorkspace();
        const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
        const store = createTestStore(state, { registeredLayouts: layouts });

        await store.dispatch(
          addTab({ panelId: PANEL_1, layoutId: 'analytics', name: 'Analytics' })
        );

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

  // ===========================================================================
  // updateTabLayout Tests
  // ===========================================================================

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

  // ===========================================================================
  // Edge Case Tests
  // ===========================================================================

  describe('edge cases', () => {
    describe('duplicateTab edge cases', () => {
      it('rejects when tab does not exist', async () => {
        const store = createTestStore(makeWorkspace());
        const tabCountBefore = getWorkspace(store).tabs.length;

        const result = await store.dispatch(duplicateTab({ tabId: 'nonexistent' }));

        expect(result.type).toBe('workspace/duplicateTab/rejected');
        expect(getWorkspace(store).tabs.length).toBe(tabCountBefore);
      });
    });

    describe('moveTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));
        const stateBefore = store.getState().workspace;

        store.dispatch(moveTab({ tabId: 'nonexistent', targetPanelId: PANEL_2 }));

        expect(store.getState().workspace).toEqual(stateBefore);
      });

      it('initializes panelTabs for new target panel', () => {
        const state = makeWorkspace();
        // Remove panelTabs entry for a secondary panel ID
        const panel2Id = PANEL_2;
        state.panel.children = [
          {
            id: PANEL_1,
            order: 0 as const,
            direction: 'horizontal',
            children: [],
            size: '50%',
          },
          { id: panel2Id, order: 1 as const, direction: 'horizontal', children: [], size: '50%' },
        ];
        const store = createTestStore(state);

        store.dispatch(moveTab({ tabId: TAB_1, targetPanelId: panel2Id }));

        expect(getWorkspace(store).panelTabs[panel2Id]).toContain(TAB_1);
      });
    });

    describe('renameTab edge cases', () => {
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

    describe('activateTab edge cases', () => {
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

    describe('setActivePanel edge cases', () => {
      it('is a no-op when panel does not exist', () => {
        const store = createTestStore(makeWorkspace());
        const originalPanelId = getWorkspace(store).activePanelId;

        store.dispatch(setActivePanel({ panelId: 'nonexistent' }));

        // Should not change activePanelId when panel doesn't exist
        expect(getWorkspace(store).activePanelId).toBe(originalPanelId);
      });

      it('is a no-op for container panels (non-leaf)', () => {
        const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
        const store = createTestStore(state);
        const originalPanelId = getWorkspace(store).activePanelId;

        // Try to set active panel to the container panel
        store.dispatch(setActivePanel({ panelId: ROOT_CONTAINER }));

        // Should not change since container-1 is not a leaf
        expect(getWorkspace(store).activePanelId).toBe(originalPanelId);
      });
    });

    describe('lock/unlock edge cases', () => {
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

    describe('setTabIcon/setTabStyle edge cases', () => {
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

    describe('refreshTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(makeWorkspace());
        const originalMountKey = getTab(store, TAB_1)?.mountKey;

        store.dispatch(refreshTab({ tabId: 'nonexistent' }));

        expect(getTab(store, TAB_1)?.mountKey).toBe(originalMountKey);
      });
    });
  });

  // ===========================================================================
  // MAX_LEAF_PANELS Tests
  // ===========================================================================

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

  // ===========================================================================
  // State Invariant Tests
  // ===========================================================================

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

  // ===========================================================================
  // Async Thunk Rejection Tests
  // ===========================================================================

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

  // ===========================================================================
  // Complex Workflow Tests
  // ===========================================================================

  describe('complex workflows', () => {
    it('handles split -> move -> collapse workflow', async () => {
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

      // Collapse the new panel back
      store.dispatch(collapsePanel({ panelId: newPanelId }));

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
});
