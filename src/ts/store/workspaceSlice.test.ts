/**
 * Unit tests for workspaceSlice - the core Redux state for Prism workspace management.
 *
 * These tests verify:
 * - Tab operations: addTab, removeTab, duplicateTab, moveTab, reorderTab, rename, lock
 * - Panel operations: splitPanelAction, collapsePanelAction, resizePanel, pin/unpin
 * - State invariants: panelTabs, activeTabIds consistency
 * - Edge cases: locked tabs, max tabs, panel limits
 * - Workspace actions: toggleSearchBars, toggleFavoriteLayout, resetWorkspace, syncWorkspace
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import workspaceReducer, {
  initialWorkspaceState,
  addTab,
  removeTab,
  duplicateTab,
  selectTab,
  renameTab,
  lockTab,
  unlockTab,
  toggleTabLock,
  moveTab,
  reorderTab,
  setTabIcon,
  setTabStyle,
  refreshTab,
  setActivePanel,
  resizePanel,
  pinPanel,
  unpinPanel,
  splitPanelAction,
  collapsePanelAction,
  toggleSearchBars,
  toggleFavoriteLayout,
  resetWorkspace,
  syncWorkspace,
  MAX_TAB_NAME_LENGTH,
} from './workspaceSlice';
import type { WorkspaceState, ThunkExtra } from './types';
import type { Tab, Panel, PanelId, TabId } from '@types';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a test store with optional preloaded state and maxTabs config.
 */
function createTestStore(preloadedState?: WorkspaceState, maxTabs = 16) {
  const thunkExtra: ThunkExtra = { maxTabs };

  return configureStore({
    reducer: { workspace: workspaceReducer },
    preloadedState: preloadedState ? { workspace: preloadedState } : undefined,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: thunkExtra },
      }),
  });
}

type TestStore = ReturnType<typeof createTestStore>;

/**
 * Create a minimal valid state for testing.
 */
function createTestState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  const panelId = 'test-panel-1' as PanelId;
  const tabId = 'test-tab-1' as TabId;

  return {
    tabs: [
      {
        id: tabId,
        name: 'Test Tab',
        panelId: panelId,
        createdAt: Date.now(),
        mountKey: 'mount-1',
      },
    ],
    panel: {
      id: panelId,
      order: 0,
      direction: 'horizontal',
      children: [],
      size: '100%',
    },
    panelTabs: { [panelId]: [tabId] },
    activeTabIds: { [panelId]: tabId },
    activePanelId: panelId,
    favoriteLayouts: [],
    searchBarsHidden: false,
    ...overrides,
  };
}

/**
 * Create a state with two panels for split/move testing.
 */
function createTwoPanelState(): WorkspaceState {
  const panel1Id = 'panel-1' as PanelId;
  const panel2Id = 'panel-2' as PanelId;
  const containerId = 'container-1' as PanelId;
  const tab1Id = 'tab-1' as TabId;
  const tab2Id = 'tab-2' as TabId;
  const tab3Id = 'tab-3' as TabId;

  return {
    tabs: [
      { id: tab1Id, name: 'Tab 1', panelId: panel1Id, createdAt: Date.now(), mountKey: 'm1' },
      { id: tab2Id, name: 'Tab 2', panelId: panel1Id, createdAt: Date.now(), mountKey: 'm2' },
      { id: tab3Id, name: 'Tab 3', panelId: panel2Id, createdAt: Date.now(), mountKey: 'm3' },
    ],
    panel: {
      id: containerId,
      order: 0,
      direction: 'horizontal',
      children: [
        { id: panel1Id, order: 0, direction: 'horizontal', children: [], size: '50%' },
        { id: panel2Id, order: 1, direction: 'horizontal', children: [], size: '50%' },
      ],
      size: '100%',
    },
    panelTabs: {
      [panel1Id]: [tab1Id, tab2Id],
      [panel2Id]: [tab3Id],
    },
    activeTabIds: {
      [panel1Id]: tab1Id,
      [panel2Id]: tab3Id,
    },
    activePanelId: panel1Id,
    favoriteLayouts: [],
    searchBarsHidden: false,
  };
}

/**
 * Helper to get tab by ID from store state.
 */
function getTab(store: TestStore, tabId: string): Tab | undefined {
  return store.getState().workspace.tabs.find((t) => t.id === tabId);
}

/**
 * Helper to count leaf panels.
 */
function countLeafPanels(panel: Panel): number {
  if (panel.children.length === 0) return 1;
  return panel.children.reduce((count, child) => count + countLeafPanels(child), 0);
}

// =============================================================================
// Tab Operation Tests
// =============================================================================

describe('workspaceSlice', () => {
  describe('addTab', () => {
    it('adds a new tab to the specified panel', async () => {
      const store = createTestStore(createTestState());
      const initialCount = store.getState().workspace.tabs.length;

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'New Tab' }));

      expect(store.getState().workspace.tabs.length).toBe(initialCount + 1);
      const newTab = store.getState().workspace.tabs[1];
      expect(newTab.name).toBe('New Tab');
      expect(newTab.panelId).toBe('test-panel-1');
    });

    it('adds tab to panelTabs tracking', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));

      const newTabId = store.getState().workspace.tabs[1].id;
      expect(store.getState().workspace.panelTabs['test-panel-1']).toContain(newTabId);
    });

    it('sets new tab as active', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));

      const newTabId = store.getState().workspace.tabs[1].id;
      expect(store.getState().workspace.activeTabIds['test-panel-1']).toBe(newTabId);
      expect(store.getState().workspace.activePanelId).toBe('test-panel-1');
    });

    it('creates tab with layoutId when provided', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(
        addTab({
          panelId: 'test-panel-1' as PanelId,
          name: 'Chart Tab',
          layoutId: 'chart-layout',
          params: { type: 'bar' },
        })
      );

      const newTab = store.getState().workspace.tabs[1];
      expect(newTab.layoutId).toBe('chart-layout');
      expect(newTab.layoutParams).toEqual({ type: 'bar' });
    });

    it('generates unique mountKey for new tabs', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));

      const newTab = store.getState().workspace.tabs[1];
      expect(newTab.mountKey).toBeDefined();
      expect(newTab.mountKey).not.toBe(store.getState().workspace.tabs[0].mountKey);
    });
  });

  describe('removeTab', () => {
    it('removes tab from tabs array', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));

      expect(store.getState().workspace.tabs.length).toBe(2);
      expect(getTab(store, 'tab-1')).toBeUndefined();
    });

    it('removes tab from panelTabs tracking', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));

      expect(store.getState().workspace.panelTabs['panel-1']).not.toContain('tab-1');
    });

    it('does not remove locked tabs', () => {
      const state = createTestState();
      state.tabs[0].locked = true;
      const store = createTestStore(state);

      store.dispatch(removeTab({ tabId: 'test-tab-1' as TabId }));

      expect(store.getState().workspace.tabs.length).toBe(1);
      expect(getTab(store, 'test-tab-1')).toBeDefined();
    });

    it('updates activeTabId when removing active tab', () => {
      const store = createTestStore(createTwoPanelState());
      // tab-1 is active in panel-1

      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));

      // Should select remaining tab in panel
      expect(store.getState().workspace.activeTabIds['panel-1']).toBe('tab-2');
    });

    it('is a no-op when tab does not exist', () => {
      const store = createTestStore(createTestState());
      const stateBefore = store.getState().workspace;

      store.dispatch(removeTab({ tabId: 'nonexistent' as TabId }));

      expect(store.getState().workspace.tabs.length).toBe(stateBefore.tabs.length);
    });
  });

  describe('duplicateTab', () => {
    it('creates a copy of the tab', async () => {
      const state = createTestState();
      state.tabs[0].layoutId = 'test-layout';
      state.tabs[0].layoutParams = { foo: 'bar' };
      const store = createTestStore(state);

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      expect(store.getState().workspace.tabs.length).toBe(2);
      const duplicate = store.getState().workspace.tabs[1];
      expect(duplicate.name).toBe('Test Tab (copy)');
      expect(duplicate.layoutId).toBe('test-layout');
      expect(duplicate.layoutParams).toEqual({ foo: 'bar' });
      expect(duplicate.id).not.toBe('test-tab-1');
    });

    it('duplicated tab is not locked even if original was', async () => {
      const state = createTestState();
      state.tabs[0].locked = true;
      const store = createTestStore(state);

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      const duplicate = store.getState().workspace.tabs[1];
      expect(duplicate.locked).toBe(false);
    });

    it('adds duplicate to same panel as original', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      const duplicate = store.getState().workspace.tabs[1];
      expect(duplicate.panelId).toBe('test-panel-1');
      expect(store.getState().workspace.panelTabs['test-panel-1']).toContain(duplicate.id);
    });

    it('creates independent copy of layoutParams', async () => {
      const state = createTestState();
      state.tabs[0].layoutParams = { key: 'original' };
      const store = createTestStore(state);

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      const duplicate = store.getState().workspace.tabs[1];
      expect(duplicate.layoutParams).toEqual({ key: 'original' });
      expect(duplicate.layoutParams).not.toBe(state.tabs[0].layoutParams);
    });
  });

  describe('moveTab', () => {
    it('moves tab between panels', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(moveTab({ tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId }));

      const movedTab = getTab(store, 'tab-1');
      expect(movedTab?.panelId).toBe('panel-2');
      expect(store.getState().workspace.panelTabs['panel-1']).not.toContain('tab-1');
      expect(store.getState().workspace.panelTabs['panel-2']).toContain('tab-1');
    });

    it('updates activeTabIds for both panels', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(moveTab({ tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId }));

      expect(store.getState().workspace.activeTabIds['panel-2']).toBe('tab-1');
      expect(store.getState().workspace.activePanelId).toBe('panel-2');
      expect(store.getState().workspace.activeTabIds['panel-1']).toBe('tab-2');
    });

    it('is a no-op when moving to same panel', () => {
      const store = createTestStore(createTestState());
      const stateBefore = store.getState().workspace;

      store.dispatch(
        moveTab({ tabId: 'test-tab-1' as TabId, targetPanelId: 'test-panel-1' as PanelId })
      );

      expect(store.getState().workspace).toEqual(stateBefore);
    });

    it('moves tab to specific index when provided', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(
        moveTab({ tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId, targetIndex: 0 })
      );

      expect(store.getState().workspace.panelTabs['panel-2'][0]).toBe('tab-1');
      expect(store.getState().workspace.panelTabs['panel-2'][1]).toBe('tab-3');
    });
  });

  describe('reorderTab', () => {
    it('reorders tabs within a panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1' as PanelId, fromIndex: 0, toIndex: 1 }));

      expect(store.getState().workspace.panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
    });

    it('clamps toIndex to valid range', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1' as PanelId, fromIndex: 0, toIndex: 100 }));

      expect(store.getState().workspace.panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
    });

    it('ignores invalid fromIndex', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1' as PanelId, fromIndex: -1, toIndex: 0 }));

      expect(store.getState().workspace.panelTabs['panel-1']).toEqual(['tab-1', 'tab-2']);
    });
  });

  describe('renameTab', () => {
    it('renames the specified tab', () => {
      const store = createTestStore(createTestState());

      store.dispatch(renameTab({ tabId: 'test-tab-1' as TabId, name: 'Renamed Tab' }));

      expect(getTab(store, 'test-tab-1')?.name).toBe('Renamed Tab');
    });

    it('truncates name to MAX_TAB_NAME_LENGTH', () => {
      const store = createTestStore(createTestState());
      const longName = 'A'.repeat(MAX_TAB_NAME_LENGTH + 10);

      store.dispatch(renameTab({ tabId: 'test-tab-1' as TabId, name: longName }));

      expect(getTab(store, 'test-tab-1')?.name.length).toBe(MAX_TAB_NAME_LENGTH);
    });
  });

  describe('lockTab / unlockTab / toggleTabLock', () => {
    it('lockTab locks a tab', () => {
      const store = createTestStore(createTestState());

      store.dispatch(lockTab({ tabId: 'test-tab-1' as TabId }));

      expect(getTab(store, 'test-tab-1')?.locked).toBe(true);
    });

    it('unlockTab unlocks a tab', () => {
      const state = createTestState();
      state.tabs[0].locked = true;
      const store = createTestStore(state);

      store.dispatch(unlockTab({ tabId: 'test-tab-1' as TabId }));

      expect(getTab(store, 'test-tab-1')?.locked).toBe(false);
    });

    it('toggleTabLock toggles lock state', () => {
      const store = createTestStore(createTestState());

      store.dispatch(toggleTabLock({ tabId: 'test-tab-1' as TabId }));
      expect(getTab(store, 'test-tab-1')?.locked).toBe(true);

      store.dispatch(toggleTabLock({ tabId: 'test-tab-1' as TabId }));
      expect(getTab(store, 'test-tab-1')?.locked).toBe(false);
    });
  });

  describe('setTabIcon / setTabStyle', () => {
    it('setTabIcon sets the tab icon', () => {
      const store = createTestStore(createTestState());

      store.dispatch(setTabIcon({ tabId: 'test-tab-1' as TabId, icon: 'Star' }));

      expect(getTab(store, 'test-tab-1')?.icon).toBe('Star');
    });

    it('setTabStyle sets the tab style', () => {
      const store = createTestStore(createTestState());

      store.dispatch(setTabStyle({ tabId: 'test-tab-1' as TabId, style: 'blue' }));

      expect(getTab(store, 'test-tab-1')?.style).toBe('blue');
    });
  });

  describe('refreshTab', () => {
    it('updates mountKey to trigger remount', () => {
      const state = createTestState();
      state.tabs[0].layoutId = 'test-layout';
      const originalMountKey = state.tabs[0].mountKey;
      const store = createTestStore(state);

      store.dispatch(refreshTab({ tabId: 'test-tab-1' as TabId }));

      expect(getTab(store, 'test-tab-1')?.mountKey).not.toBe(originalMountKey);
    });

    it('does nothing for tabs without layoutId', () => {
      const state = createTestState();
      state.tabs[0].layoutId = undefined;
      const originalMountKey = state.tabs[0].mountKey;
      const store = createTestStore(state);

      store.dispatch(refreshTab({ tabId: 'test-tab-1' as TabId }));

      expect(getTab(store, 'test-tab-1')?.mountKey).toBe(originalMountKey);
    });
  });

  // ===========================================================================
  // Panel Operation Tests
  // ===========================================================================

  describe('splitPanelAction', () => {
    it('creates two child panels from one', async () => {
      const store = createTestStore(createTestState());

      // Add a second tab so we can split
      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'Tab 2' }));
      const tab2Id = store.getState().workspace.tabs[1].id;

      store.dispatch(
        splitPanelAction({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        })
      );

      expect(countLeafPanels(store.getState().workspace.panel)).toBe(2);
    });

    it('preserves original panel ID', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));
      const tab2Id = store.getState().workspace.tabs[1].id;

      store.dispatch(
        splitPanelAction({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        })
      );

      const panel = store.getState().workspace.panel;
      const hasOriginalPanelId = panel.children.some((c) => c.id === 'test-panel-1');
      expect(hasOriginalPanelId).toBe(true);
    });

    it('moves tab to new panel', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'Tab 2' }));
      const tab2Id = store.getState().workspace.tabs[1].id;

      store.dispatch(
        splitPanelAction({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        })
      );

      const tab2 = getTab(store, tab2Id);
      expect(tab2?.panelId).not.toBe('test-panel-1');
      expect(store.getState().workspace.panelTabs['test-panel-1']).not.toContain(tab2Id);
    });

    it('does not split panel with only one tab', () => {
      const store = createTestStore(createTestState());

      store.dispatch(
        splitPanelAction({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: 'test-tab-1' as TabId,
        })
      );

      expect(countLeafPanels(store.getState().workspace.panel)).toBe(1);
    });

    it('respects position=before for left/top placement', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));
      const tab2Id = store.getState().workspace.tabs[1].id;

      store.dispatch(
        splitPanelAction({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
          position: 'before',
        })
      );

      const tab2 = getTab(store, tab2Id);
      const newPanelId = tab2?.panelId;
      const panel = store.getState().workspace.panel;
      const newPanel = panel.children.find((c) => c.id === newPanelId);

      expect(newPanel?.order).toBe(0);
    });
  });

  describe('collapsePanelAction', () => {
    it('moves all tabs to remaining panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(collapsePanelAction({ panelId: 'panel-2' as PanelId }));

      expect(getTab(store, 'tab-3')?.panelId).toBe('panel-1');
      expect(store.getState().workspace.panelTabs['panel-1']).toContain('tab-3');
    });

    it('cleans up collapsed panel state', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(collapsePanelAction({ panelId: 'panel-2' as PanelId }));

      expect(store.getState().workspace.panelTabs['panel-2']).toBeUndefined();
      expect(store.getState().workspace.activeTabIds['panel-2']).toBeUndefined();
    });

    it('does not collapse last remaining panel', () => {
      const store = createTestStore(createTestState());

      store.dispatch(collapsePanelAction({ panelId: 'test-panel-1' as PanelId }));

      expect(countLeafPanels(store.getState().workspace.panel)).toBe(1);
    });

    it('updates activePanelId to remaining panel', () => {
      const state = createTwoPanelState();
      state.activePanelId = 'panel-2' as PanelId;
      const store = createTestStore(state);

      store.dispatch(collapsePanelAction({ panelId: 'panel-2' as PanelId }));

      expect(store.getState().workspace.activePanelId).toBe('panel-1');
    });
  });

  describe('resizePanel', () => {
    it('updates panel size with string value', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(resizePanel({ panelId: 'panel-1' as PanelId, size: '30%' }));

      const panel1 = store.getState().workspace.panel.children.find((c) => c.id === 'panel-1');
      expect(panel1?.size).toBe('30%');
    });

    it('accepts numeric size values', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(resizePanel({ panelId: 'panel-1' as PanelId, size: 300 }));

      const panel1 = store.getState().workspace.panel.children.find((c) => c.id === 'panel-1');
      expect(panel1?.size).toBe(300);
    });
  });

  describe('pinPanel / unpinPanel', () => {
    it('pinPanel sets pinned to true', () => {
      const store = createTestStore(createTestState());

      store.dispatch(pinPanel({ panelId: 'test-panel-1' as PanelId }));

      expect(store.getState().workspace.panel.pinned).toBe(true);
    });

    it('unpinPanel sets pinned to false', () => {
      const state = createTestState();
      state.panel.pinned = true;
      const store = createTestStore(state);

      store.dispatch(unpinPanel({ panelId: 'test-panel-1' as PanelId }));

      expect(store.getState().workspace.panel.pinned).toBe(false);
    });
  });

  // ===========================================================================
  // Workspace Action Tests
  // ===========================================================================

  describe('toggleSearchBars', () => {
    it('toggles searchBarsHidden', () => {
      const store = createTestStore(createTestState());
      expect(store.getState().workspace.searchBarsHidden).toBe(false);

      store.dispatch(toggleSearchBars());
      expect(store.getState().workspace.searchBarsHidden).toBe(true);

      store.dispatch(toggleSearchBars());
      expect(store.getState().workspace.searchBarsHidden).toBe(false);
    });
  });

  describe('toggleFavoriteLayout', () => {
    it('adds layout to favorites', () => {
      const store = createTestStore(createTestState());

      store.dispatch(toggleFavoriteLayout({ layoutId: 'my-layout' }));

      expect(store.getState().workspace.favoriteLayouts).toContain('my-layout');
    });

    it('removes layout from favorites if already present', () => {
      const state = createTestState();
      state.favoriteLayouts = ['my-layout'];
      const store = createTestStore(state);

      store.dispatch(toggleFavoriteLayout({ layoutId: 'my-layout' }));

      expect(store.getState().workspace.favoriteLayouts).not.toContain('my-layout');
    });
  });

  describe('resetWorkspace', () => {
    it('resets state to initialWorkspaceState', () => {
      const state = createTwoPanelState();
      state.favoriteLayouts = ['layout-1', 'layout-2'];
      state.searchBarsHidden = true;
      const store = createTestStore(state);

      store.dispatch(resetWorkspace());

      expect(store.getState().workspace.tabs.length).toBe(1);
      expect(store.getState().workspace.favoriteLayouts).toEqual([]);
      expect(store.getState().workspace.searchBarsHidden).toBe(false);
    });
  });

  describe('syncWorkspace', () => {
    it('syncs partial workspace state from Dash', () => {
      const store = createTestStore(createTestState());

      store.dispatch(
        syncWorkspace({
          searchBarsHidden: true,
          favoriteLayouts: ['layout-1', 'layout-2'],
        })
      );

      expect(store.getState().workspace.searchBarsHidden).toBe(true);
      expect(store.getState().workspace.favoriteLayouts).toEqual(['layout-1', 'layout-2']);
    });

    it('preserves unsynced fields', () => {
      const store = createTestStore(createTestState());
      const originalTabs = store.getState().workspace.tabs;

      store.dispatch(
        syncWorkspace({
          searchBarsHidden: true,
        })
      );

      expect(store.getState().workspace.tabs).toEqual(originalTabs);
    });
  });

  describe('setActivePanel', () => {
    it('sets the active panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(setActivePanel({ panelId: 'panel-2' as PanelId }));

      expect(store.getState().workspace.activePanelId).toBe('panel-2');
    });
  });

  describe('selectTab', () => {
    it('sets the active tab for the panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(selectTab({ tabId: 'tab-2' as TabId, panelId: 'panel-1' as PanelId }));

      expect(store.getState().workspace.activeTabIds['panel-1']).toBe('tab-2');
      expect(store.getState().workspace.activePanelId).toBe('panel-1');
    });
  });

  // ===========================================================================
  // maxTabs Enforcement Tests
  // ===========================================================================

  describe('maxTabs enforcement', () => {
    function createStateWithTabs(tabCount: number): WorkspaceState {
      const panelId = 'test-panel' as PanelId;
      const tabs: Tab[] = Array.from({ length: tabCount }, (_, i) => ({
        id: `tab-${i}` as TabId,
        name: `Tab ${i}`,
        panelId,
        createdAt: Date.now(),
        mountKey: `m${i}`,
      }));

      return {
        tabs,
        panel: {
          id: panelId,
          order: 0,
          direction: 'horizontal',
          children: [],
          size: '100%',
        },
        panelTabs: { [panelId]: tabs.map((t) => t.id) },
        activeTabIds: { [panelId]: tabs[0]?.id ?? ('' as TabId) },
        activePanelId: panelId,
        favoriteLayouts: [],
        searchBarsHidden: false,
      };
    }

    describe('addTab with maxTabs', () => {
      it('blocks addTab when at maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 3);

        await store.dispatch(addTab({ panelId: 'test-panel' as PanelId, name: 'New Tab' }));

        expect(store.getState().workspace.tabs.length).toBe(3);
      });

      it('allows addTab when below maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 5);

        await store.dispatch(addTab({ panelId: 'test-panel' as PanelId, name: 'New Tab' }));

        expect(store.getState().workspace.tabs.length).toBe(4);
      });

      it('allows unlimited tabs when maxTabs is 0', async () => {
        const store = createTestStore(createStateWithTabs(100), 0);

        await store.dispatch(addTab({ panelId: 'test-panel' as PanelId, name: 'New Tab' }));

        expect(store.getState().workspace.tabs.length).toBe(101);
      });

      it('allows unlimited tabs when maxTabs is negative', async () => {
        const store = createTestStore(createStateWithTabs(50), -1);

        await store.dispatch(addTab({ panelId: 'test-panel' as PanelId, name: 'New Tab' }));

        expect(store.getState().workspace.tabs.length).toBe(51);
      });
    });

    describe('duplicateTab with maxTabs', () => {
      it('blocks duplicateTab when at maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 3);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' as TabId }));

        expect(store.getState().workspace.tabs.length).toBe(3);
      });

      it('allows duplicateTab when below maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 5);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' as TabId }));

        expect(store.getState().workspace.tabs.length).toBe(4);
        expect(store.getState().workspace.tabs[3].name).toBe('Tab 0 (copy)');
      });

      it('allows unlimited duplicates when maxTabs is 0', async () => {
        const store = createTestStore(createStateWithTabs(100), 0);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' as TabId }));

        expect(store.getState().workspace.tabs.length).toBe(101);
      });
    });

    describe('moveTab does not check maxTabs', () => {
      it('allows moveTab regardless of tab count', () => {
        const store = createTestStore(createTwoPanelState(), 2);

        store.dispatch(moveTab({ tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId }));

        expect(store.getState().workspace.tabs.length).toBe(3);
        const movedTab = getTab(store, 'tab-1');
        expect(movedTab?.panelId).toBe('panel-2');
      });
    });
  });
});
