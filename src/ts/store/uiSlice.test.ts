/**
 * Unit tests for uiSlice - ephemeral UI state management.
 *
 * These tests verify:
 * - Search bar mode management
 * - Tab renaming state
 * - Modal state (info, help, set icon)
 */

import { describe, it, expect } from 'vitest';
import {
  setSearchBarMode,
  clearSearchBarMode,
  pruneSearchBarModes,
  startRenameTab,
  clearRenameTab,
  requestLayoutSelection,
  clearLayoutSelectionRequest,
  requestSearchFocus,
  clearSearchFocusRequest,
  openInfoModal,
  closeInfoModal,
  openHelpModal,
  closeHelpModal,
  openSetIconModal,
  closeSetIconModal,
  setLoadNotice,
  clearLoadNotice,
} from './uiSlice';
import { removeTab } from './workspaceSlice';
import type { UiState } from './types';
import type { TabId } from '@types';
import { createTestStore, makeWorkspace, TAB_1, TAB_2, type TestStore } from './testing';

function createUiStore(ui: Partial<UiState> = {}): TestStore {
  return createTestStore(undefined, { ui });
}

function getUiState(store: TestStore): UiState {
  return store.getState().ui;
}

describe('uiSlice', () => {
  describe('initial state', () => {
    it('has correct initial values', () => {
      const store = createUiStore();
      const state = getUiState(store);

      expect(state.searchBarModes).toEqual({});
      expect(state.renamingTabId).toBeNull();
      expect(state.layoutSelectionRequest).toBeNull();
      expect(state.searchFocusPanelId).toBeNull();
      expect(state.infoModalTabId).toBeNull();
      expect(state.helpModalOpen).toBe(false);
      expect(state.setIconModalTabId).toBeNull();
    });
  });

  describe('setSearchBarMode', () => {
    it('sets mode for a panel', () => {
      const store = createUiStore();

      store.dispatch(setSearchBarMode({ panelId: 'panel-1', mode: 'search' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBe('search');
    });

    it('updates existing mode for a panel', () => {
      const store = createUiStore({
        searchBarModes: { 'panel-1': 'display' },
      });

      store.dispatch(setSearchBarMode({ panelId: 'panel-1', mode: 'params' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBe('params');
    });

    it('can set mode for multiple panels', () => {
      const store = createUiStore();

      store.dispatch(setSearchBarMode({ panelId: 'panel-1', mode: 'search' }));
      store.dispatch(setSearchBarMode({ panelId: 'panel-2', mode: 'options' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBe('search');
      expect(getUiState(store).searchBarModes['panel-2']).toBe('options');
    });

    it('accepts all valid mode values', () => {
      const store = createUiStore();
      const modes = ['hidden', 'display', 'search', 'params', 'options'] as const;

      for (const mode of modes) {
        store.dispatch(setSearchBarMode({ panelId: 'panel-1', mode }));
        expect(getUiState(store).searchBarModes['panel-1']).toBe(mode);
      }
    });
  });

  describe('clearSearchBarMode', () => {
    it('removes mode for a panel', () => {
      const store = createUiStore({
        searchBarModes: { 'panel-1': 'search' },
      });

      store.dispatch(clearSearchBarMode({ panelId: 'panel-1' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBeUndefined();
    });

    it('preserves other panels when clearing one', () => {
      const store = createUiStore({
        searchBarModes: {
          'panel-1': 'search',
          'panel-2': 'display',
        },
      });

      store.dispatch(clearSearchBarMode({ panelId: 'panel-1' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBeUndefined();
      expect(getUiState(store).searchBarModes['panel-2']).toBe('display');
    });

    it('is a no-op for non-existent panel', () => {
      const store = createUiStore({
        searchBarModes: { 'panel-1': 'search' },
      });

      store.dispatch(clearSearchBarMode({ panelId: 'panel-nonexistent' }));

      expect(getUiState(store).searchBarModes['panel-1']).toBe('search');
    });
  });

  describe('pruneSearchBarModes', () => {
    it('drops modes whose panel is not in the leaf list', () => {
      const store = createUiStore({
        searchBarModes: {
          'panel-1': 'search',
          'panel-2': 'display',
          'panel-3': 'search',
        },
      });

      store.dispatch(pruneSearchBarModes({ leafPanelIds: ['panel-2'] }));

      expect(getUiState(store).searchBarModes).toEqual({ 'panel-2': 'display' });
    });

    it('keeps every mode when all panels still exist', () => {
      const store = createUiStore({
        searchBarModes: { 'panel-1': 'search', 'panel-2': 'display' },
      });

      store.dispatch(pruneSearchBarModes({ leafPanelIds: ['panel-1', 'panel-2'] }));

      expect(getUiState(store).searchBarModes).toEqual({
        'panel-1': 'search',
        'panel-2': 'display',
      });
    });

    it('clears everything when the leaf list is empty', () => {
      const store = createUiStore({
        searchBarModes: { 'panel-1': 'search' },
      });

      store.dispatch(pruneSearchBarModes({ leafPanelIds: [] }));

      expect(getUiState(store).searchBarModes).toEqual({});
    });
  });

  describe('startRenameTab / clearRenameTab', () => {
    it('startRenameTab sets renamingTabId', () => {
      const store = createUiStore();

      store.dispatch(startRenameTab({ tabId: 'tab-1' }));

      expect(getUiState(store).renamingTabId).toBe('tab-1');
    });

    it('clearRenameTab clears renamingTabId', () => {
      const store = createUiStore({ renamingTabId: 'tab-1' });

      store.dispatch(clearRenameTab());

      expect(getUiState(store).renamingTabId).toBeNull();
    });

    it('startRenameTab replaces existing renamingTabId', () => {
      const store = createUiStore({ renamingTabId: 'tab-1' });

      store.dispatch(startRenameTab({ tabId: 'tab-2' }));

      expect(getUiState(store).renamingTabId).toBe('tab-2');
    });
  });

  describe('requestLayoutSelection / clearLayoutSelectionRequest', () => {
    it('requestLayoutSelection stores the tab and the layout', () => {
      const store = createUiStore();

      store.dispatch(requestLayoutSelection({ tabId: 'tab-1', layoutId: 'home' }));

      expect(getUiState(store).layoutSelectionRequest).toEqual({
        tabId: 'tab-1',
        layoutId: 'home',
      });
    });

    it('clearLayoutSelectionRequest clears the request', () => {
      const store = createUiStore({
        layoutSelectionRequest: { tabId: 'tab-1', layoutId: 'home' },
      });

      store.dispatch(clearLayoutSelectionRequest());

      expect(getUiState(store).layoutSelectionRequest).toBeNull();
    });

    it('a new request replaces a request that nobody consumed', () => {
      const store = createUiStore({
        layoutSelectionRequest: { tabId: 'tab-1', layoutId: 'home' },
      });

      store.dispatch(requestLayoutSelection({ tabId: 'tab-2', layoutId: 'about' }));

      expect(getUiState(store).layoutSelectionRequest).toEqual({
        tabId: 'tab-2',
        layoutId: 'about',
      });
    });
  });

  describe('requestSearchFocus / clearSearchFocusRequest', () => {
    it('requestSearchFocus stores the panel', () => {
      const store = createUiStore();

      store.dispatch(requestSearchFocus({ panelId: 'panel-1' }));

      expect(getUiState(store).searchFocusPanelId).toBe('panel-1');
    });

    it('clearSearchFocusRequest clears the request', () => {
      const store = createUiStore({ searchFocusPanelId: 'panel-1' });

      store.dispatch(clearSearchFocusRequest());

      expect(getUiState(store).searchFocusPanelId).toBeNull();
    });
  });

  describe('openInfoModal / closeInfoModal', () => {
    it('openInfoModal sets infoModalTabId', () => {
      const store = createUiStore();

      store.dispatch(openInfoModal({ tabId: 'tab-1' }));

      expect(getUiState(store).infoModalTabId).toBe('tab-1');
    });

    it('closeInfoModal clears infoModalTabId', () => {
      const store = createUiStore({ infoModalTabId: 'tab-1' });

      store.dispatch(closeInfoModal());

      expect(getUiState(store).infoModalTabId).toBeNull();
    });

    it('openInfoModal replaces existing modal', () => {
      const store = createUiStore({ infoModalTabId: 'tab-1' });

      store.dispatch(openInfoModal({ tabId: 'tab-2' }));

      expect(getUiState(store).infoModalTabId).toBe('tab-2');
    });
  });

  describe('openHelpModal / closeHelpModal', () => {
    it('openHelpModal sets helpModalOpen to true', () => {
      const store = createUiStore();

      store.dispatch(openHelpModal());

      expect(getUiState(store).helpModalOpen).toBe(true);
    });

    it('closeHelpModal sets helpModalOpen to false', () => {
      const store = createUiStore({ helpModalOpen: true });

      store.dispatch(closeHelpModal());

      expect(getUiState(store).helpModalOpen).toBe(false);
    });
  });

  describe('setLoadNotice / clearLoadNotice', () => {
    it('starts empty, records the closed-tab count and clears it', () => {
      const store = createUiStore();
      expect(getUiState(store).loadNotice).toBeNull();

      store.dispatch(setLoadNotice({ closedTabs: 2 }));
      expect(getUiState(store).loadNotice).toEqual({ closedTabs: 2 });

      store.dispatch(clearLoadNotice());
      expect(getUiState(store).loadNotice).toBeNull();
    });
  });

  describe('openSetIconModal / closeSetIconModal', () => {
    it('openSetIconModal sets setIconModalTabId', () => {
      const store = createUiStore();

      store.dispatch(openSetIconModal({ tabId: 'tab-1' }));

      expect(getUiState(store).setIconModalTabId).toBe('tab-1');
    });

    it('closeSetIconModal clears setIconModalTabId', () => {
      const store = createUiStore({ setIconModalTabId: 'tab-1' });

      store.dispatch(closeSetIconModal());

      expect(getUiState(store).setIconModalTabId).toBeNull();
    });

    it('openSetIconModal replaces existing modal', () => {
      const store = createUiStore({ setIconModalTabId: 'tab-1' });

      store.dispatch(openSetIconModal({ tabId: 'tab-2' }));

      expect(getUiState(store).setIconModalTabId).toBe('tab-2');
    });
  });

  describe('state isolation', () => {
    it('actions do not affect unrelated state', () => {
      const store = createUiStore({
        searchBarModes: { 'panel-1': 'search' },
        renamingTabId: 'tab-1',
        infoModalTabId: 'tab-2',
        helpModalOpen: true,
        setIconModalTabId: 'tab-3',
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

  // removeTab in the workspace slice clears the ui references to the tab.
  describe('cross-slice: removeTab cleanup', () => {
    const tabId = TAB_1;
    const tab2Id = TAB_2;

    function createCombinedStore(ui: Partial<UiState> = {}): TestStore {
      return createTestStore(makeWorkspace([[TAB_1, TAB_2]]), { ui });
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

    it('clears a layout selection request for that tab only', () => {
      const request = (target: TabId) => ({ tabId: target, layoutId: 'home' });

      const own = createCombinedStore({ layoutSelectionRequest: request(tabId) });
      own.dispatch(removeTab({ tabId }));
      expect(own.getState().ui.layoutSelectionRequest).toBeNull();

      const other = createCombinedStore({ layoutSelectionRequest: request(tab2Id) });
      other.dispatch(removeTab({ tabId }));
      expect(other.getState().ui.layoutSelectionRequest).toEqual(request(tab2Id));
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
