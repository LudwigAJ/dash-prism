/**
 * Unit tests for uiSlice - ephemeral UI state management.
 *
 * These tests verify:
 * - Search bar mode management
 * - Tab renaming state
 * - Modal state (info, help, set icon)
 */

import { describe, it, expect } from 'vitest';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import uiReducer, {
  initialUiState,
  setSearchBarMode,
  clearSearchBarMode,
  startRenameTab,
  clearRenameTab,
  openInfoModal,
  closeInfoModal,
  openHelpModal,
  closeHelpModal,
  openSetIconModal,
  closeSetIconModal,
} from './uiSlice';
import workspaceReducer, { removeTab } from './workspaceSlice';
import type { UiState, WorkspaceState } from './types';
import type { PanelId, TabId } from '@types';

// =============================================================================
// Test Utilities
// =============================================================================

function createTestStore(preloadedState?: Partial<UiState>) {
  return configureStore({
    reducer: { ui: uiReducer },
    preloadedState: preloadedState ? { ui: { ...initialUiState, ...preloadedState } } : undefined,
  });
}

type TestStore = ReturnType<typeof createTestStore>;

function getUiState(store: TestStore): UiState {
  return store.getState().ui;
}

// =============================================================================
// Tests
// =============================================================================

describe('uiSlice', () => {
  describe('initial state', () => {
    it('has correct initial values', () => {
      const store = createTestStore();
      const state = getUiState(store);

      expect(state.searchBarModes).toEqual({});
      expect(state.renamingTabId).toBeNull();
      expect(state.infoModalTabId).toBeNull();
      expect(state.helpModalOpen).toBe(false);
      expect(state.setIconModalTabId).toBeNull();
    });
  });

  describe('setSearchBarMode', () => {
    it('sets mode for a panel', () => {
      const store = createTestStore();

      store.dispatch(setSearchBarMode({ panelId: 'panel-1' as PanelId, mode: 'search' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBe('search');
    });

    it('updates existing mode for a panel', () => {
      const store = createTestStore({
        searchBarModes: { 'panel-1': 'display' } as Record<PanelId, 'display'>,
      });

      store.dispatch(setSearchBarMode({ panelId: 'panel-1' as PanelId, mode: 'params' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBe('params');
    });

    it('can set mode for multiple panels', () => {
      const store = createTestStore();

      store.dispatch(setSearchBarMode({ panelId: 'panel-1' as PanelId, mode: 'search' }));
      store.dispatch(setSearchBarMode({ panelId: 'panel-2' as PanelId, mode: 'options' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBe('search');
      expect(getUiState(store).searchBarModes['panel-2']).toBe('options');
    });

    it('accepts all valid mode values', () => {
      const store = createTestStore();
      const modes = ['hidden', 'display', 'search', 'params', 'options'] as const;

      for (const mode of modes) {
        store.dispatch(setSearchBarMode({ panelId: 'panel-1' as PanelId, mode }));
        expect(getUiState(store).searchBarModes['panel-1']).toBe(mode);
      }
    });
  });

  describe('clearSearchBarMode', () => {
    it('removes mode for a panel', () => {
      const store = createTestStore({
        searchBarModes: { 'panel-1': 'search' } as Record<PanelId, 'search'>,
      });

      store.dispatch(clearSearchBarMode({ panelId: 'panel-1' as PanelId }));

      expect(getUiState(store).searchBarModes['panel-1']).toBeUndefined();
    });

    it('preserves other panels when clearing one', () => {
      const store = createTestStore({
        searchBarModes: {
          'panel-1': 'search',
          'panel-2': 'display',
        } as Record<PanelId, 'search' | 'display'>,
      });

      store.dispatch(clearSearchBarMode({ panelId: 'panel-1' as PanelId }));

      expect(getUiState(store).searchBarModes['panel-1']).toBeUndefined();
      expect(getUiState(store).searchBarModes['panel-2']).toBe('display');
    });

    it('is a no-op for non-existent panel', () => {
      const store = createTestStore({
        searchBarModes: { 'panel-1': 'search' } as Record<PanelId, 'search'>,
      });

      store.dispatch(clearSearchBarMode({ panelId: 'panel-nonexistent' as PanelId }));

      expect(getUiState(store).searchBarModes['panel-1']).toBe('search');
    });
  });

  describe('startRenameTab / clearRenameTab', () => {
    it('startRenameTab sets renamingTabId', () => {
      const store = createTestStore();

      store.dispatch(startRenameTab({ tabId: 'tab-1' as TabId }));

      expect(getUiState(store).renamingTabId).toBe('tab-1');
    });

    it('clearRenameTab clears renamingTabId', () => {
      const store = createTestStore({ renamingTabId: 'tab-1' as TabId });

      store.dispatch(clearRenameTab());

      expect(getUiState(store).renamingTabId).toBeNull();
    });

    it('startRenameTab replaces existing renamingTabId', () => {
      const store = createTestStore({ renamingTabId: 'tab-1' as TabId });

      store.dispatch(startRenameTab({ tabId: 'tab-2' as TabId }));

      expect(getUiState(store).renamingTabId).toBe('tab-2');
    });
  });

  describe('openInfoModal / closeInfoModal', () => {
    it('openInfoModal sets infoModalTabId', () => {
      const store = createTestStore();

      store.dispatch(openInfoModal({ tabId: 'tab-1' as TabId }));

      expect(getUiState(store).infoModalTabId).toBe('tab-1');
    });

    it('closeInfoModal clears infoModalTabId', () => {
      const store = createTestStore({ infoModalTabId: 'tab-1' as TabId });

      store.dispatch(closeInfoModal());

      expect(getUiState(store).infoModalTabId).toBeNull();
    });

    it('openInfoModal replaces existing modal', () => {
      const store = createTestStore({ infoModalTabId: 'tab-1' as TabId });

      store.dispatch(openInfoModal({ tabId: 'tab-2' as TabId }));

      expect(getUiState(store).infoModalTabId).toBe('tab-2');
    });
  });

  describe('openHelpModal / closeHelpModal', () => {
    it('openHelpModal sets helpModalOpen to true', () => {
      const store = createTestStore();

      store.dispatch(openHelpModal());

      expect(getUiState(store).helpModalOpen).toBe(true);
    });

    it('closeHelpModal sets helpModalOpen to false', () => {
      const store = createTestStore({ helpModalOpen: true });

      store.dispatch(closeHelpModal());

      expect(getUiState(store).helpModalOpen).toBe(false);
    });
  });

  describe('openSetIconModal / closeSetIconModal', () => {
    it('openSetIconModal sets setIconModalTabId', () => {
      const store = createTestStore();

      store.dispatch(openSetIconModal({ tabId: 'tab-1' as TabId }));

      expect(getUiState(store).setIconModalTabId).toBe('tab-1');
    });

    it('closeSetIconModal clears setIconModalTabId', () => {
      const store = createTestStore({ setIconModalTabId: 'tab-1' as TabId });

      store.dispatch(closeSetIconModal());

      expect(getUiState(store).setIconModalTabId).toBeNull();
    });

    it('openSetIconModal replaces existing modal', () => {
      const store = createTestStore({ setIconModalTabId: 'tab-1' as TabId });

      store.dispatch(openSetIconModal({ tabId: 'tab-2' as TabId }));

      expect(getUiState(store).setIconModalTabId).toBe('tab-2');
    });
  });

  describe('state isolation', () => {
    it('actions do not affect unrelated state', () => {
      const store = createTestStore({
        searchBarModes: { 'panel-1': 'search' } as Record<PanelId, 'search'>,
        renamingTabId: 'tab-1' as TabId,
        infoModalTabId: 'tab-2' as TabId,
        helpModalOpen: true,
        setIconModalTabId: 'tab-3' as TabId,
      });

      // Update one piece of state
      store.dispatch(closeHelpModal());

      // Verify other state is unchanged
      const state = getUiState(store);
      expect(state.searchBarModes['panel-1']).toBe('search');
      expect(state.renamingTabId).toBe('tab-1');
      expect(state.infoModalTabId).toBe('tab-2');
      expect(state.setIconModalTabId).toBe('tab-3');
      expect(state.helpModalOpen).toBe(false); // Only this changed
    });
  });

  // ===========================================================================
  // Cross-slice: removeTab clears stale UI references
  // ===========================================================================

  describe('cross-slice: removeTab cleanup', () => {
    const panelId = 'panel-1' as PanelId;
    const tabId = 'tab-1' as TabId;
    const tab2Id = 'tab-2' as TabId;

    /**
     * Create a combined store with both workspace and UI reducers
     * to test cross-slice extraReducers behavior.
     */
    function createCombinedStore(uiOverrides: Partial<UiState> = {}) {
      const workspaceState: WorkspaceState = {
        tabs: [
          { id: tabId, name: 'Tab 1', panelId, createdAt: Date.now(), mountKey: 'm1' },
          { id: tab2Id, name: 'Tab 2', panelId, createdAt: Date.now(), mountKey: 'm2' },
        ],
        panel: { id: panelId, order: 0, direction: 'horizontal', children: [], size: '100%' },
        panelTabs: { [panelId]: [tabId, tab2Id] },
        activeTabIds: { [panelId]: tabId },
        activePanelId: panelId,
        favoriteLayouts: [],
        searchBarsHidden: false,
      };

      return configureStore({
        reducer: combineReducers({
          workspace: workspaceReducer,
          ui: uiReducer,
        }),
        preloadedState: {
          workspace: workspaceState,
          ui: { ...initialUiState, ...uiOverrides },
        },
      });
    }

    it('clears renamingTabId when that tab is removed', () => {
      const store = createCombinedStore({ renamingTabId: tabId });

      store.dispatch(removeTab({ tabId }));

      expect(store.getState().ui.renamingTabId).toBeNull();
    });

    it('clears infoModalTabId when that tab is removed', () => {
      const store = createCombinedStore({ infoModalTabId: tabId });

      store.dispatch(removeTab({ tabId }));

      expect(store.getState().ui.infoModalTabId).toBeNull();
    });

    it('clears setIconModalTabId when that tab is removed', () => {
      const store = createCombinedStore({ setIconModalTabId: tabId });

      store.dispatch(removeTab({ tabId }));

      expect(store.getState().ui.setIconModalTabId).toBeNull();
    });

    it('clears all stale references at once', () => {
      const store = createCombinedStore({
        renamingTabId: tabId,
        infoModalTabId: tabId,
        setIconModalTabId: tabId,
      });

      store.dispatch(removeTab({ tabId }));

      const ui = store.getState().ui;
      expect(ui.renamingTabId).toBeNull();
      expect(ui.infoModalTabId).toBeNull();
      expect(ui.setIconModalTabId).toBeNull();
    });

    it('does not clear references to a different tab', () => {
      const store = createCombinedStore({
        renamingTabId: tab2Id,
        infoModalTabId: tab2Id,
        setIconModalTabId: tab2Id,
      });

      store.dispatch(removeTab({ tabId }));

      const ui = store.getState().ui;
      expect(ui.renamingTabId).toBe(tab2Id);
      expect(ui.infoModalTabId).toBe(tab2Id);
      expect(ui.setIconModalTabId).toBe(tab2Id);
    });
  });
});
