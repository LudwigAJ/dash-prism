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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import undoable from 'redux-undo';
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
  MAX_TAB_NAME_LENGTH,
  MAX_LEAF_PANELS,
} from './workspaceSlice';
import type { WorkspaceState, ThunkExtra } from './types';
import type { Tab, Panel, PanelId, TabId } from '@types';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a test store with optional preloaded state and maxTabs config.
 * Wraps workspace reducer with undoable() to match real store structure.
 */
function createTestStore(preloadedState?: WorkspaceState, maxTabs = 16) {
  const thunkExtra: ThunkExtra = { maxTabs };

  // Wrap workspace reducer with undoable to match real store structure
  const undoableWorkspaceReducer = undoable(workspaceReducer, {
    limit: 50,
    ignoreInitialState: true,
  });

  const rootReducer = combineReducers({
    workspace: undoableWorkspaceReducer,
  });

  // Build preloaded state with redux-undo structure
  const preloadedUndoState = preloadedState
    ? {
        workspace: {
          past: [] as WorkspaceState[],
          present: preloadedState,
          future: [] as WorkspaceState[],
        },
      }
    : undefined;

  return configureStore({
    reducer: rootReducer,
    preloadedState: preloadedUndoState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: thunkExtra },
      }),
  });
}

type TestStore = ReturnType<typeof createTestStore>;

/**
 * Helper to get workspace state (unwraps redux-undo .present)
 */
function getWorkspace(store: TestStore): WorkspaceState {
  return store.getState().workspace.present;
}

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
  return getWorkspace(store).tabs.find((t) => t.id === tabId);
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
      const initialCount = getWorkspace(store).tabs.length;

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'New Tab' }));

      expect(getWorkspace(store).tabs.length).toBe(initialCount + 1);
      const newTab = getWorkspace(store).tabs[1];
      expect(newTab.name).toBe('New Tab');
      expect(newTab.panelId).toBe('test-panel-1');
    });

    it('adds tab to panelTabs tracking', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));

      const newTabId = getWorkspace(store).tabs[1].id;
      expect(getWorkspace(store).panelTabs['test-panel-1']).toContain(newTabId);
    });

    it('sets new tab as active', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));

      const newTabId = getWorkspace(store).tabs[1].id;
      expect(getWorkspace(store).activeTabIds['test-panel-1']).toBe(newTabId);
      expect(getWorkspace(store).activePanelId).toBe('test-panel-1');
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

      const newTab = getWorkspace(store).tabs[1];
      expect(newTab.layoutId).toBe('chart-layout');
      expect(newTab.layoutParams).toEqual({ type: 'bar' });
    });

    it('generates unique mountKey for new tabs', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));

      const newTab = getWorkspace(store).tabs[1];
      expect(newTab.mountKey).toBeDefined();
      expect(newTab.mountKey).not.toBe(getWorkspace(store).tabs[0].mountKey);
    });
  });

  describe('removeTab', () => {
    it('removes tab from tabs array', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));

      expect(getWorkspace(store).tabs.length).toBe(2);
      expect(getTab(store, 'tab-1')).toBeUndefined();
    });

    it('removes tab from panelTabs tracking', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));

      expect(getWorkspace(store).panelTabs['panel-1']).not.toContain('tab-1');
    });

    it('does not remove locked tabs', () => {
      const state = createTestState();
      state.tabs[0].locked = true;
      const store = createTestStore(state);

      store.dispatch(removeTab({ tabId: 'test-tab-1' as TabId }));

      expect(getWorkspace(store).tabs.length).toBe(1);
      expect(getTab(store, 'test-tab-1')).toBeDefined();
    });

    it('updates activeTabId when removing active tab', () => {
      const store = createTestStore(createTwoPanelState());
      // tab-1 is active in panel-1

      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));

      // Should select remaining tab in panel
      expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-2');
    });

    it('is a no-op when tab does not exist', () => {
      const store = createTestStore(createTestState());
      const tabCountBefore = getWorkspace(store).tabs.length;

      store.dispatch(removeTab({ tabId: 'nonexistent' as TabId }));

      expect(getWorkspace(store).tabs.length).toBe(tabCountBefore);
    });
  });

  describe('duplicateTab', () => {
    it('creates a copy of the tab', async () => {
      const state = createTestState();
      state.tabs[0].layoutId = 'test-layout';
      state.tabs[0].layoutParams = { foo: 'bar' };
      const store = createTestStore(state);

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      expect(getWorkspace(store).tabs.length).toBe(2);
      const duplicate = getWorkspace(store).tabs[1];
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

      const duplicate = getWorkspace(store).tabs[1];
      expect(duplicate.locked).toBe(false);
    });

    it('adds duplicate to same panel as original', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      const duplicate = getWorkspace(store).tabs[1];
      expect(duplicate.panelId).toBe('test-panel-1');
      expect(getWorkspace(store).panelTabs['test-panel-1']).toContain(duplicate.id);
    });

    it('creates independent copy of layoutParams', async () => {
      const state = createTestState();
      state.tabs[0].layoutParams = { key: 'original' };
      const store = createTestStore(state);

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      const duplicate = getWorkspace(store).tabs[1];
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
      expect(getWorkspace(store).panelTabs['panel-1']).not.toContain('tab-1');
      expect(getWorkspace(store).panelTabs['panel-2']).toContain('tab-1');
    });

    it('updates activeTabIds for both panels', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(moveTab({ tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId }));

      expect(getWorkspace(store).activeTabIds['panel-2']).toBe('tab-1');
      expect(getWorkspace(store).activePanelId).toBe('panel-2');
      expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-2');
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

      expect(getWorkspace(store).panelTabs['panel-2'][0]).toBe('tab-1');
      expect(getWorkspace(store).panelTabs['panel-2'][1]).toBe('tab-3');
    });

    it('is a no-op when target panel does not exist', () => {
      const store = createTestStore(createTwoPanelState());
      const stateBefore = getWorkspace(store);

      store.dispatch(
        moveTab({
          tabId: 'tab-1' as TabId,
          targetPanelId: 'nonexistent-panel' as PanelId,
        })
      );

      expect(getWorkspace(store)).toEqual(stateBefore);
    });

    it('is a no-op when target panel is a container (non-leaf)', () => {
      const store = createTestStore(createTwoPanelState());
      const stateBefore = getWorkspace(store);

      // container-1 is the parent container, not a leaf panel
      store.dispatch(
        moveTab({
          tabId: 'tab-1' as TabId,
          targetPanelId: 'container-1' as PanelId,
        })
      );

      expect(getWorkspace(store)).toEqual(stateBefore);
    });
  });

  describe('reorderTab', () => {
    it('reorders tabs within a panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1' as PanelId, fromIndex: 0, toIndex: 1 }));

      expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
    });

    it('clamps toIndex to valid range', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1' as PanelId, fromIndex: 0, toIndex: 100 }));

      expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
    });

    it('ignores invalid fromIndex', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1' as PanelId, fromIndex: -1, toIndex: 0 }));

      expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-1', 'tab-2']);
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

  describe('splitPanel', () => {
    it('creates two child panels from one', async () => {
      const store = createTestStore(createTestState());

      // Add a second tab so we can split
      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'Tab 2' }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      store.dispatch(
        splitPanel({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        })
      );

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(2);
    });

    it('preserves original panel ID', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      store.dispatch(
        splitPanel({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        })
      );

      const panel = getWorkspace(store).panel;
      const hasOriginalPanelId = panel.children.some((c) => c.id === 'test-panel-1');
      expect(hasOriginalPanelId).toBe(true);
    });

    it('moves tab to new panel', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'Tab 2' }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      store.dispatch(
        splitPanel({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        })
      );

      const tab2 = getTab(store, tab2Id);
      expect(tab2?.panelId).not.toBe('test-panel-1');
      expect(getWorkspace(store).panelTabs['test-panel-1']).not.toContain(tab2Id);
    });

    it('does not split panel with only one tab', () => {
      const store = createTestStore(createTestState());

      store.dispatch(
        splitPanel({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: 'test-tab-1' as TabId,
        })
      );

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
    });

    it('respects position=before for left/top placement', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      store.dispatch(
        splitPanel({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
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
      const store = createTestStore(createTwoPanelState());

      store.dispatch(collapsePanel({ panelId: 'panel-2' as PanelId }));

      expect(getTab(store, 'tab-3')?.panelId).toBe('panel-1');
      expect(getWorkspace(store).panelTabs['panel-1']).toContain('tab-3');
    });

    it('cleans up collapsed panel state', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(collapsePanel({ panelId: 'panel-2' as PanelId }));

      expect(getWorkspace(store).panelTabs['panel-2']).toBeUndefined();
      expect(getWorkspace(store).activeTabIds['panel-2']).toBeUndefined();
    });

    it('does not collapse last remaining panel', () => {
      const store = createTestStore(createTestState());

      store.dispatch(collapsePanel({ panelId: 'test-panel-1' as PanelId }));

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
    });

    it('updates activePanelId to remaining panel', () => {
      const state = createTwoPanelState();
      state.activePanelId = 'panel-2' as PanelId;
      const store = createTestStore(state);

      store.dispatch(collapsePanel({ panelId: 'panel-2' as PanelId }));

      expect(getWorkspace(store).activePanelId).toBe('panel-1');
    });
  });

  describe('resizePanel', () => {
    it('updates panel size with string value', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(resizePanel({ panelId: 'panel-1' as PanelId, size: '30%' }));

      const panel1 = getWorkspace(store).panel.children.find((c) => c.id === 'panel-1');
      expect(panel1?.size).toBe('30%');
    });

    it('accepts numeric size values', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(resizePanel({ panelId: 'panel-1' as PanelId, size: 300 }));

      const panel1 = getWorkspace(store).panel.children.find((c) => c.id === 'panel-1');
      expect(panel1?.size).toBe(300);
    });
  });

  describe('pinPanel / unpinPanel', () => {
    it('pinPanel sets pinned to true', () => {
      const store = createTestStore(createTestState());

      store.dispatch(pinPanel({ panelId: 'test-panel-1' as PanelId }));

      expect(getWorkspace(store).panel.pinned).toBe(true);
    });

    it('unpinPanel sets pinned to false', () => {
      const state = createTestState();
      state.panel.pinned = true;
      const store = createTestStore(state);

      store.dispatch(unpinPanel({ panelId: 'test-panel-1' as PanelId }));

      expect(getWorkspace(store).panel.pinned).toBe(false);
    });
  });

  // ===========================================================================
  // Workspace Action Tests
  // ===========================================================================

  describe('toggleSearchBars', () => {
    it('toggles searchBarsHidden', () => {
      const store = createTestStore(createTestState());
      expect(getWorkspace(store).searchBarsHidden).toBe(false);

      store.dispatch(toggleSearchBars());
      expect(getWorkspace(store).searchBarsHidden).toBe(true);

      store.dispatch(toggleSearchBars());
      expect(getWorkspace(store).searchBarsHidden).toBe(false);
    });
  });

  describe('toggleFavoriteLayout', () => {
    it('adds layout to favorites', () => {
      const store = createTestStore(createTestState());

      store.dispatch(toggleFavoriteLayout({ layoutId: 'my-layout' }));

      expect(getWorkspace(store).favoriteLayouts).toContain('my-layout');
    });

    it('removes layout from favorites if already present', () => {
      const state = createTestState();
      state.favoriteLayouts = ['my-layout'];
      const store = createTestStore(state);

      store.dispatch(toggleFavoriteLayout({ layoutId: 'my-layout' }));

      expect(getWorkspace(store).favoriteLayouts).not.toContain('my-layout');
    });
  });

  describe('resetWorkspace', () => {
    it('resets state to initialWorkspaceState', () => {
      const state = createTwoPanelState();
      state.favoriteLayouts = ['layout-1', 'layout-2'];
      state.searchBarsHidden = true;
      const store = createTestStore(state);

      store.dispatch(resetWorkspace());

      expect(getWorkspace(store).tabs.length).toBe(1);
      expect(getWorkspace(store).favoriteLayouts).toEqual([]);
      expect(getWorkspace(store).searchBarsHidden).toBe(false);
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

      expect(getWorkspace(store).searchBarsHidden).toBe(true);
      expect(getWorkspace(store).favoriteLayouts).toEqual(['layout-1', 'layout-2']);
    });

    it('preserves unsynced fields', () => {
      const store = createTestStore(createTestState());
      const originalTabs = getWorkspace(store).tabs;

      store.dispatch(
        syncWorkspace({
          searchBarsHidden: true,
        })
      );

      expect(getWorkspace(store).tabs).toEqual(originalTabs);
    });

    it('removes tabs that reference non-existent panels', () => {
      const state = createTestState();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      // Sync tabs with one referencing a non-existent panel
      store.dispatch(
        syncWorkspace({
          tabs: [
            { id: 'tab-1' as TabId, name: 'Valid', panelId, createdAt: Date.now(), mountKey: 'm1' },
            {
              id: 'tab-2' as TabId,
              name: 'Orphaned',
              panelId: 'non-existent-panel' as PanelId,
              createdAt: Date.now(),
              mountKey: 'm2',
            },
          ],
        })
      );

      // Should only have the valid tab
      expect(getWorkspace(store).tabs.length).toBe(1);
      expect(getWorkspace(store).tabs[0].id).toBe('tab-1');
    });

    it('rebuilds panelTabs to match tabs array', () => {
      const state = createTestState();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      // Sync with mismatched panelTabs
      store.dispatch(
        syncWorkspace({
          tabs: [
            { id: 'new-tab' as TabId, name: 'New', panelId, createdAt: Date.now(), mountKey: 'm1' },
          ],
          panelTabs: {
            [panelId]: ['wrong-tab-id' as TabId], // Doesn't match tabs
          },
        })
      );

      // panelTabs should be rebuilt from tabs
      expect(getWorkspace(store).panelTabs[panelId]).toEqual(['new-tab']);
    });

    it('fixes activeTabIds referencing non-existent tabs', () => {
      const state = createTestState();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      // Sync with activeTabId pointing to non-existent tab
      store.dispatch(
        syncWorkspace({
          tabs: [
            {
              id: 'real-tab' as TabId,
              name: 'Real',
              panelId,
              createdAt: Date.now(),
              mountKey: 'm1',
            },
          ],
          activeTabIds: {
            [panelId]: 'deleted-tab' as TabId,
          },
        })
      );

      // Should fall back to first tab in panel
      expect(getWorkspace(store).activeTabIds[panelId]).toBe('real-tab');
    });

    it('fixes activePanelId referencing non-existent panel', () => {
      const state = createTestState();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      store.dispatch(
        syncWorkspace({
          activePanelId: 'non-existent' as PanelId,
        })
      );

      // Should fall back to first leaf panel
      expect(getWorkspace(store).activePanelId).toBe(panelId);
    });
  });

  describe('setActivePanel', () => {
    it('sets the active panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(setActivePanel({ panelId: 'panel-2' as PanelId }));

      expect(getWorkspace(store).activePanelId).toBe('panel-2');
    });
  });

  describe('selectTab', () => {
    it('sets the active tab for the panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(selectTab({ tabId: 'tab-2' as TabId, panelId: 'panel-1' as PanelId }));

      expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-2');
      expect(getWorkspace(store).activePanelId).toBe('panel-1');
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

        expect(getWorkspace(store).tabs.length).toBe(3);
      });

      it('allows addTab when below maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 5);

        await store.dispatch(addTab({ panelId: 'test-panel' as PanelId, name: 'New Tab' }));

        expect(getWorkspace(store).tabs.length).toBe(4);
      });

      it('allows unlimited tabs when maxTabs is 0', async () => {
        const store = createTestStore(createStateWithTabs(100), 0);

        await store.dispatch(addTab({ panelId: 'test-panel' as PanelId, name: 'New Tab' }));

        expect(getWorkspace(store).tabs.length).toBe(101);
      });

      it('allows unlimited tabs when maxTabs is negative', async () => {
        const store = createTestStore(createStateWithTabs(50), -1);

        await store.dispatch(addTab({ panelId: 'test-panel' as PanelId, name: 'New Tab' }));

        expect(getWorkspace(store).tabs.length).toBe(51);
      });
    });

    describe('duplicateTab with maxTabs', () => {
      it('blocks duplicateTab when at maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 3);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' as TabId }));

        expect(getWorkspace(store).tabs.length).toBe(3);
      });

      it('allows duplicateTab when below maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 5);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' as TabId }));

        expect(getWorkspace(store).tabs.length).toBe(4);
        expect(getWorkspace(store).tabs[3].name).toBe('Tab 0 (copy)');
      });

      it('allows unlimited tabs when maxTabs is 0 (via duplicate)', async () => {
        const store = createTestStore(createStateWithTabs(100), 0);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' as TabId }));

        expect(getWorkspace(store).tabs.length).toBe(101);
      });
    });

    describe('moveTab does not check maxTabs', () => {
      it('allows moveTab regardless of tab count', () => {
        const store = createTestStore(createTwoPanelState(), 2);

        store.dispatch(moveTab({ tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId }));

        expect(getWorkspace(store).tabs.length).toBe(3);
        const movedTab = getTab(store, 'tab-1');
        expect(movedTab?.panelId).toBe('panel-2');
      });
    });
  });

  // ===========================================================================
  // updateTabLayout Tests
  // ===========================================================================

  describe('updateTabLayout', () => {
    it('updates layout fields on the tab', () => {
      const store = createTestStore(createTestState());

      store.dispatch(
        updateTabLayout({
          tabId: 'test-tab-1' as TabId,
          layoutId: 'chart-layout',
          name: 'Chart View',
          params: { type: 'bar' },
          option: 'default',
        })
      );

      const tab = getTab(store, 'test-tab-1');
      expect(tab?.layoutId).toBe('chart-layout');
      expect(tab?.name).toBe('Chart View');
      expect(tab?.layoutParams).toEqual({ type: 'bar' });
      expect(tab?.layoutOption).toBe('default');
    });

    it('regenerates mountKey when changing layoutId', () => {
      const state = createTestState();
      state.tabs[0].layoutId = 'old-layout';
      const originalMountKey = state.tabs[0].mountKey;
      const store = createTestStore(state);

      store.dispatch(
        updateTabLayout({
          tabId: 'test-tab-1' as TabId,
          layoutId: 'new-layout',
          name: 'New View',
        })
      );

      const tab = getTab(store, 'test-tab-1');
      expect(tab?.mountKey).not.toBe(originalMountKey);
    });

    it('does not regenerate mountKey when setting same layoutId', () => {
      const state = createTestState();
      state.tabs[0].layoutId = 'same-layout';
      const originalMountKey = state.tabs[0].mountKey;
      const store = createTestStore(state);

      store.dispatch(
        updateTabLayout({
          tabId: 'test-tab-1' as TabId,
          layoutId: 'same-layout',
          name: 'Same View',
        })
      );

      const tab = getTab(store, 'test-tab-1');
      expect(tab?.mountKey).toBe(originalMountKey);
    });

    it('does not regenerate mountKey when setting layoutId on tab without existing layout', () => {
      const state = createTestState();
      state.tabs[0].layoutId = undefined;
      const originalMountKey = state.tabs[0].mountKey;
      const store = createTestStore(state);

      store.dispatch(
        updateTabLayout({
          tabId: 'test-tab-1' as TabId,
          layoutId: 'new-layout',
          name: 'New View',
        })
      );

      const tab = getTab(store, 'test-tab-1');
      expect(tab?.mountKey).toBe(originalMountKey);
    });

    it('is a no-op when tab does not exist', () => {
      const store = createTestStore(createTestState());
      const tabCountBefore = getWorkspace(store).tabs.length;

      store.dispatch(
        updateTabLayout({
          tabId: 'nonexistent' as TabId,
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
        const store = createTestStore(createTestState());
        const tabCountBefore = getWorkspace(store).tabs.length;

        const result = await store.dispatch(duplicateTab({ tabId: 'nonexistent' as TabId }));

        expect(result.type).toBe('workspace/duplicateTab/rejected');
        expect(getWorkspace(store).tabs.length).toBe(tabCountBefore);
      });
    });

    describe('moveTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(createTwoPanelState());
        const stateBefore = store.getState().workspace;

        store.dispatch(
          moveTab({ tabId: 'nonexistent' as TabId, targetPanelId: 'panel-2' as PanelId })
        );

        expect(store.getState().workspace).toEqual(stateBefore);
      });

      it('initializes panelTabs for new target panel', () => {
        const state = createTestState();
        // Remove panelTabs entry for a secondary panel ID
        const panel2Id = 'panel-2' as PanelId;
        state.panel.children = [
          {
            id: 'test-panel-1' as PanelId,
            order: 0 as const,
            direction: 'horizontal',
            children: [],
            size: '50%',
          },
          { id: panel2Id, order: 1 as const, direction: 'horizontal', children: [], size: '50%' },
        ];
        const store = createTestStore(state);

        store.dispatch(moveTab({ tabId: 'test-tab-1' as TabId, targetPanelId: panel2Id }));

        expect(getWorkspace(store).panelTabs[panel2Id]).toContain('test-tab-1');
      });
    });

    describe('renameTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());
        const originalName = getTab(store, 'test-tab-1')?.name;

        store.dispatch(renameTab({ tabId: 'nonexistent' as TabId, name: 'New Name' }));

        expect(getTab(store, 'test-tab-1')?.name).toBe(originalName);
      });

      it('handles empty string name', () => {
        const store = createTestStore(createTestState());

        store.dispatch(renameTab({ tabId: 'test-tab-1' as TabId, name: '' }));

        expect(getTab(store, 'test-tab-1')?.name).toBe('');
      });
    });

    describe('selectTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());
        const originalActiveTabId = getWorkspace(store).activeTabIds['test-panel-1'];

        store.dispatch(
          selectTab({ tabId: 'nonexistent' as TabId, panelId: 'test-panel-1' as PanelId })
        );

        // Should not change activeTabId when tab doesn't exist
        expect(getWorkspace(store).activeTabIds['test-panel-1']).toBe(originalActiveTabId);
      });

      it('is a no-op when tab belongs to different panel', () => {
        const state = createTwoPanelState();
        const store = createTestStore(state);

        // Try to select tab-1 (belongs to panel-1) in panel-2
        store.dispatch(selectTab({ tabId: 'tab-1' as TabId, panelId: 'panel-2' as PanelId }));

        // Should not change panel-2's activeTabId
        expect(getWorkspace(store).activeTabIds['panel-2']).toBe('tab-3');
      });
    });

    describe('setActivePanel edge cases', () => {
      it('is a no-op when panel does not exist', () => {
        const store = createTestStore(createTestState());
        const originalPanelId = getWorkspace(store).activePanelId;

        store.dispatch(setActivePanel({ panelId: 'nonexistent' as PanelId }));

        // Should not change activePanelId when panel doesn't exist
        expect(getWorkspace(store).activePanelId).toBe(originalPanelId);
      });

      it('is a no-op for container panels (non-leaf)', () => {
        const state = createTwoPanelState();
        const store = createTestStore(state);
        const originalPanelId = getWorkspace(store).activePanelId;

        // Try to set active panel to the container panel
        store.dispatch(setActivePanel({ panelId: 'container-1' as PanelId }));

        // Should not change since container-1 is not a leaf
        expect(getWorkspace(store).activePanelId).toBe(originalPanelId);
      });
    });

    describe('lock/unlock edge cases', () => {
      it('lockTab is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());

        store.dispatch(lockTab({ tabId: 'nonexistent' as TabId }));

        // No error thrown, existing tabs unaffected
        expect(getTab(store, 'test-tab-1')?.locked).toBeFalsy();
      });

      it('unlockTab is a no-op when tab does not exist', () => {
        const state = createTestState();
        state.tabs[0].locked = true;
        const store = createTestStore(state);

        store.dispatch(unlockTab({ tabId: 'nonexistent' as TabId }));

        // Existing tab still locked
        expect(getTab(store, 'test-tab-1')?.locked).toBe(true);
      });
    });

    describe('setTabIcon/setTabStyle edge cases', () => {
      it('setTabIcon is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());

        store.dispatch(setTabIcon({ tabId: 'nonexistent' as TabId, icon: 'Star' }));

        expect(getTab(store, 'test-tab-1')?.icon).toBeUndefined();
      });

      it('setTabStyle is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());

        store.dispatch(setTabStyle({ tabId: 'nonexistent' as TabId, style: 'blue' }));

        expect(getTab(store, 'test-tab-1')?.style).toBeUndefined();
      });

      it('setTabIcon clears icon when undefined', () => {
        const state = createTestState();
        state.tabs[0].icon = 'Star';
        const store = createTestStore(state);

        store.dispatch(setTabIcon({ tabId: 'test-tab-1' as TabId, icon: undefined }));

        expect(getTab(store, 'test-tab-1')?.icon).toBeUndefined();
      });
    });

    describe('refreshTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());
        const originalMountKey = getTab(store, 'test-tab-1')?.mountKey;

        store.dispatch(refreshTab({ tabId: 'nonexistent' as TabId }));

        expect(getTab(store, 'test-tab-1')?.mountKey).toBe(originalMountKey);
      });
    });
  });

  // ===========================================================================
  // MAX_LEAF_PANELS Tests
  // ===========================================================================

  describe('MAX_LEAF_PANELS enforcement', () => {
    function createStateWithManyPanels(panelCount: number): WorkspaceState {
      // Create a state with multiple leaf panels
      const panelIds = Array.from({ length: panelCount }, (_, i) => `panel-${i}` as PanelId);
      const tabs: Tab[] = panelIds.map((panelId, i) => ({
        id: `tab-${i}` as TabId,
        name: `Tab ${i}`,
        panelId,
        createdAt: Date.now(),
        mountKey: `m${i}`,
      }));

      // Add an extra tab to first panel so it can be split
      tabs.push({
        id: 'extra-tab' as TabId,
        name: 'Extra Tab',
        panelId: panelIds[0],
        createdAt: Date.now(),
        mountKey: 'extra',
      });

      const containerId = 'container' as PanelId;
      // Note: order is typed as 0 | 1, so we use modulo. For testing leaf panel count,
      // the exact order values don't affect the test logic since getLeafPanelIds
      // walks all children regardless of order.
      const childPanels: Panel[] = panelIds.map((id, i) => ({
        id,
        order: (i % 2) as 0 | 1,
        direction: 'horizontal' as const,
        children: [],
        size: `${100 / panelCount}%`,
      }));

      const panelTabs: Record<PanelId, TabId[]> = {};
      for (const panelId of panelIds) {
        panelTabs[panelId] = tabs.filter((t) => t.panelId === panelId).map((t) => t.id);
      }

      const activeTabIds: Record<PanelId, TabId> = {};
      for (const panelId of panelIds) {
        activeTabIds[panelId] = panelTabs[panelId][0];
      }

      return {
        tabs,
        panel: {
          id: containerId,
          order: 0,
          direction: 'horizontal',
          children: childPanels,
          size: '100%',
        },
        panelTabs,
        activeTabIds,
        activePanelId: panelIds[0],
        favoriteLayouts: [],
        searchBarsHidden: false,
      };
    }

    it('blocks split when at MAX_LEAF_PANELS limit', () => {
      const store = createTestStore(createStateWithManyPanels(MAX_LEAF_PANELS));
      const leafCountBefore = countLeafPanels(getWorkspace(store).panel);

      store.dispatch(
        splitPanel({
          panelId: 'panel-0' as PanelId,
          direction: 'horizontal',
          tabId: 'extra-tab' as TabId,
        })
      );

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(leafCountBefore);
    });

    it('allows split when below MAX_LEAF_PANELS limit', async () => {
      const store = createTestStore(createStateWithManyPanels(MAX_LEAF_PANELS - 1));
      const leafCountBefore = countLeafPanels(getWorkspace(store).panel);

      store.dispatch(
        splitPanel({
          panelId: 'panel-0' as PanelId,
          direction: 'horizontal',
          tabId: 'extra-tab' as TabId,
        })
      );

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(leafCountBefore + 1);
    });
  });

  // ===========================================================================
  // State Invariant Tests
  // ===========================================================================

  describe('state invariants', () => {
    it('maintains consistent panelTabs after multiple operations', async () => {
      const store = createTestStore(createTestState());

      // Add several tabs
      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'Tab 2' }));
      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'Tab 3' }));

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
      const store = createTestStore(createTwoPanelState());
      const { activeTabIds, panelTabs } = getWorkspace(store);

      // Verify all activeTabIds point to tabs that exist in their panel
      for (const [panelId, activeTabId] of Object.entries(activeTabIds)) {
        expect(panelTabs[panelId as PanelId]).toContain(activeTabId);
      }

      // Remove active tab
      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));

      // Verify activeTabIds are still valid
      const stateAfter = getWorkspace(store);
      for (const [panelId, activeTabId] of Object.entries(stateAfter.activeTabIds)) {
        expect(stateAfter.panelTabs[panelId as PanelId]).toContain(activeTabId);
      }
    });

    it('maintains consistent tab.panelId with panelTabs mapping', async () => {
      const store = createTestStore(createTwoPanelState());

      // Move a tab
      store.dispatch(moveTab({ tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId }));

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
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));
      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));
      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      const { tabs } = getWorkspace(store);
      const ids = tabs.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all tabs have unique mountKeys', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));
      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));

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
      const store = createTestStore(createTestState(), 1); // maxTabs = 1, already has 1 tab
      const stateBefore = getWorkspace(store);

      const result = await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId }));

      expect(result.type).toBe('workspace/addTab/rejected');
      expect(getWorkspace(store).tabs).toEqual(stateBefore.tabs);
    });

    it('duplicateTab.rejected does not modify state', async () => {
      const store = createTestStore(createTestState(), 1);
      const stateBefore = getWorkspace(store);

      const result = await store.dispatch(duplicateTab({ tabId: 'test-tab-1' as TabId }));

      expect(result.type).toBe('workspace/duplicateTab/rejected');
      expect(getWorkspace(store).tabs).toEqual(stateBefore.tabs);
    });
  });

  // ===========================================================================
  // Complex Workflow Tests
  // ===========================================================================

  describe('complex workflows', () => {
    it('handles split -> move -> collapse workflow', async () => {
      const store = createTestStore(createTestState());

      // Add second tab to enable split
      await store.dispatch(addTab({ panelId: 'test-panel-1' as PanelId, name: 'Tab 2' }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      // Split panel
      store.dispatch(
        splitPanel({
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        })
      );

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(2);
      const tab2 = getTab(store, tab2Id);
      const newPanelId = tab2?.panelId;
      expect(newPanelId).not.toBe('test-panel-1');

      // Collapse the new panel back
      store.dispatch(collapsePanel({ panelId: newPanelId as PanelId }));

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
      expect(getWorkspace(store).tabs.length).toBe(2);
      // Both tabs should be in the same panel now
      const tabsInPanel = getWorkspace(store).panelTabs['test-panel-1'];
      expect(tabsInPanel).toContain('test-tab-1');
      expect(tabsInPanel).toContain(tab2Id);
    });

    it('handles add -> duplicate -> remove workflow', async () => {
      const store = createTestStore(createTestState());

      // Add tab
      await store.dispatch(
        addTab({ panelId: 'test-panel-1' as PanelId, name: 'Chart', layoutId: 'chart' })
      );
      expect(getWorkspace(store).tabs.length).toBe(2);

      // Duplicate it
      const chartTabId = getWorkspace(store).tabs[1].id;
      await store.dispatch(duplicateTab({ tabId: chartTabId as TabId }));
      expect(getWorkspace(store).tabs.length).toBe(3);

      const duplicateTabId = getWorkspace(store).tabs[2].id;
      expect(getTab(store, duplicateTabId)?.name).toBe('Chart (copy)');
      expect(getTab(store, duplicateTabId)?.layoutId).toBe('chart');

      // Remove duplicate
      store.dispatch(removeTab({ tabId: duplicateTabId as TabId }));
      expect(getWorkspace(store).tabs.length).toBe(2);
    });

    it('handles lock -> remove attempt -> unlock -> remove workflow', () => {
      const store = createTestStore(createTwoPanelState());

      // Lock tab
      store.dispatch(lockTab({ tabId: 'tab-1' as TabId }));
      expect(getTab(store, 'tab-1')?.locked).toBe(true);

      // Try to remove (should fail)
      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));
      expect(getTab(store, 'tab-1')).toBeDefined();

      // Unlock
      store.dispatch(unlockTab({ tabId: 'tab-1' as TabId }));
      expect(getTab(store, 'tab-1')?.locked).toBe(false);

      // Now remove succeeds
      store.dispatch(removeTab({ tabId: 'tab-1' as TabId }));
      expect(getTab(store, 'tab-1')).toBeUndefined();
    });
  });
});
