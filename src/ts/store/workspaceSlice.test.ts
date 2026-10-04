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
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import undoable from 'redux-undo';
import {
  workspaceReducer,
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
} from './workspaceSlice';
import type { WorkspaceState, ThunkExtra } from './types';
import type { Tab, PanelNode, PanelId, TabId } from '@types';
import { subscribeToToasts, type ToastEvent } from '@utils/toastEmitter';
import { MAX_LEAF_PANELS } from '@constants/panels';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a test store with optional preloaded state and maxTabs config.
 * Wraps workspace reducer with undoable() to match real store structure.
 */
function createTestStore(
  preloadedState?: WorkspaceState,
  maxTabs = 16,
  registeredLayouts: Record<string, { name: string; allowMultiple?: boolean }> = {},
  maxPanels = MAX_LEAF_PANELS
) {
  const thunkExtra: ThunkExtra = {
    getMaxTabs: () => maxTabs,
    getMaxPanels: () => maxPanels,
    getRegisteredLayouts: () => registeredLayouts,
  };

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
 * Gets the workspace state (unwraps redux-undo .present).
 */
function getWorkspace(store: TestStore): WorkspaceState {
  return store.getState().workspace.present;
}

/**
 * Creates a minimal valid state for testing.
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
 * Creates a state with two panels for split/move testing.
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

describe('workspaceSlice', () => {
  describe('addTab', () => {
    it('adds a new tab to the specified panel', async () => {
      const store = createTestStore(createTestState());
      const initialCount = getWorkspace(store).tabs.length;

      await store.dispatch(addTab({ panelId: 'test-panel-1', name: 'New Tab' }));

      expect(getWorkspace(store).tabs.length).toBe(initialCount + 1);
      const newTab = getWorkspace(store).tabs[1];
      expect(newTab.name).toBe('New Tab');
      expect(newTab.panelId).toBe('test-panel-1');
    });

    it('adds tab to panelTabs tracking', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' }));

      const newTabId = getWorkspace(store).tabs[1].id;
      expect(getWorkspace(store).panelTabs['test-panel-1']).toContain(newTabId);
    });

    it('sets new tab as active', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' }));

      const newTabId = getWorkspace(store).tabs[1].id;
      expect(getWorkspace(store).activeTabIds['test-panel-1']).toBe(newTabId);
      expect(getWorkspace(store).activePanelId).toBe('test-panel-1');
    });

    it('creates tab with layoutId when provided', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(
        addTab({
          panelId: 'test-panel-1',
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

      await store.dispatch(addTab({ panelId: 'test-panel-1' }));

      const newTab = getWorkspace(store).tabs[1];
      expect(newTab.mountKey).toBeDefined();
      expect(newTab.mountKey).not.toBe(getWorkspace(store).tabs[0].mountKey);
    });
  });

  describe('removeTab', () => {
    it('removes tab from tabs array', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(removeTab({ tabId: 'tab-1' }));

      expect(getWorkspace(store).tabs.length).toBe(2);
      expect(getTab(store, 'tab-1')).toBeUndefined();
    });

    it('removes tab from panelTabs tracking', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(removeTab({ tabId: 'tab-1' }));

      expect(getWorkspace(store).panelTabs['panel-1']).not.toContain('tab-1');
    });

    it('does not remove locked tabs', () => {
      const state = createTestState();
      state.tabs[0].locked = true;
      const store = createTestStore(state);

      store.dispatch(removeTab({ tabId: 'test-tab-1' }));

      expect(getWorkspace(store).tabs.length).toBe(1);
      expect(getTab(store, 'test-tab-1')).toBeDefined();
    });

    it('updates activeTabId when removing active tab', () => {
      const store = createTestStore(createTwoPanelState());
      // tab-1 is active in panel-1

      store.dispatch(removeTab({ tabId: 'tab-1' }));

      // Should select remaining tab in panel
      expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-2');
    });

    it('is a no-op when tab does not exist', () => {
      const store = createTestStore(createTestState());
      const tabCountBefore = getWorkspace(store).tabs.length;

      store.dispatch(removeTab({ tabId: 'nonexistent' }));

      expect(getWorkspace(store).tabs.length).toBe(tabCountBefore);
    });
  });

  describe('duplicateTab', () => {
    it('creates a copy of the tab', async () => {
      const state = createTestState();
      state.tabs[0].layoutId = 'test-layout';
      state.tabs[0].layoutParams = { foo: 'bar' };
      const store = createTestStore(state);

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' }));

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

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' }));

      const duplicate = getWorkspace(store).tabs[1];
      expect(duplicate.locked).toBe(false);
    });

    it('adds duplicate to same panel as original', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' }));

      const duplicate = getWorkspace(store).tabs[1];
      expect(duplicate.panelId).toBe('test-panel-1');
      expect(getWorkspace(store).panelTabs['test-panel-1']).toContain(duplicate.id);
    });

    it('creates independent copy of layoutParams', async () => {
      const state = createTestState();
      state.tabs[0].layoutParams = { key: 'original' };
      const store = createTestStore(state);

      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' }));

      const duplicate = getWorkspace(store).tabs[1];
      expect(duplicate.layoutParams).toEqual({ key: 'original' });
      expect(duplicate.layoutParams).not.toBe(state.tabs[0].layoutParams);
    });
  });

  describe('moveTab', () => {
    it('moves tab between panels', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(moveTab({ tabId: 'tab-1', targetPanelId: 'panel-2' }));

      const movedTab = getTab(store, 'tab-1');
      expect(movedTab?.panelId).toBe('panel-2');
      expect(getWorkspace(store).panelTabs['panel-1']).not.toContain('tab-1');
      expect(getWorkspace(store).panelTabs['panel-2']).toContain('tab-1');
    });

    it('updates activeTabIds for both panels', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(moveTab({ tabId: 'tab-1', targetPanelId: 'panel-2' }));

      expect(getWorkspace(store).activeTabIds['panel-2']).toBe('tab-1');
      expect(getWorkspace(store).activePanelId).toBe('panel-2');
      expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-2');
    });

    it('is a no-op when moving to same panel', () => {
      const store = createTestStore(createTestState());
      const stateBefore = store.getState().workspace;

      store.dispatch(moveTab({ tabId: 'test-tab-1', targetPanelId: 'test-panel-1' }));

      expect(store.getState().workspace).toEqual(stateBefore);
    });

    it('moves tab to specific index when provided', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(moveTab({ tabId: 'tab-1', targetPanelId: 'panel-2', targetIndex: 0 }));

      expect(getWorkspace(store).panelTabs['panel-2'][0]).toBe('tab-1');
      expect(getWorkspace(store).panelTabs['panel-2'][1]).toBe('tab-3');
    });

    it('is a no-op when target panel does not exist', () => {
      const store = createTestStore(createTwoPanelState());
      const stateBefore = getWorkspace(store);

      store.dispatch(
        moveTab({
          tabId: 'tab-1',
          targetPanelId: 'nonexistent-panel',
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
          tabId: 'tab-1',
          targetPanelId: 'container-1',
        })
      );

      expect(getWorkspace(store)).toEqual(stateBefore);
    });
  });

  describe('reorderTab', () => {
    it('reorders tabs within a panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1', fromIndex: 0, toIndex: 1 }));

      expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
    });

    it('clamps toIndex to valid range', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1', fromIndex: 0, toIndex: 100 }));

      expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
    });

    it('ignores invalid fromIndex', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(reorderTab({ panelId: 'panel-1', fromIndex: -1, toIndex: 0 }));

      expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-1', 'tab-2']);
    });
  });

  describe('renameTab', () => {
    it('renames the specified tab', () => {
      const store = createTestStore(createTestState());

      store.dispatch(renameTab({ tabId: 'test-tab-1', name: 'Renamed Tab' }));

      expect(getTab(store, 'test-tab-1')?.name).toBe('Renamed Tab');
    });

    it('truncates name to MAX_TAB_NAME_LENGTH', () => {
      const store = createTestStore(createTestState());
      const longName = 'A'.repeat(MAX_TAB_NAME_LENGTH + 10);

      store.dispatch(renameTab({ tabId: 'test-tab-1', name: longName }));

      expect(getTab(store, 'test-tab-1')?.name.length).toBe(MAX_TAB_NAME_LENGTH);
    });
  });

  describe('lockTab / unlockTab / toggleTabLock', () => {
    it('lockTab locks a tab', () => {
      const store = createTestStore(createTestState());

      store.dispatch(lockTab({ tabId: 'test-tab-1' }));

      expect(getTab(store, 'test-tab-1')?.locked).toBe(true);
    });

    it('unlockTab unlocks a tab', () => {
      const state = createTestState();
      state.tabs[0].locked = true;
      const store = createTestStore(state);

      store.dispatch(unlockTab({ tabId: 'test-tab-1' }));

      expect(getTab(store, 'test-tab-1')?.locked).toBe(false);
    });

    it('toggleTabLock toggles lock state', () => {
      const store = createTestStore(createTestState());

      store.dispatch(toggleTabLock({ tabId: 'test-tab-1' }));
      expect(getTab(store, 'test-tab-1')?.locked).toBe(true);

      store.dispatch(toggleTabLock({ tabId: 'test-tab-1' }));
      expect(getTab(store, 'test-tab-1')?.locked).toBe(false);
    });
  });

  describe('setTabIcon / setTabStyle', () => {
    it('setTabIcon sets the tab icon', () => {
      const store = createTestStore(createTestState());

      store.dispatch(setTabIcon({ tabId: 'test-tab-1', icon: 'Star' }));

      expect(getTab(store, 'test-tab-1')?.icon).toBe('Star');
    });

    it('setTabStyle sets the tab style', () => {
      const store = createTestStore(createTestState());

      store.dispatch(setTabStyle({ tabId: 'test-tab-1', style: 'blue' }));

      expect(getTab(store, 'test-tab-1')?.style).toBe('blue');
    });
  });

  describe('refreshTab', () => {
    it('updates mountKey to trigger remount', () => {
      const state = createTestState();
      state.tabs[0].layoutId = 'test-layout';
      const originalMountKey = state.tabs[0].mountKey;
      const store = createTestStore(state);

      store.dispatch(refreshTab({ tabId: 'test-tab-1' }));

      expect(getTab(store, 'test-tab-1')?.mountKey).not.toBe(originalMountKey);
    });

    it('does nothing for tabs without layoutId', () => {
      const state = createTestState();
      state.tabs[0].layoutId = undefined;
      const originalMountKey = state.tabs[0].mountKey;
      const store = createTestStore(state);

      store.dispatch(refreshTab({ tabId: 'test-tab-1' }));

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
      await store.dispatch(addTab({ panelId: 'test-panel-1', name: 'Tab 2' }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      await store.dispatch(
        splitPanel({
          panelId: 'test-panel-1',
          direction: 'horizontal',
          tabId: tab2Id,
        })
      );

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(2);
    });

    it('preserves original panel ID', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      await store.dispatch(
        splitPanel({
          panelId: 'test-panel-1',
          direction: 'horizontal',
          tabId: tab2Id,
        })
      );

      const panel = getWorkspace(store).panel;
      const hasOriginalPanelId = panel.children.some((c) => c.id === 'test-panel-1');
      expect(hasOriginalPanelId).toBe(true);
    });

    it('moves tab to new panel', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1', name: 'Tab 2' }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      await store.dispatch(
        splitPanel({
          panelId: 'test-panel-1',
          direction: 'horizontal',
          tabId: tab2Id,
        })
      );

      const tab2 = getTab(store, tab2Id);
      expect(tab2?.panelId).not.toBe('test-panel-1');
      expect(getWorkspace(store).panelTabs['test-panel-1']).not.toContain(tab2Id);
    });

    it('does not split panel with only one tab', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(
        splitPanel({
          panelId: 'test-panel-1',
          direction: 'horizontal',
          tabId: 'test-tab-1',
        })
      );

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
    });

    it('respects position=before for left/top placement', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      await store.dispatch(
        splitPanel({
          panelId: 'test-panel-1',
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
      const store = createTestStore(createTwoPanelState());

      store.dispatch(collapsePanel({ panelId: 'panel-2' }));

      expect(getTab(store, 'tab-3')?.panelId).toBe('panel-1');
      expect(getWorkspace(store).panelTabs['panel-1']).toContain('tab-3');
    });

    it('cleans up collapsed panel state', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(collapsePanel({ panelId: 'panel-2' }));

      expect(getWorkspace(store).panelTabs['panel-2']).toBeUndefined();
      expect(getWorkspace(store).activeTabIds['panel-2']).toBeUndefined();
    });

    it('does not collapse last remaining panel', () => {
      const store = createTestStore(createTestState());

      store.dispatch(collapsePanel({ panelId: 'test-panel-1' }));

      expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
    });

    it('updates activePanelId to remaining panel', () => {
      const state = createTwoPanelState();
      state.activePanelId = 'panel-2';
      const store = createTestStore(state);

      store.dispatch(collapsePanel({ panelId: 'panel-2' }));

      expect(getWorkspace(store).activePanelId).toBe('panel-1');
    });
  });

  describe('resizePanel', () => {
    it('updates panel size with string value', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(resizePanel({ panelId: 'panel-1', size: '30%' }));

      const panel1 = getWorkspace(store).panel.children.find((c) => c.id === 'panel-1');
      expect(panel1?.size).toBe('30%');
    });

    it('accepts numeric size values', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(resizePanel({ panelId: 'panel-1', size: 300 }));

      const panel1 = getWorkspace(store).panel.children.find((c) => c.id === 'panel-1');
      expect(panel1?.size).toBe(300);
    });
  });

  describe('pinPanel / unpinPanel', () => {
    it('pinPanel sets pinned to true', () => {
      const store = createTestStore(createTestState());

      store.dispatch(pinPanel({ panelId: 'test-panel-1' }));

      expect(getWorkspace(store).panel.pinned).toBe(true);
    });

    it('unpinPanel sets pinned to false', () => {
      const state = createTestState();
      state.panel.pinned = true;
      const store = createTestStore(state);

      store.dispatch(unpinPanel({ panelId: 'test-panel-1' }));

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
    it('resets state to a fresh initial workspace', () => {
      const state = createTwoPanelState();
      state.favoriteLayouts = ['layout-1', 'layout-2'];
      state.searchBarsHidden = true;
      const store = createTestStore(state);

      store.dispatch(resetWorkspace());

      expect(getWorkspace(store).tabs.length).toBe(1);
      expect(getWorkspace(store).favoriteLayouts).toEqual([]);
      expect(getWorkspace(store).searchBarsHidden).toBe(false);
    });

    it('generates new tab and panel IDs instead of reusing the initial ones (02 A-6)', () => {
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

    it('computes createdAt at call time, not at module load (02 A-6)', () => {
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

    it('lets the slice module load when crypto.randomUUID is unavailable (02 A-1)', async () => {
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

    it('never generates IDs while the module is being evaluated (02 A-1 guard)', async () => {
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
            { id: 'tab-1', name: 'Valid', panelId, createdAt: Date.now(), mountKey: 'm1' },
            {
              id: 'tab-2',
              name: 'Orphaned',
              panelId: 'non-existent-panel',
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

    it('replaces stale ids in panelTabs with the tabs that exist', () => {
      const state = createTestState();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      // Sync with mismatched panelTabs
      store.dispatch(
        syncWorkspace({
          tabs: [{ id: 'new-tab', name: 'New', panelId, createdAt: Date.now(), mountKey: 'm1' }],
          panelTabs: {
            [panelId]: ['wrong-tab-id'], // Doesn't match tabs
          },
        })
      );

      // The unknown id is dropped and the real tab is appended
      expect(getWorkspace(store).panelTabs[panelId]).toEqual(['new-tab']);
    });

    describe('panelTabs order (02 A-3)', () => {
      /** Three tabs in one panel, created a-b-c but displayed c-a-b. */
      function createReorderedState(): WorkspaceState {
        const panelId = 'panel-1' as PanelId;
        const mk = (id: string, createdAt: number) => ({
          id: id,
          name: id,
          panelId,
          createdAt,
          mountKey: `m-${id}`,
        });
        return {
          tabs: [mk('tab-a', 1), mk('tab-b', 2), mk('tab-c', 3)],
          panel: { id: panelId, order: 0, direction: 'horizontal', children: [], size: '100%' },
          panelTabs: { [panelId]: ['tab-c', 'tab-a', 'tab-b'] as TabId[] },
          activeTabIds: { [panelId]: 'tab-c' },
          activePanelId: panelId,
          favoriteLayouts: [],
          searchBarsHidden: false,
        };
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

        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-c', 'tab-a', 'tab-b']);
        expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-c');
      });

      it('survives a real reorderTab followed by a readWorkspace/updateWorkspace round trip', () => {
        const store = createTestStore(createTwoPanelState());
        store.dispatch(reorderTab({ panelId: 'panel-1', fromIndex: 0, toIndex: 1 }));
        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);

        const snapshot = getWorkspace(store);
        store.dispatch(syncWorkspace({ ...snapshot }));

        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
        expect(getWorkspace(store).panelTabs['panel-2']).toEqual(['tab-3']);
      });

      it('keeps the current order when the payload does not include panelTabs', () => {
        const store = createTestStore(createReorderedState());

        store.dispatch(syncWorkspace({ searchBarsHidden: true }));

        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-c', 'tab-a', 'tab-b']);
      });

      it('keeps the current order when only tabs are sent, appending new tabs at the end', () => {
        const state = createReorderedState();
        const store = createTestStore(state);
        const panelId = state.panel.id;

        store.dispatch(
          syncWorkspace({
            tabs: [
              ...state.tabs,
              { id: 'tab-d', name: 'tab-d', panelId, createdAt: 4, mountKey: 'm-d' },
            ],
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
        state.panelTabs = { 'panel-1': ['tab-c', 'tab-a'] as TabId[] }; // tab-b missing
        const store = createTestStore(state);

        store.dispatch(syncWorkspace({ panelTabs: state.panelTabs }));

        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-c', 'tab-a', 'tab-b']);
      });

      it('drops ids that are unknown, duplicated, or belong to another panel', () => {
        const store = createTestStore(createTwoPanelState());

        store.dispatch(
          syncWorkspace({
            panelTabs: {
              // tab-3 lives in panel-2 (tab.panelId wins), ghost does not exist, tab-1 twice
              'panel-1': ['tab-3', 'ghost', 'tab-2', 'tab-1', 'tab-1'] as TabId[],
              'panel-2': [] as TabId[],
            },
          })
        );

        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
        expect(getWorkspace(store).panelTabs['panel-2']).toEqual(['tab-3']);
      });

      it('tolerates a non-array per-panel value from updateWorkspace', () => {
        const store = createTestStore(createReorderedState());

        expect(() =>
          store.dispatch(syncWorkspace({ panelTabs: { 'panel-1': 'tab-a' as never } }))
        ).not.toThrow();

        // Malformed list: that panel is rebuilt from tabs order
        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-a', 'tab-b', 'tab-c']);
      });

      it('builds the list for a panel missing from the payload from tabs order', () => {
        const store = createTestStore(createTwoPanelState());

        store.dispatch(syncWorkspace({ panelTabs: { 'panel-1': ['tab-2', 'tab-1'] as TabId[] } }));

        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
        expect(getWorkspace(store).panelTabs['panel-2']).toEqual(['tab-3']);
      });

      it('drops panelTabs keys that are not leaf panels', () => {
        const store = createTestStore(createTwoPanelState());

        store.dispatch(
          syncWorkspace({
            panelTabs: {
              'panel-1': ['tab-2', 'tab-1'],
              'panel-2': ['tab-3'],
              'container-1': ['tab-1'],
              'gone-panel': ['tab-3'],
            },
          })
        );

        expect(Object.keys(getWorkspace(store).panelTabs).sort()).toEqual(['panel-1', 'panel-2']);
        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
        expect(getWorkspace(store).panelTabs['panel-2']).toEqual(['tab-3']);
      });

      it('falls back to the first displayed tab (not the first created) when the active tab disappears', () => {
        const state = createReorderedState();
        state.panelTabs = { 'panel-1': ['tab-b', 'tab-c', 'tab-a'] as TabId[] };
        state.activeTabIds = { 'panel-1': 'tab-b' };
        const store = createTestStore(state);

        store.dispatch(syncWorkspace({ tabs: state.tabs.filter((t) => t.id !== 'tab-b') }));

        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-c', 'tab-a']);
        expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-c');
      });

      it('removes tabs from panelTabs when they are removed from tabs', () => {
        const state = createReorderedState();
        const store = createTestStore(state);

        store.dispatch(syncWorkspace({ tabs: state.tabs.filter((t) => t.id !== 'tab-a') }));

        expect(getWorkspace(store).panelTabs['panel-1']).toEqual(['tab-c', 'tab-b']);
        expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-c');
      });
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
              id: 'real-tab',
              name: 'Real',
              panelId,
              createdAt: Date.now(),
              mountKey: 'm1',
            },
          ],
          activeTabIds: {
            [panelId]: 'deleted-tab',
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
          activePanelId: 'non-existent',
        })
      );

      // Should fall back to first leaf panel
      expect(getWorkspace(store).activePanelId).toBe(panelId);
    });
  });

  describe('reconcileWithServer (02 B-2)', () => {
    /** Two panels: panel-1 has a locked tab on layout 'gone' and a tab on 'home'; panel-2 one tab on 'gone'. */
    function createStaleState(): WorkspaceState {
      const state = createTwoPanelState();
      state.tabs[0].layoutId = 'gone';
      state.tabs[0].locked = true;
      state.tabs[1].layoutId = 'home';
      state.tabs[2].layoutId = 'gone';
      state.serverSessionId = 'old';
      return state;
    }

    function collectToasts() {
      const events: ToastEvent[] = [];
      const unsubscribe = subscribeToToasts((e) => events.push(e));
      return { events, unsubscribe };
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
      const state = createTwoPanelState();
      const store = createTestStore(state);

      store.dispatch(reconcileWithServer({ serverSessionId: 'v1', registeredLayoutIds: ['home'] }));

      expect(getWorkspace(store).serverSessionId).toBe('v1');
      expect(getWorkspace(store).tabs.map((t) => t.id)).toEqual(['tab-1', 'tab-2', 'tab-3']);
    });

    it('closes tabs whose layout is no longer registered, locked ones included, without toasting from the reducer', () => {
      const store = createTestStore(createStaleState());
      const { events, unsubscribe } = collectToasts();

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] })
      );
      unsubscribe();

      const ws = getWorkspace(store);
      expect(ws.tabs.map((t) => t.id)).toEqual(['tab-2']);
      // panel-2 lost its only tab and collapsed; panel-1 remains as the single leaf
      expect(Object.keys(ws.panelTabs)).toEqual(['panel-1']);
      expect(ws.panelTabs['panel-1']).toEqual(['tab-2']);
      expect(ws.activeTabIds['panel-1']).toBe('tab-2');
      expect(ws.activePanelId).toBe('panel-1');
      expect(ws.serverSessionId).toBe('new');
      // The toast is raised later by <LoadNotice /> from ui.loadNotice (set by the
      // reconcile middleware): during REHYDRATE nobody is subscribed yet.
      expect(events).toHaveLength(0);
    });

    it('keeps the saved active panel when a different panel collapses', () => {
      const state = createStaleState();
      // panel-2 (only tab on 'gone') will collapse; the user had panel-1 focused.
      state.activePanelId = 'panel-1';
      state.tabs[0].layoutId = 'home';
      state.tabs[0].locked = false;
      const store = createTestStore(state);

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] })
      );

      expect(getWorkspace(store).activePanelId).toBe('panel-1');
    });

    it('moves focus when the active panel itself collapses', () => {
      const state = createStaleState();
      state.activePanelId = 'panel-2';
      state.tabs[0].layoutId = 'home';
      state.tabs[0].locked = false;
      const store = createTestStore(state);

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] })
      );

      expect(getWorkspace(store).activePanelId).toBe('panel-1');
    });

    it('prunes unknown layouts even when the session id has not changed (safety net)', () => {
      const state = createStaleState();
      state.serverSessionId = 'same';
      const store = createTestStore(state);

      store.dispatch(
        reconcileWithServer({ serverSessionId: 'same', registeredLayoutIds: ['home'] })
      );

      expect(getWorkspace(store).tabs.map((t) => t.id)).toEqual(['tab-2']);
    });

    it('spawns a blank tab when every tab is closed', () => {
      const state = createTestState();
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
      const state = createTwoPanelState(); // no layoutIds at all
      const store = createTestStore(state);

      store.dispatch(reconcileWithServer({ serverSessionId: 'v1', registeredLayoutIds: ['home'] }));

      expect(getWorkspace(store).tabs).toHaveLength(3);
    });

    it('never prunes when the registry is empty (metadata may not be injected)', () => {
      const store = createTestStore(createStaleState());
      const { events, unsubscribe } = collectToasts();

      store.dispatch(reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: [] }));
      unsubscribe();

      expect(getWorkspace(store).tabs).toHaveLength(3);
      expect(getWorkspace(store).serverSessionId).toBe('new');
      expect(events).toHaveLength(0);
    });
  });

  describe('setActivePanel', () => {
    it('sets the active panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(setActivePanel({ panelId: 'panel-2' }));

      expect(getWorkspace(store).activePanelId).toBe('panel-2');
    });
  });

  describe('activateTab', () => {
    it('sets the active tab for the panel', () => {
      const store = createTestStore(createTwoPanelState());

      store.dispatch(activateTab({ tabId: 'tab-2', panelId: 'panel-1' }));

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
        id: `tab-${i}`,
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
        activeTabIds: { [panelId]: tabs[0]?.id ?? '' },
        activePanelId: panelId,
        favoriteLayouts: [],
        searchBarsHidden: false,
      };
    }

    describe('addTab with maxTabs', () => {
      it('blocks addTab when at maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 3);

        await store.dispatch(addTab({ panelId: 'test-panel', name: 'New Tab' }));

        expect(getWorkspace(store).tabs.length).toBe(3);
      });

      it('allows addTab when below maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 5);

        await store.dispatch(addTab({ panelId: 'test-panel', name: 'New Tab' }));

        expect(getWorkspace(store).tabs.length).toBe(4);
      });

      it('allows unlimited tabs when maxTabs is 0', async () => {
        const store = createTestStore(createStateWithTabs(100), 0);

        await store.dispatch(addTab({ panelId: 'test-panel', name: 'New Tab' }));

        expect(getWorkspace(store).tabs.length).toBe(101);
      });

      it('allows unlimited tabs when maxTabs is negative', async () => {
        const store = createTestStore(createStateWithTabs(50), -1);

        await store.dispatch(addTab({ panelId: 'test-panel', name: 'New Tab' }));

        expect(getWorkspace(store).tabs.length).toBe(51);
      });
    });

    describe('duplicateTab with maxTabs', () => {
      it('blocks duplicateTab when at maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 3);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' }));

        expect(getWorkspace(store).tabs.length).toBe(3);
      });

      it('allows duplicateTab when below maxTabs limit', async () => {
        const store = createTestStore(createStateWithTabs(3), 5);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' }));

        expect(getWorkspace(store).tabs.length).toBe(4);
        expect(getWorkspace(store).tabs[3].name).toBe('Tab 0 (copy)');
      });

      it('allows unlimited tabs when maxTabs is 0 (via duplicate)', async () => {
        const store = createTestStore(createStateWithTabs(100), 0);

        await store.dispatch(duplicateTab({ tabId: 'tab-0' }));

        expect(getWorkspace(store).tabs.length).toBe(101);
      });
    });

    describe('addTab with allowMultiple constraint', () => {
      it('blocks addTab when allowMultiple=false and layout already open', async () => {
        const state = createTestState({
          tabs: [
            {
              id: 'tab-1',
              name: 'Analytics',
              panelId: 'test-panel-1',
              layoutId: 'analytics',
              createdAt: Date.now(),
              mountKey: 'm1',
            },
          ],
        });
        const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
        const store = createTestStore(state, 16, layouts);

        await store.dispatch(
          addTab({ panelId: 'test-panel-1', layoutId: 'analytics', name: 'Analytics' })
        );

        // Tab should not be added
        expect(getWorkspace(store).tabs.length).toBe(1);
      });

      it('allows addTab when allowMultiple=false and layout not yet open', async () => {
        const state = createTestState();
        const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
        const store = createTestStore(state, 16, layouts);

        await store.dispatch(
          addTab({ panelId: 'test-panel-1', layoutId: 'analytics', name: 'Analytics' })
        );

        expect(getWorkspace(store).tabs.length).toBe(2);
        expect(getWorkspace(store).tabs[1].layoutId).toBe('analytics');
      });

      it('allows addTab when allowMultiple=true even if layout already open', async () => {
        const state = createTestState({
          tabs: [
            {
              id: 'tab-1',
              name: 'Chart',
              panelId: 'test-panel-1',
              layoutId: 'chart',
              createdAt: Date.now(),
              mountKey: 'm1',
            },
          ],
        });
        const layouts = { chart: { name: 'Chart', allowMultiple: true } };
        const store = createTestStore(state, 16, layouts);

        await store.dispatch(
          addTab({ panelId: 'test-panel-1', layoutId: 'chart', name: 'Chart 2' })
        );

        expect(getWorkspace(store).tabs.length).toBe(2);
      });

      it('allows addTab without layoutId (blank tab) regardless of constraints', async () => {
        const store = createTestStore(undefined, 16, {});

        await store.dispatch(addTab({ panelId: getWorkspace(store).activePanelId }));

        expect(getWorkspace(store).tabs.length).toBe(2);
      });
    });

    describe('switchToOpenTab', () => {
      function twoPanelStateWithOpenLayout(): WorkspaceState {
        const state = createTwoPanelState();
        state.tabs[0].layoutId = 'analytics';
        return state;
      }

      it('activates the open tab of a single-instance layout and tells the user', () => {
        const state = twoPanelStateWithOpenLayout();
        state.activePanelId = 'panel-2';
        const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
        const store = createTestStore(state, 16, layouts);
        const events: ToastEvent[] = [];
        const unsubscribe = subscribeToToasts((event) => events.push(event));

        const switched = store.dispatch(switchToOpenTab('analytics'));
        unsubscribe();

        expect(switched).toBe(true);
        expect(getWorkspace(store).activePanelId).toBe('panel-1');
        expect(getWorkspace(store).activeTabIds['panel-1']).toBe('tab-1');
        expect(events).toEqual([
          expect.objectContaining({
            type: 'info',
            message: 'Layout "Analytics" is already open. Switching to it.',
          }),
        ]);
      });

      it('does nothing for a layout that allows several tabs', () => {
        const layouts = { analytics: { name: 'Analytics', allowMultiple: true } };
        const store = createTestStore(twoPanelStateWithOpenLayout(), 16, layouts);
        const before = getWorkspace(store);

        expect(store.dispatch(switchToOpenTab('analytics'))).toBe(false);
        expect(getWorkspace(store)).toBe(before);
      });

      it('does nothing when no tab shows the layout or the layout is unknown', () => {
        const layouts = { other: { name: 'Other', allowMultiple: false } };
        const store = createTestStore(twoPanelStateWithOpenLayout(), 16, layouts);

        expect(store.dispatch(switchToOpenTab('other'))).toBe(false);
        expect(store.dispatch(switchToOpenTab('unknown'))).toBe(false);
      });
    });

    describe('a layout without allowMultiple', () => {
      // The registry always sends allowMultiple. If it is missing, every layer reads it as false.
      const layouts = { analytics: { name: 'Analytics' } };
      const openAnalytics = () =>
        createTestState({
          tabs: [
            {
              id: 'tab-1',
              name: 'Analytics',
              panelId: 'test-panel-1',
              layoutId: 'analytics',
              createdAt: Date.now(),
              mountKey: 'm1',
            },
          ],
        });

      it('blocks addTab and duplicateTab like allowMultiple=false', async () => {
        const store = createTestStore(openAnalytics(), 16, layouts);

        await store.dispatch(addTab({ panelId: 'test-panel-1', layoutId: 'analytics' }));
        await store.dispatch(duplicateTab({ tabId: 'tab-1' }));

        expect(getWorkspace(store).tabs.length).toBe(1);
      });

      it('lets switchToOpenTab switch to the open tab', () => {
        const store = createTestStore(openAnalytics(), 16, layouts);

        expect(store.dispatch(switchToOpenTab('analytics'))).toBe(true);
      });
    });

    describe('duplicateTab with allowMultiple constraint', () => {
      it('blocks duplicateTab when allowMultiple=false', async () => {
        const state = createTestState({
          tabs: [
            {
              id: 'tab-1',
              name: 'Analytics',
              panelId: 'test-panel-1',
              layoutId: 'analytics',
              createdAt: Date.now(),
              mountKey: 'm1',
            },
          ],
        });
        const layouts = { analytics: { name: 'Analytics', allowMultiple: false } };
        const store = createTestStore(state, 16, layouts);

        await store.dispatch(duplicateTab({ tabId: 'tab-1' }));

        expect(getWorkspace(store).tabs.length).toBe(1);
      });

      it('allows duplicateTab when allowMultiple=true', async () => {
        const state = createTestState({
          tabs: [
            {
              id: 'tab-1',
              name: 'Chart',
              panelId: 'test-panel-1',
              layoutId: 'chart',
              createdAt: Date.now(),
              mountKey: 'm1',
            },
          ],
        });
        const layouts = { chart: { name: 'Chart', allowMultiple: true } };
        const store = createTestStore(state, 16, layouts);

        await store.dispatch(duplicateTab({ tabId: 'tab-1' }));

        expect(getWorkspace(store).tabs.length).toBe(2);
      });
    });

    describe('moveTab does not check maxTabs', () => {
      it('allows moveTab regardless of tab count', () => {
        const store = createTestStore(createTwoPanelState(), 2);

        store.dispatch(moveTab({ tabId: 'tab-1', targetPanelId: 'panel-2' }));

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
          tabId: 'test-tab-1',
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
          tabId: 'test-tab-1',
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
          tabId: 'test-tab-1',
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
          tabId: 'test-tab-1',
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
        const store = createTestStore(createTestState());
        const tabCountBefore = getWorkspace(store).tabs.length;

        const result = await store.dispatch(duplicateTab({ tabId: 'nonexistent' }));

        expect(result.type).toBe('workspace/duplicateTab/rejected');
        expect(getWorkspace(store).tabs.length).toBe(tabCountBefore);
      });
    });

    describe('moveTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(createTwoPanelState());
        const stateBefore = store.getState().workspace;

        store.dispatch(moveTab({ tabId: 'nonexistent', targetPanelId: 'panel-2' }));

        expect(store.getState().workspace).toEqual(stateBefore);
      });

      it('initializes panelTabs for new target panel', () => {
        const state = createTestState();
        // Remove panelTabs entry for a secondary panel ID
        const panel2Id = 'panel-2' as PanelId;
        state.panel.children = [
          {
            id: 'test-panel-1',
            order: 0 as const,
            direction: 'horizontal',
            children: [],
            size: '50%',
          },
          { id: panel2Id, order: 1 as const, direction: 'horizontal', children: [], size: '50%' },
        ];
        const store = createTestStore(state);

        store.dispatch(moveTab({ tabId: 'test-tab-1', targetPanelId: panel2Id }));

        expect(getWorkspace(store).panelTabs[panel2Id]).toContain('test-tab-1');
      });
    });

    describe('renameTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());
        const originalName = getTab(store, 'test-tab-1')?.name;

        store.dispatch(renameTab({ tabId: 'nonexistent', name: 'New Name' }));

        expect(getTab(store, 'test-tab-1')?.name).toBe(originalName);
      });

      it('handles empty string name', () => {
        const store = createTestStore(createTestState());

        store.dispatch(renameTab({ tabId: 'test-tab-1', name: '' }));

        expect(getTab(store, 'test-tab-1')?.name).toBe('');
      });
    });

    describe('activateTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());
        const originalActiveTabId = getWorkspace(store).activeTabIds['test-panel-1'];

        store.dispatch(activateTab({ tabId: 'nonexistent', panelId: 'test-panel-1' }));

        // Should not change activeTabId when tab doesn't exist
        expect(getWorkspace(store).activeTabIds['test-panel-1']).toBe(originalActiveTabId);
      });

      it('is a no-op when tab belongs to different panel', () => {
        const state = createTwoPanelState();
        const store = createTestStore(state);

        // Try to select tab-1 (belongs to panel-1) in panel-2
        store.dispatch(activateTab({ tabId: 'tab-1', panelId: 'panel-2' }));

        // Should not change panel-2's activeTabId
        expect(getWorkspace(store).activeTabIds['panel-2']).toBe('tab-3');
      });
    });

    describe('setActivePanel edge cases', () => {
      it('is a no-op when panel does not exist', () => {
        const store = createTestStore(createTestState());
        const originalPanelId = getWorkspace(store).activePanelId;

        store.dispatch(setActivePanel({ panelId: 'nonexistent' }));

        // Should not change activePanelId when panel doesn't exist
        expect(getWorkspace(store).activePanelId).toBe(originalPanelId);
      });

      it('is a no-op for container panels (non-leaf)', () => {
        const state = createTwoPanelState();
        const store = createTestStore(state);
        const originalPanelId = getWorkspace(store).activePanelId;

        // Try to set active panel to the container panel
        store.dispatch(setActivePanel({ panelId: 'container-1' }));

        // Should not change since container-1 is not a leaf
        expect(getWorkspace(store).activePanelId).toBe(originalPanelId);
      });
    });

    describe('lock/unlock edge cases', () => {
      it('lockTab is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());

        store.dispatch(lockTab({ tabId: 'nonexistent' }));

        // No error thrown, existing tabs unaffected
        expect(getTab(store, 'test-tab-1')?.locked).toBeFalsy();
      });

      it('unlockTab is a no-op when tab does not exist', () => {
        const state = createTestState();
        state.tabs[0].locked = true;
        const store = createTestStore(state);

        store.dispatch(unlockTab({ tabId: 'nonexistent' }));

        // Existing tab still locked
        expect(getTab(store, 'test-tab-1')?.locked).toBe(true);
      });
    });

    describe('setTabIcon/setTabStyle edge cases', () => {
      it('setTabIcon is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());

        store.dispatch(setTabIcon({ tabId: 'nonexistent', icon: 'Star' }));

        expect(getTab(store, 'test-tab-1')?.icon).toBeUndefined();
      });

      it('setTabStyle is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());

        store.dispatch(setTabStyle({ tabId: 'nonexistent', style: 'blue' }));

        expect(getTab(store, 'test-tab-1')?.style).toBeUndefined();
      });

      it('setTabIcon clears icon when undefined', () => {
        const state = createTestState();
        state.tabs[0].icon = 'Star';
        const store = createTestStore(state);

        store.dispatch(setTabIcon({ tabId: 'test-tab-1', icon: undefined }));

        expect(getTab(store, 'test-tab-1')?.icon).toBeUndefined();
      });
    });

    describe('refreshTab edge cases', () => {
      it('is a no-op when tab does not exist', () => {
        const store = createTestStore(createTestState());
        const originalMountKey = getTab(store, 'test-tab-1')?.mountKey;

        store.dispatch(refreshTab({ tabId: 'nonexistent' }));

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
      const panelIds = Array.from({ length: panelCount }, (_, i) => `panel-${i}`);
      const tabs: Tab[] = panelIds.map((panelId, i) => ({
        id: `tab-${i}`,
        name: `Tab ${i}`,
        panelId,
        createdAt: Date.now(),
        mountKey: `m${i}`,
      }));

      // Add an extra tab to first panel so it can be split
      tabs.push({
        id: 'extra-tab',
        name: 'Extra Tab',
        panelId: panelIds[0],
        createdAt: Date.now(),
        mountKey: 'extra',
      });

      const containerId = 'container' as PanelId;
      // Note: order is typed as 0 | 1, so we use modulo. For testing leaf panel count,
      // the exact order values don't affect the test logic since getLeafPanelIds
      // walks all children regardless of order.
      const childPanels: PanelNode[] = panelIds.map((id, i) => ({
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

    it('rejects a split at the panel limit and tells the user', async () => {
      const store = createTestStore(createStateWithManyPanels(MAX_LEAF_PANELS));
      const before = getWorkspace(store);
      const events: ToastEvent[] = [];
      const unsubscribe = subscribeToToasts((event) => events.push(event));

      const result = await store.dispatch(
        splitPanel({ panelId: 'panel-0', direction: 'horizontal', tabId: 'extra-tab' })
      );
      unsubscribe();

      expect(splitPanel.rejected.match(result)).toBe(true);
      expect(getWorkspace(store)).toBe(before);
      expect(events).toEqual([
        expect.objectContaining({
          type: 'warning',
          message: `Cannot split: maximum of ${MAX_LEAF_PANELS} panels reached`,
        }),
      ]);
    });

    it('reads the limit from the thunk extra argument (maxPanels prop)', async () => {
      const store = createTestStore(createStateWithManyPanels(2), 16, {}, 2);
      const before = getWorkspace(store);

      await store.dispatch(
        splitPanel({ panelId: 'panel-0', direction: 'horizontal', tabId: 'extra-tab' })
      );

      expect(getWorkspace(store)).toBe(before);
    });

    it('treats maxPanels below 1 as unlimited', async () => {
      const store = createTestStore(createStateWithManyPanels(MAX_LEAF_PANELS), 16, {}, 0);

      await store.dispatch(
        splitPanel({ panelId: 'panel-0', direction: 'horizontal', tabId: 'extra-tab' })
      );

      expect(Object.keys(getWorkspace(store).panelTabs)).toHaveLength(MAX_LEAF_PANELS + 1);
    });

    it('allows split when below MAX_LEAF_PANELS limit', async () => {
      const store = createTestStore(createStateWithManyPanels(MAX_LEAF_PANELS - 1));
      const leafCountBefore = countLeafPanels(getWorkspace(store).panel);

      await store.dispatch(
        splitPanel({ panelId: 'panel-0', direction: 'horizontal', tabId: 'extra-tab' })
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
      await store.dispatch(addTab({ panelId: 'test-panel-1', name: 'Tab 2' }));
      await store.dispatch(addTab({ panelId: 'test-panel-1', name: 'Tab 3' }));

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
        expect(panelTabs[panelId]).toContain(activeTabId);
      }

      // Remove active tab
      store.dispatch(removeTab({ tabId: 'tab-1' }));

      // Verify activeTabIds are still valid
      const stateAfter = getWorkspace(store);
      for (const [panelId, activeTabId] of Object.entries(stateAfter.activeTabIds)) {
        expect(stateAfter.panelTabs[panelId]).toContain(activeTabId);
      }
    });

    it('maintains consistent tab.panelId with panelTabs mapping', async () => {
      const store = createTestStore(createTwoPanelState());

      // Move a tab
      store.dispatch(moveTab({ tabId: 'tab-1', targetPanelId: 'panel-2' }));

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

      await store.dispatch(addTab({ panelId: 'test-panel-1' }));
      await store.dispatch(addTab({ panelId: 'test-panel-1' }));
      await store.dispatch(duplicateTab({ tabId: 'test-tab-1' }));

      const { tabs } = getWorkspace(store);
      const ids = tabs.map((t) => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all tabs have unique mountKeys', async () => {
      const store = createTestStore(createTestState());

      await store.dispatch(addTab({ panelId: 'test-panel-1' }));
      await store.dispatch(addTab({ panelId: 'test-panel-1' }));

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

      const result = await store.dispatch(addTab({ panelId: 'test-panel-1' }));

      expect(result.type).toBe('workspace/addTab/rejected');
      expect(getWorkspace(store).tabs).toEqual(stateBefore.tabs);
    });

    it('duplicateTab.rejected does not modify state', async () => {
      const store = createTestStore(createTestState(), 1);
      const stateBefore = getWorkspace(store);

      const result = await store.dispatch(duplicateTab({ tabId: 'test-tab-1' }));

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
      await store.dispatch(addTab({ panelId: 'test-panel-1', name: 'Tab 2' }));
      const tab2Id = getWorkspace(store).tabs[1].id;

      // Split panel
      await store.dispatch(
        splitPanel({
          panelId: 'test-panel-1',
          direction: 'horizontal',
          tabId: tab2Id,
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
      await store.dispatch(addTab({ panelId: 'test-panel-1', name: 'Chart', layoutId: 'chart' }));
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
      const store = createTestStore(createTwoPanelState());

      // Lock tab
      store.dispatch(lockTab({ tabId: 'tab-1' }));
      expect(getTab(store, 'tab-1')?.locked).toBe(true);

      // Try to remove (should fail)
      store.dispatch(removeTab({ tabId: 'tab-1' }));
      expect(getTab(store, 'tab-1')).toBeDefined();

      // Unlock
      store.dispatch(unlockTab({ tabId: 'tab-1' }));
      expect(getTab(store, 'tab-1')?.locked).toBe(false);

      // Now remove succeeds
      store.dispatch(removeTab({ tabId: 'tab-1' }));
      expect(getTab(store, 'tab-1')).toBeUndefined();
    });
  });
});
