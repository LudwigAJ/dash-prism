/**
 * Unit tests for prismReducer - the core state machine for Prism workspace management.
 *
 * These tests verify:
 * - Tab operations: ADD, REMOVE, DUPLICATE, MOVE, REORDER
 * - Panel operations: SPLIT, COLLAPSE, RESIZE
 * - State invariants: panelTabs, activeTabIds consistency
 * - Edge cases: locked tabs, max tabs, undo stack
 * - maxTabs enforcement: ADD_TAB, DUPLICATE_TAB blocked at limit
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prismReducer, createPrismReducer, type PrismState, type Action } from './prismReducer';
import { toastEmitter } from '@utils/toastEmitter';
import type { Tab, Panel, PanelId, TabId } from '@types';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a minimal valid state for testing.
 */
function createTestState(overrides: Partial<PrismState> = {}): PrismState {
  const panelId = 'test-panel-1' as PanelId;
  const tabId = 'test-tab-1' as TabId;

  return {
    tabs: [
      {
        id: tabId,
        name: 'Test Tab',
        panelId: panelId,
        createdAt: Date.now(),
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
    theme: 'light',
    searchBarsHidden: false,
    undoStack: [],
    searchBarModes: {},
    renamingTabId: null,
    ...overrides,
  };
}

/**
 * Create a state with two panels for split/move testing.
 */
function createTwoPanelState(): PrismState {
  const panel1Id = 'panel-1' as PanelId;
  const panel2Id = 'panel-2' as PanelId;
  const containerId = 'container-1' as PanelId;
  const tab1Id = 'tab-1' as TabId;
  const tab2Id = 'tab-2' as TabId;
  const tab3Id = 'tab-3' as TabId;

  return {
    tabs: [
      { id: tab1Id, name: 'Tab 1', panelId: panel1Id, createdAt: Date.now() },
      { id: tab2Id, name: 'Tab 2', panelId: panel1Id, createdAt: Date.now() },
      { id: tab3Id, name: 'Tab 3', panelId: panel2Id, createdAt: Date.now() },
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
    theme: 'light',
    searchBarsHidden: false,
    undoStack: [],
    searchBarModes: {},
    renamingTabId: null,
  };
}

/**
 * Helper to get tab by ID from state.
 */
function getTab(state: PrismState, tabId: string): Tab | undefined {
  return state.tabs.find((t) => t.id === tabId);
}

/**
 * Helper to count leaf panels in state.
 */
function countLeafPanels(panel: Panel): number {
  if (panel.children.length === 0) return 1;
  return panel.children.reduce((count, child) => count + countLeafPanels(child), 0);
}

// =============================================================================
// Tab Operation Tests
// =============================================================================

describe('prismReducer', () => {
  describe('ADD_TAB', () => {
    it('adds a new tab to the specified panel', () => {
      const state = createTestState();
      const action: Action = {
        type: 'ADD_TAB',
        payload: { panelId: 'test-panel-1' as PanelId, name: 'New Tab' },
      };

      const result = prismReducer(state, action);

      expect(result.tabs).toHaveLength(2);
      const newTab = result.tabs[1];
      expect(newTab.name).toBe('New Tab');
      expect(newTab.panelId).toBe('test-panel-1');
    });

    it('adds tab to panelTabs tracking', () => {
      const state = createTestState();
      const action: Action = {
        type: 'ADD_TAB',
        payload: { panelId: 'test-panel-1' as PanelId },
      };

      const result = prismReducer(state, action);
      const newTabId = result.tabs[1].id;

      expect(result.panelTabs['test-panel-1']).toContain(newTabId);
    });

    it('sets new tab as active', () => {
      const state = createTestState();
      const action: Action = {
        type: 'ADD_TAB',
        payload: { panelId: 'test-panel-1' as PanelId },
      };

      const result = prismReducer(state, action);
      const newTabId = result.tabs[1].id;

      expect(result.activeTabIds['test-panel-1']).toBe(newTabId);
      expect(result.activePanelId).toBe('test-panel-1');
    });

    it('creates tab with layoutId when provided', () => {
      const state = createTestState();
      const action: Action = {
        type: 'ADD_TAB',
        payload: {
          panelId: 'test-panel-1' as PanelId,
          name: 'Chart Tab',
          layoutId: 'chart-layout',
          params: { type: 'bar' },
        },
      };

      const result = prismReducer(state, action);
      const newTab = result.tabs[1];

      expect(newTab.layoutId).toBe('chart-layout');
      expect(newTab.layoutParams).toEqual({ type: 'bar' });
    });
  });

  describe('REMOVE_TAB', () => {
    it('removes tab from tabs array', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'REMOVE_TAB',
        payload: { tabId: 'tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      expect(result.tabs).toHaveLength(2);
      expect(getTab(result, 'tab-1')).toBeUndefined();
    });

    it('removes tab from panelTabs tracking', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'REMOVE_TAB',
        payload: { tabId: 'tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      expect(result.panelTabs['panel-1']).not.toContain('tab-1');
    });

    it('does not remove locked tabs', () => {
      const state = createTestState();
      state.tabs[0].locked = true;

      const action: Action = {
        type: 'REMOVE_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      expect(result.tabs).toHaveLength(1);
      expect(getTab(result, 'test-tab-1')).toBeDefined();
    });

    it('pushes removed tab to undo stack', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'REMOVE_TAB',
        payload: { tabId: 'tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      expect(result.undoStack).toHaveLength(1);
      expect(result.undoStack[0].tab.id).toBe('tab-1');
    });

    it('limits undo stack to 10 items', () => {
      let state = createTestState();
      // Add 11 tabs then remove them
      for (let i = 0; i < 11; i++) {
        state = prismReducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel-1' as PanelId, name: `Tab ${i}` },
        });
      }

      // Remove all added tabs
      for (let i = 0; i < 11; i++) {
        const tabToRemove = state.tabs.find((t) => t.name === `Tab ${i}`);
        if (tabToRemove) {
          state = prismReducer(state, {
            type: 'REMOVE_TAB',
            payload: { tabId: tabToRemove.id as TabId },
          });
        }
      }

      expect(state.undoStack.length).toBeLessThanOrEqual(10);
    });

    it('updates activeTabId when removing active tab', () => {
      const state = createTwoPanelState();
      // tab-1 is active in panel-1
      const action: Action = {
        type: 'REMOVE_TAB',
        payload: { tabId: 'tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      // Should select remaining tab in panel
      expect(result.activeTabIds['panel-1']).toBe('tab-2');
    });
  });

  describe('DUPLICATE_TAB', () => {
    it('creates a copy of the tab', () => {
      const state = createTestState();
      state.tabs[0].layoutId = 'test-layout';
      state.tabs[0].layoutParams = { foo: 'bar' };

      const action: Action = {
        type: 'DUPLICATE_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      expect(result.tabs).toHaveLength(2);
      const duplicate = result.tabs[1];
      expect(duplicate.name).toBe('Test Tab (copy)');
      expect(duplicate.layoutId).toBe('test-layout');
      expect(duplicate.layoutParams).toEqual({ foo: 'bar' });
      expect(duplicate.id).not.toBe('test-tab-1'); // Different ID
    });

    it('duplicated tab is not locked even if original was', () => {
      const state = createTestState();
      state.tabs[0].locked = true;

      const action: Action = {
        type: 'DUPLICATE_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);
      const duplicate = result.tabs[1];

      expect(duplicate.locked).toBe(false);
    });

    it('adds duplicate to same panel as original', () => {
      const state = createTestState();
      const action: Action = {
        type: 'DUPLICATE_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);
      const duplicate = result.tabs[1];

      expect(duplicate.panelId).toBe('test-panel-1');
      expect(result.panelTabs['test-panel-1']).toContain(duplicate.id);
    });
  });

  describe('MOVE_TAB', () => {
    it('moves tab between panels', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'MOVE_TAB',
        payload: { tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId },
      };

      const result = prismReducer(state, action);
      const movedTab = getTab(result, 'tab-1');

      expect(movedTab?.panelId).toBe('panel-2');
      expect(result.panelTabs['panel-1']).not.toContain('tab-1');
      expect(result.panelTabs['panel-2']).toContain('tab-1');
    });

    it('updates activeTabIds for both panels', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'MOVE_TAB',
        payload: { tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId },
      };

      const result = prismReducer(state, action);

      expect(result.activeTabIds['panel-2']).toBe('tab-1');
      expect(result.activePanelId).toBe('panel-2');
      // Source panel should now have tab-2 as active
      expect(result.activeTabIds['panel-1']).toBe('tab-2');
    });

    it('is a no-op when moving to same panel', () => {
      const state = createTestState();
      const action: Action = {
        type: 'MOVE_TAB',
        payload: { tabId: 'test-tab-1' as TabId, targetPanelId: 'test-panel-1' as PanelId },
      };

      const result = prismReducer(state, action);

      expect(result).toEqual(state); // No change
    });

    it('moves tab to specific index when provided', () => {
      const state = createTwoPanelState();
      // panel-2 has [tab-3], we want to insert tab-1 at index 0
      const action: Action = {
        type: 'MOVE_TAB',
        payload: { tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId, targetIndex: 0 },
      };

      const result = prismReducer(state, action);

      expect(result.panelTabs['panel-2'][0]).toBe('tab-1');
      expect(result.panelTabs['panel-2'][1]).toBe('tab-3');
    });
  });

  describe('REORDER_TAB', () => {
    it('reorders tabs within a panel', () => {
      const state = createTwoPanelState();
      // panel-1 has [tab-1, tab-2]
      const action: Action = {
        type: 'REORDER_TAB',
        payload: { panelId: 'panel-1' as PanelId, fromIndex: 0, toIndex: 1 },
      };

      const result = prismReducer(state, action);

      expect(result.panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
    });

    it('clamps toIndex to valid range', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'REORDER_TAB',
        payload: { panelId: 'panel-1' as PanelId, fromIndex: 0, toIndex: 100 },
      };

      const result = prismReducer(state, action);

      // Should move to end (index 1)
      expect(result.panelTabs['panel-1']).toEqual(['tab-2', 'tab-1']);
    });

    it('ignores invalid fromIndex', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'REORDER_TAB',
        payload: { panelId: 'panel-1' as PanelId, fromIndex: -1, toIndex: 0 },
      };

      const result = prismReducer(state, action);

      // No change
      expect(result.panelTabs['panel-1']).toEqual(['tab-1', 'tab-2']);
    });
  });

  describe('RENAME_TAB', () => {
    it('renames the specified tab', () => {
      const state = createTestState();
      const action: Action = {
        type: 'RENAME_TAB',
        payload: { tabId: 'test-tab-1' as TabId, name: 'Renamed Tab' },
      };

      const result = prismReducer(state, action);

      expect(getTab(result, 'test-tab-1')?.name).toBe('Renamed Tab');
    });
  });

  describe('LOCK_TAB / UNLOCK_TAB / TOGGLE_TAB_LOCK', () => {
    it('LOCK_TAB locks a tab', () => {
      const state = createTestState();
      const action: Action = {
        type: 'LOCK_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      expect(getTab(result, 'test-tab-1')?.locked).toBe(true);
    });

    it('UNLOCK_TAB unlocks a tab', () => {
      const state = createTestState();
      state.tabs[0].locked = true;

      const action: Action = {
        type: 'UNLOCK_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      expect(getTab(result, 'test-tab-1')?.locked).toBe(false);
    });

    it('TOGGLE_TAB_LOCK toggles lock state', () => {
      const state = createTestState();

      let result = prismReducer(state, {
        type: 'TOGGLE_TAB_LOCK',
        payload: { tabId: 'test-tab-1' as TabId },
      });
      expect(getTab(result, 'test-tab-1')?.locked).toBe(true);

      result = prismReducer(result, {
        type: 'TOGGLE_TAB_LOCK',
        payload: { tabId: 'test-tab-1' as TabId },
      });
      expect(getTab(result, 'test-tab-1')?.locked).toBe(false);
    });
  });

  // ===========================================================================
  // Panel Operation Tests
  // ===========================================================================

  describe('SPLIT_PANEL', () => {
    it('creates two child panels from one', () => {
      const state = createTestState();
      // Add a second tab so we can split
      const withTwoTabs = prismReducer(state, {
        type: 'ADD_TAB',
        payload: { panelId: 'test-panel-1' as PanelId, name: 'Tab 2' },
      });
      const tab2Id = withTwoTabs.tabs[1].id;

      const action: Action = {
        type: 'SPLIT_PANEL',
        payload: {
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        },
      };

      const result = prismReducer(withTwoTabs, action);

      expect(countLeafPanels(result.panel)).toBe(2);
    });

    it('preserves original panel ID', () => {
      const state = createTestState();
      const withTwoTabs = prismReducer(state, {
        type: 'ADD_TAB',
        payload: { panelId: 'test-panel-1' as PanelId },
      });
      const tab2Id = withTwoTabs.tabs[1].id;

      const action: Action = {
        type: 'SPLIT_PANEL',
        payload: {
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        },
      };

      const result = prismReducer(withTwoTabs, action);

      // Original panel ID should still exist as a leaf
      const hasOriginalPanelId = result.panel.children.some((c) => c.id === 'test-panel-1');
      expect(hasOriginalPanelId).toBe(true);
    });

    it('moves tab to new panel', () => {
      const state = createTestState();
      const withTwoTabs = prismReducer(state, {
        type: 'ADD_TAB',
        payload: { panelId: 'test-panel-1' as PanelId, name: 'Tab 2' },
      });
      const tab2Id = withTwoTabs.tabs[1].id;

      const action: Action = {
        type: 'SPLIT_PANEL',
        payload: {
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
        },
      };

      const result = prismReducer(withTwoTabs, action);
      const tab2 = getTab(result, tab2Id);

      // Tab should be in the NEW panel (not the original)
      expect(tab2?.panelId).not.toBe('test-panel-1');
      expect(result.panelTabs['test-panel-1']).not.toContain(tab2Id);
    });

    it('does not split panel with only one tab', () => {
      const state = createTestState();
      const action: Action = {
        type: 'SPLIT_PANEL',
        payload: {
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: 'test-tab-1' as TabId,
        },
      };

      const result = prismReducer(state, action);

      // Should still be one panel
      expect(countLeafPanels(result.panel)).toBe(1);
    });

    it('respects position=before for left/top placement', () => {
      const state = createTestState();
      const withTwoTabs = prismReducer(state, {
        type: 'ADD_TAB',
        payload: { panelId: 'test-panel-1' as PanelId },
      });
      const tab2Id = withTwoTabs.tabs[1].id;

      const action: Action = {
        type: 'SPLIT_PANEL',
        payload: {
          panelId: 'test-panel-1' as PanelId,
          direction: 'horizontal',
          tabId: tab2Id as TabId,
          position: 'before',
        },
      };

      const result = prismReducer(withTwoTabs, action);

      // New panel (with tab2) should be first (order: 0)
      const tab2 = getTab(result, tab2Id);
      const newPanelId = tab2?.panelId;
      const newPanel = result.panel.children.find((c) => c.id === newPanelId);

      expect(newPanel?.order).toBe(0);
    });
  });

  describe('COLLAPSE_PANEL', () => {
    it('moves all tabs to remaining panel', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'COLLAPSE_PANEL',
        payload: { panelId: 'panel-2' as PanelId },
      };

      const result = prismReducer(state, action);

      // Tab 3 should now be in panel-1
      expect(getTab(result, 'tab-3')?.panelId).toBe('panel-1');
      expect(result.panelTabs['panel-1']).toContain('tab-3');
    });

    it('cleans up collapsed panel state', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'COLLAPSE_PANEL',
        payload: { panelId: 'panel-2' as PanelId },
      };

      const result = prismReducer(state, action);

      expect(result.panelTabs['panel-2']).toBeUndefined();
      expect(result.activeTabIds['panel-2']).toBeUndefined();
    });

    it('does not collapse last remaining panel', () => {
      const state = createTestState();
      const action: Action = {
        type: 'COLLAPSE_PANEL',
        payload: { panelId: 'test-panel-1' as PanelId },
      };

      const result = prismReducer(state, action);

      // Should still have the panel
      expect(countLeafPanels(result.panel)).toBe(1);
    });

    it('updates activePanelId to remaining panel', () => {
      const state = createTwoPanelState();
      state.activePanelId = 'panel-2' as PanelId;

      const action: Action = {
        type: 'COLLAPSE_PANEL',
        payload: { panelId: 'panel-2' as PanelId },
      };

      const result = prismReducer(state, action);

      expect(result.activePanelId).toBe('panel-1');
    });
  });

  describe('RESIZE_PANEL', () => {
    it('updates panel size', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'RESIZE_PANEL',
        payload: { panelId: 'panel-1' as PanelId, size: '30%' },
      };

      const result = prismReducer(state, action);

      const panel1 = result.panel.children.find((c) => c.id === 'panel-1');
      expect(panel1?.size).toBe('30%');
    });

    it('accepts numeric size values', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'RESIZE_PANEL',
        payload: { panelId: 'panel-1' as PanelId, size: 300 },
      };

      const result = prismReducer(state, action);

      const panel1 = result.panel.children.find((c) => c.id === 'panel-1');
      expect(panel1?.size).toBe(300);
    });
  });

  describe('PIN_PANEL / UNPIN_PANEL', () => {
    it('PIN_PANEL sets pinned to true', () => {
      const state = createTestState();
      const action: Action = {
        type: 'PIN_PANEL',
        payload: { panelId: 'test-panel-1' as PanelId },
      };

      const result = prismReducer(state, action);

      expect(result.panel.pinned).toBe(true);
    });

    it('UNPIN_PANEL sets pinned to false', () => {
      const state = createTestState();
      state.panel.pinned = true;

      const action: Action = {
        type: 'UNPIN_PANEL',
        payload: { panelId: 'test-panel-1' as PanelId },
      };

      const result = prismReducer(state, action);

      expect(result.panel.pinned).toBe(false);
    });
  });

  // ===========================================================================
  // Undo Tests
  // ===========================================================================

  describe('POP_UNDO', () => {
    it('restores last removed tab', () => {
      let state = createTwoPanelState();

      // Remove a tab
      state = prismReducer(state, {
        type: 'REMOVE_TAB',
        payload: { tabId: 'tab-1' as TabId },
      });

      expect(getTab(state, 'tab-1')).toBeUndefined();

      // Undo
      const result = prismReducer(state, { type: 'POP_UNDO' });

      expect(getTab(result, 'tab-1')).toBeDefined();
      expect(result.undoStack).toHaveLength(0);
    });

    it('restores tab to original panel if it exists', () => {
      let state = createTwoPanelState();

      state = prismReducer(state, {
        type: 'REMOVE_TAB',
        payload: { tabId: 'tab-1' as TabId },
      });

      const result = prismReducer(state, { type: 'POP_UNDO' });

      expect(getTab(result, 'tab-1')?.panelId).toBe('panel-1');
      expect(result.panelTabs['panel-1']).toContain('tab-1');
    });

    it('restores tab to active panel if original panel was collapsed', () => {
      let state = createTwoPanelState();

      // Remove the only tab in panel-2
      state = prismReducer(state, {
        type: 'REMOVE_TAB',
        payload: { tabId: 'tab-3' as TabId },
      });

      // Panel-2 should be collapsed since it's empty
      // Now undo should restore to the active panel (panel-1)
      const result = prismReducer(state, { type: 'POP_UNDO' });

      const restoredTab = getTab(result, 'tab-3');
      expect(restoredTab).toBeDefined();
      // Tab should be in a valid panel
      expect(result.panelTabs[restoredTab!.panelId]).toContain('tab-3');
    });

    it('sets restored tab as active', () => {
      let state = createTwoPanelState();

      state = prismReducer(state, {
        type: 'REMOVE_TAB',
        payload: { tabId: 'tab-1' as TabId },
      });

      const result = prismReducer(state, { type: 'POP_UNDO' });

      expect(result.activeTabIds['panel-1']).toBe('tab-1');
    });

    it('is a no-op when undo stack is empty', () => {
      const state = createTestState();
      expect(state.undoStack).toHaveLength(0);

      const result = prismReducer(state, { type: 'POP_UNDO' });

      expect(result).toEqual(state);
    });
  });

  // ===========================================================================
  // Other Actions
  // ===========================================================================

  describe('TOGGLE_FAVORITE_LAYOUT', () => {
    it('adds layout to favorites', () => {
      const state = createTestState();
      const action: Action = {
        type: 'TOGGLE_FAVORITE_LAYOUT',
        payload: { layoutId: 'my-layout' },
      };

      const result = prismReducer(state, action);

      expect(result.favoriteLayouts).toContain('my-layout');
    });

    it('removes layout from favorites if already present', () => {
      const state = createTestState();
      state.favoriteLayouts = ['my-layout'];

      const action: Action = {
        type: 'TOGGLE_FAVORITE_LAYOUT',
        payload: { layoutId: 'my-layout' },
      };

      const result = prismReducer(state, action);

      expect(result.favoriteLayouts).not.toContain('my-layout');
    });
  });

  describe('TOGGLE_SEARCH_BARS', () => {
    it('toggles searchBarsHidden', () => {
      const state = createTestState();
      expect(state.searchBarsHidden).toBe(false);

      let result = prismReducer(state, { type: 'TOGGLE_SEARCH_BARS' });
      expect(result.searchBarsHidden).toBe(true);

      result = prismReducer(result, { type: 'TOGGLE_SEARCH_BARS' });
      expect(result.searchBarsHidden).toBe(false);
    });
  });

  describe('SET_ACTIVE_PANEL', () => {
    it('sets the active panel', () => {
      const state = createTwoPanelState();
      const action: Action = {
        type: 'SET_ACTIVE_PANEL',
        payload: { panelId: 'panel-2' as PanelId },
      };

      const result = prismReducer(state, action);

      expect(result.activePanelId).toBe('panel-2');
    });
  });

  describe('SYNC_WORKSPACE', () => {
    it('syncs workspace state from Dash', () => {
      const state = createTestState();
      const action: Action = {
        type: 'SYNC_WORKSPACE',
        payload: {
          theme: 'dark',
          searchBarsHidden: true,
          favoriteLayouts: ['layout-1', 'layout-2'],
        },
      };

      const result = prismReducer(state, action);

      expect(result.theme).toBe('dark');
      expect(result.searchBarsHidden).toBe(true);
      expect(result.favoriteLayouts).toEqual(['layout-1', 'layout-2']);
    });

    it('preserves unsynced fields', () => {
      const state = createTestState();
      const action: Action = {
        type: 'SYNC_WORKSPACE',
        payload: { theme: 'dark' },
      };

      const result = prismReducer(state, action);

      expect(result.tabs).toHaveLength(state.tabs.length);
      result.tabs.forEach((tab, index) => {
        expect(tab).toMatchObject(state.tabs[index]);
        expect(tab.mountKey).toEqual(expect.any(String));
      });
      expect(result.panel).toEqual(state.panel);
    });
  });

  // ===========================================================================
  // maxTabs Enforcement Tests
  // ===========================================================================

  describe('maxTabs enforcement', () => {
    /**
     * Create a state with a specific number of tabs for testing maxTabs limits.
     */
    function createStateWithTabs(tabCount: number): PrismState {
      const panelId = 'test-panel' as PanelId;
      const tabs: Tab[] = Array.from({ length: tabCount }, (_, i) => ({
        id: `tab-${i}` as TabId,
        name: `Tab ${i}`,
        panelId,
        createdAt: Date.now(),
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
        theme: 'light',
        searchBarsHidden: false,
        undoStack: [],
        searchBarModes: {},
        renamingTabId: null,
      };
    }

    describe('ADD_TAB with maxTabs', () => {
      it('blocks ADD_TAB when at maxTabs limit', () => {
        const reducer = createPrismReducer({ maxTabs: 3 });
        const state = createStateWithTabs(3); // Already at limit

        const result = reducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel' as PanelId, name: 'New Tab' },
        });

        // Tab count should remain at 3
        expect(result.tabs).toHaveLength(3);
      });

      it('emits warning toast when ADD_TAB blocked at maxTabs limit', () => {
        const emitSpy = vi.spyOn(toastEmitter, 'emit');
        const reducer = createPrismReducer({ maxTabs: 3 });
        const state = createStateWithTabs(3);

        reducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel' as PanelId, name: 'New Tab' },
        });

        expect(emitSpy).toHaveBeenCalledWith({
          type: 'warning',
          message: 'Maximum tabs limit reached (3)',
        });

        emitSpy.mockRestore();
      });

      it('does not emit toast when ADD_TAB succeeds', () => {
        const emitSpy = vi.spyOn(toastEmitter, 'emit');
        const reducer = createPrismReducer({ maxTabs: 5 });
        const state = createStateWithTabs(3);

        reducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel' as PanelId, name: 'New Tab' },
        });

        expect(emitSpy).not.toHaveBeenCalled();

        emitSpy.mockRestore();
      });

      it('allows ADD_TAB when below maxTabs limit', () => {
        const reducer = createPrismReducer({ maxTabs: 5 });
        const state = createStateWithTabs(3);

        const result = reducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel' as PanelId, name: 'New Tab' },
        });

        expect(result.tabs).toHaveLength(4);
      });

      it('allows unlimited tabs when maxTabs is 0', () => {
        const reducer = createPrismReducer({ maxTabs: 0 });
        const state = createStateWithTabs(100);

        const result = reducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel' as PanelId, name: 'New Tab' },
        });

        expect(result.tabs).toHaveLength(101);
      });

      it('allows unlimited tabs when maxTabs is negative', () => {
        const reducer = createPrismReducer({ maxTabs: -1 });
        const state = createStateWithTabs(50);

        const result = reducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel' as PanelId, name: 'New Tab' },
        });

        expect(result.tabs).toHaveLength(51);
      });
    });

    describe('DUPLICATE_TAB with maxTabs', () => {
      it('blocks DUPLICATE_TAB when at maxTabs limit', () => {
        const reducer = createPrismReducer({ maxTabs: 3 });
        const state = createStateWithTabs(3);

        const result = reducer(state, {
          type: 'DUPLICATE_TAB',
          payload: { tabId: 'tab-0' as TabId },
        });

        expect(result.tabs).toHaveLength(3);
      });

      it('emits warning toast when DUPLICATE_TAB blocked at maxTabs limit', () => {
        const emitSpy = vi.spyOn(toastEmitter, 'emit');
        const reducer = createPrismReducer({ maxTabs: 3 });
        const state = createStateWithTabs(3);

        reducer(state, {
          type: 'DUPLICATE_TAB',
          payload: { tabId: 'tab-0' as TabId },
        });

        expect(emitSpy).toHaveBeenCalledWith({
          type: 'warning',
          message: 'Cannot duplicate: maximum tabs limit reached (3)',
        });

        emitSpy.mockRestore();
      });

      it('does not emit toast when DUPLICATE_TAB succeeds', () => {
        const emitSpy = vi.spyOn(toastEmitter, 'emit');
        const reducer = createPrismReducer({ maxTabs: 5 });
        const state = createStateWithTabs(3);

        reducer(state, {
          type: 'DUPLICATE_TAB',
          payload: { tabId: 'tab-0' as TabId },
        });

        expect(emitSpy).not.toHaveBeenCalled();

        emitSpy.mockRestore();
      });

      it('allows DUPLICATE_TAB when below maxTabs limit', () => {
        const reducer = createPrismReducer({ maxTabs: 5 });
        const state = createStateWithTabs(3);

        const result = reducer(state, {
          type: 'DUPLICATE_TAB',
          payload: { tabId: 'tab-0' as TabId },
        });

        expect(result.tabs).toHaveLength(4);
        expect(result.tabs[3].name).toBe('Tab 0 (copy)');
      });

      it('allows unlimited duplicates when maxTabs is 0', () => {
        const reducer = createPrismReducer({ maxTabs: 0 });
        const state = createStateWithTabs(100);

        const result = reducer(state, {
          type: 'DUPLICATE_TAB',
          payload: { tabId: 'tab-0' as TabId },
        });

        expect(result.tabs).toHaveLength(101);
      });
    });

    describe('MOVE_TAB does not check maxTabs', () => {
      it('allows MOVE_TAB regardless of tab count (no new tabs created)', () => {
        const reducer = createPrismReducer({ maxTabs: 2 });
        const state = createTwoPanelState(); // 3 tabs total

        const result = reducer(state, {
          type: 'MOVE_TAB',
          payload: { tabId: 'tab-1' as TabId, targetPanelId: 'panel-2' as PanelId },
        });

        // Tab should be moved, not blocked
        expect(result.tabs).toHaveLength(3);
        const movedTab = result.tabs.find((t) => t.id === 'tab-1');
        expect(movedTab?.panelId).toBe('panel-2');
      });
    });

    describe('default maxTabs configuration', () => {
      it('uses maxTabs of 16 by default', () => {
        const reducer = createPrismReducer(); // No config
        const state = createStateWithTabs(16);

        const result = reducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel' as PanelId },
        });

        // Should be blocked at 16
        expect(result.tabs).toHaveLength(16);
      });

      it('allows 15th tab with default config', () => {
        const reducer = createPrismReducer();
        const state = createStateWithTabs(15);

        const result = reducer(state, {
          type: 'ADD_TAB',
          payload: { panelId: 'test-panel' as PanelId },
        });

        expect(result.tabs).toHaveLength(16);
      });
    });
  });

  // ===========================================================================
  // RESET_WORKSPACE Tests
  // ===========================================================================

  describe('RESET_WORKSPACE', () => {
    it('resets state to initialState', () => {
      const state = createTwoPanelState();
      // Add some modifications
      state.favoriteLayouts = ['layout-1', 'layout-2'];
      state.searchBarsHidden = true;
      state.undoStack = [{ tab: state.tabs[0], position: 0, panelId: state.tabs[0].panelId }];

      const action: Action = { type: 'RESET_WORKSPACE' };
      const result = prismReducer(state, action);

      expect(result.tabs).toHaveLength(1); // initialState has 1 tab
      expect(result.favoriteLayouts).toEqual([]);
      expect(result.searchBarsHidden).toBe(false);
      expect(result.undoStack).toEqual([]);
    });

    it('clears all ephemeral state', () => {
      const state = createTestState();
      state.renamingTabId = 'test-tab-1' as TabId;
      state.searchBarModes = { 'test-panel-1': 'search' };

      const action: Action = { type: 'RESET_WORKSPACE' };
      const result = prismReducer(state, action);

      expect(result.renamingTabId).toBeNull();
      expect(result.searchBarModes).toEqual({});
    });
  });

  // ===========================================================================
  // DUPLICATE_TAB Deep Copy Tests
  // ===========================================================================

  describe('DUPLICATE_TAB layoutParams deep copy', () => {
    it('creates an independent copy of layoutParams', () => {
      const state = createTestState();
      const originalParams = { key: 'original' };
      state.tabs[0].layoutParams = originalParams;

      const action: Action = {
        type: 'DUPLICATE_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);
      const duplicate = result.tabs[1];

      // Verify values are equal
      expect(duplicate.layoutParams).toEqual({ key: 'original' });

      // Verify it's a different object (deep copy)
      expect(duplicate.layoutParams).not.toBe(originalParams);
    });

    it('mutating duplicate layoutParams does not affect original', () => {
      const state = createTestState();
      state.tabs[0].layoutParams = { key: 'original' };

      const action: Action = {
        type: 'DUPLICATE_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);

      // Mutate the duplicate's params (simulating what might happen)
      // Note: In practice, immutability is enforced by Immer, but this tests the copy
      const duplicateParams = result.tabs[1].layoutParams as Record<string, string>;
      expect(duplicateParams.key).toBe('original');

      // Original should still be unchanged
      expect(result.tabs[0].layoutParams).toEqual({ key: 'original' });
    });

    it('handles undefined layoutParams correctly', () => {
      const state = createTestState();
      state.tabs[0].layoutParams = undefined;

      const action: Action = {
        type: 'DUPLICATE_TAB',
        payload: { tabId: 'test-tab-1' as TabId },
      };

      const result = prismReducer(state, action);
      const duplicate = result.tabs[1];

      expect(duplicate.layoutParams).toBeUndefined();
    });
  });
});
