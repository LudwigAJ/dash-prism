/**
 * Unit tests for dashSyncMiddleware - Dash state synchronization.
 *
 * These tests verify:
 * - First sync is immediate
 * - Subsequent syncs are debounced
 * - Deduplication via serialization comparison
 * - Syncs on workspace and undo/redo actions
 * - Does not sync on UI-only actions
 * - Cleanup function removes event listeners and clears timeouts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore, combineReducers, isAction, type Middleware } from '@reduxjs/toolkit';
import undoable from 'redux-undo';
import {
  workspaceReducer,
  activateTab,
  addTab,
  removeTab,
  splitPanel,
  collapsePanel,
} from '../workspaceSlice';
import { uiReducer, setSearchBarMode, openHelpModal } from '../uiSlice';
import { createDashSyncMiddleware } from './dashSyncMiddleware';
import type { WorkspaceState, ThunkExtra } from '../types';
import type { PanelId } from '@types';
import { MAX_LEAF_PANELS } from '@constants/panels';

// =============================================================================
// Test Utilities
// =============================================================================

function createTestStore(setProps?: (props: Record<string, unknown>) => void, maxTabs = 16) {
  const thunkExtra: ThunkExtra = {
    getMaxTabs: () => maxTabs,
    getMaxPanels: () => MAX_LEAF_PANELS,
    getRegisteredLayouts: () => ({}),
  };

  const undoableWorkspaceReducer = undoable(workspaceReducer, {
    limit: 50,
    ignoreInitialState: true,
  });

  const rootReducer = combineReducers({
    workspace: undoableWorkspaceReducer,
    ui: uiReducer,
  });

  const dashSync = createDashSyncMiddleware(setProps);

  // dashSyncMiddleware dispatches into the store it was given, so a spy on
  // store.dispatch never sees those actions. Record the stream from inside the
  // chain instead, downstream of the middleware under test.
  const dispatched: string[] = [];
  const recorder: Middleware = () => (next) => (action: unknown) => {
    if (isAction(action)) dispatched.push(action.type);
    return next(action);
  };

  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: thunkExtra },
      })
        .concat(dashSync.middleware)
        .concat(recorder),
  });

  // Return store with typed dispatch for async thunks
  return {
    store: store as typeof store & {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatch: (action: any) => any;
    },
    cleanup: dashSync.cleanup,
    dispatched,
    getState: () =>
      store.getState() as {
        workspace: { present: WorkspaceState };
        ui: { searchBarModes: Record<string, string> };
      },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('dashSyncMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sync triggering', () => {
    it('first sync is immediate', () => {
      const setProps = vi.fn();
      const { store } = createTestStore(setProps);

      // First workspace action
      store.dispatch(activateTab({ tabId: 'tab-1', panelId: 'panel-1' }));

      // Should sync immediately without waiting for debounce
      expect(setProps).toHaveBeenCalledTimes(1);
      expect(setProps).toHaveBeenCalledWith({
        readWorkspace: expect.objectContaining({
          tabs: expect.any(Array),
          panel: expect.any(Object),
        }),
      });
    });

    it('subsequent syncs are debounced', async () => {
      const setProps = vi.fn();
      const { store, getState } = createTestStore(setProps);
      const panelId = getState().workspace.present.activePanelId;

      // First action - immediate (use addTab since it actually changes state)
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 1' }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Second action - should be debounced
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 2' }));
      expect(setProps).toHaveBeenCalledTimes(1); // Still 1, debounced

      // Third action - still debounced
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 3' }));
      expect(setProps).toHaveBeenCalledTimes(1); // Still 1

      // Advance timer past debounce threshold (500ms)
      vi.advanceTimersByTime(500);
      expect(setProps).toHaveBeenCalledTimes(2); // Now synced
    });

    it('debounce resets on each action', async () => {
      const setProps = vi.fn();
      const { store, getState } = createTestStore(setProps);
      const panelId = getState().workspace.present.activePanelId;

      // First action - immediate
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 1' }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Wait 300ms
      vi.advanceTimersByTime(300);

      // Another action resets debounce
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 2' }));

      // Wait another 300ms (total 600ms from first, but only 300ms from second)
      vi.advanceTimersByTime(300);
      expect(setProps).toHaveBeenCalledTimes(1); // Still debounced

      // Wait remaining 200ms
      vi.advanceTimersByTime(200);
      expect(setProps).toHaveBeenCalledTimes(2); // Now synced
    });
  });

  describe('deduplication', () => {
    it('does not sync identical state', () => {
      const setProps = vi.fn();
      const { store, getState } = createTestStore(setProps);
      const state = getState().workspace.present;
      const panelId = state.activePanelId;
      const tabId = state.tabs[0]?.id;

      // First action
      store.dispatch(activateTab({ tabId: tabId, panelId: panelId }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Same selection again - state hasn't changed
      vi.advanceTimersByTime(500);
      store.dispatch(activateTab({ tabId: tabId, panelId: panelId }));
      vi.advanceTimersByTime(500);

      // Should still be 1 because state is identical
      expect(setProps).toHaveBeenCalledTimes(1);
    });
  });

  describe('action filtering', () => {
    it('syncs on workspace actions', async () => {
      const setProps = vi.fn();
      const { store, getState } = createTestStore(setProps);
      const panelId = getState().workspace.present.activePanelId;

      await store.dispatch(addTab({ panelId: panelId, name: 'New Tab' }));

      expect(setProps).toHaveBeenCalled();
    });

    it('does not sync on UI-only actions', () => {
      const setProps = vi.fn();
      const { store } = createTestStore(setProps);

      // UI action - should not trigger sync
      store.dispatch(setSearchBarMode({ panelId: 'panel-1', mode: 'search' }));

      expect(setProps).not.toHaveBeenCalled();

      // Another UI action
      store.dispatch(openHelpModal());

      expect(setProps).not.toHaveBeenCalled();
    });

    it('syncs on undo action', async () => {
      const setProps = vi.fn();
      const { store, getState } = createTestStore(setProps);
      const panelId = getState().workspace.present.activePanelId;

      // First, make a change
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 2' }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Clear debounce
      vi.advanceTimersByTime(500);

      // Undo
      store.dispatch({ type: '@@redux-undo/UNDO' });
      vi.advanceTimersByTime(500);

      // Should have synced twice total
      expect(setProps.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('syncs on redo action', async () => {
      const setProps = vi.fn();
      const { store, getState } = createTestStore(setProps);
      const panelId = getState().workspace.present.activePanelId;

      // Make a change
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 2' }));
      vi.advanceTimersByTime(500);

      // Undo
      store.dispatch({ type: '@@redux-undo/UNDO' });
      vi.advanceTimersByTime(500);

      const callCountAfterUndo = setProps.mock.calls.length;

      // Redo
      store.dispatch({ type: '@@redux-undo/REDO' });
      vi.advanceTimersByTime(500);

      expect(setProps.mock.calls.length).toBeGreaterThan(callCountAfterUndo);
    });
  });

  describe('no setProps', () => {
    it('handles undefined setProps gracefully', () => {
      const { store } = createTestStore(undefined);

      // Should not throw
      expect(() => {
        store.dispatch(activateTab({ tabId: 'tab-1', panelId: 'panel-1' }));
      }).not.toThrow();
    });
  });

  describe('workspace snapshot', () => {
    it('includes all required workspace fields', async () => {
      const setProps = vi.fn();
      const { store, getState } = createTestStore(setProps);
      const panelId = getState().workspace.present.activePanelId;

      await store.dispatch(addTab({ panelId: panelId, name: 'New Tab' }));

      expect(setProps).toHaveBeenCalledWith({
        readWorkspace: expect.objectContaining({
          tabs: expect.any(Array),
          panel: expect.any(Object),
          panelTabs: expect.any(Object),
          activeTabIds: expect.any(Object),
          activePanelId: expect.any(String),
          favoriteLayouts: expect.any(Array),
          searchBarsHidden: expect.any(Boolean),
        }),
      });
    });
  });

  describe('cleanup', () => {
    it('clears pending debounced sync', () => {
      const setProps = vi.fn();
      const { store, cleanup } = createTestStore(setProps);

      // First action - immediate
      store.dispatch(activateTab({ tabId: 'tab-1', panelId: 'panel-1' }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Second action - debounced
      store.dispatch(activateTab({ tabId: 'tab-2', panelId: 'panel-1' }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Cleanup before debounce fires
      cleanup();

      // Advance timer - should NOT sync because cleanup cleared the timeout
      vi.advanceTimersByTime(500);
      expect(setProps).toHaveBeenCalledTimes(1);
    });

    it('can be called multiple times safely', () => {
      const { cleanup } = createTestStore(undefined);

      // Should not throw
      expect(() => {
        cleanup();
        cleanup();
        cleanup();
      }).not.toThrow();
    });

    it('removes event listeners', () => {
      // Skip in Node.js environment without window
      if (typeof window === 'undefined') {
        return;
      }

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { cleanup } = createTestStore(undefined);

      cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  // ===========================================================================
  // Search-bar mode cleanup (Phase 3 A-7): stale modes are pruned after any
  // workspace change that removes a panel, not only after collapsePanel.
  // ===========================================================================
  describe('search-bar mode cleanup', () => {
    async function splitIntoTwoPanels(store: ReturnType<typeof createTestStore>['store']) {
      const rootPanelId = store.getState().workspace.present.panel.id;
      await store.dispatch(addTab({ panelId: rootPanelId, name: 'Tab A' }));
      await store.dispatch(addTab({ panelId: rootPanelId, name: 'Tab B' }));
      const [tabA, tabB] = store.getState().workspace.present.tabs;
      await store.dispatch(
        splitPanel({ panelId: rootPanelId, direction: 'horizontal', tabId: tabB.id })
      );
      const leafIds = store
        .getState()
        .workspace.present.panel.children.map((child: { id: string }) => child.id);
      const newPanelId = leafIds.find((id: PanelId) => id !== rootPanelId) as PanelId;
      return { rootPanelId, newPanelId, tabA, tabB };
    }

    it('prunes the mode of a panel collapsed by removing its last tab', async () => {
      const { store, getState } = createTestStore(vi.fn());
      const { rootPanelId, newPanelId, tabB } = await splitIntoTwoPanels(store);

      store.dispatch(setSearchBarMode({ panelId: rootPanelId, mode: 'search' }));
      store.dispatch(setSearchBarMode({ panelId: newPanelId, mode: 'display' }));
      expect(Object.keys(getState().ui.searchBarModes).sort()).toEqual(
        [rootPanelId, newPanelId].sort()
      );

      // removeTab collapses the now-empty panel internally; no collapsePanel
      // action is ever dispatched.
      store.dispatch(removeTab({ tabId: tabB.id }));

      expect(getState().ui.searchBarModes[newPanelId]).toBeUndefined();
      expect(getState().ui.searchBarModes[rootPanelId]).toBe('search');
    });

    it('still prunes after an explicit collapsePanel', async () => {
      const { store, getState } = createTestStore(vi.fn());
      const { rootPanelId, newPanelId } = await splitIntoTwoPanels(store);
      store.dispatch(setSearchBarMode({ panelId: newPanelId, mode: 'search' }));

      store.dispatch(collapsePanel({ panelId: newPanelId }));

      expect(getState().ui.searchBarModes[newPanelId]).toBeUndefined();
      expect(getState().ui.searchBarModes[rootPanelId]).toBeUndefined();
    });

    it('does not dispatch prune actions when nothing is stale', async () => {
      const { store, dispatched } = createTestStore(vi.fn());
      const { rootPanelId, tabA } = await splitIntoTwoPanels(store);
      store.dispatch(setSearchBarMode({ panelId: rootPanelId, mode: 'search' }));

      dispatched.length = 0;
      store.dispatch(activateTab({ panelId: rootPanelId, tabId: tabA.id }));

      expect(dispatched).not.toContain('ui/pruneSearchBarModes');
    });

    it('does dispatch a prune action when a mode is stale (the guard above has teeth)', async () => {
      const { store, dispatched } = createTestStore(vi.fn());
      const { newPanelId, tabB } = await splitIntoTwoPanels(store);
      store.dispatch(setSearchBarMode({ panelId: newPanelId, mode: 'search' }));

      dispatched.length = 0;
      store.dispatch(removeTab({ tabId: tabB.id }));

      expect(dispatched).toContain('ui/pruneSearchBarModes');
    });
  });
});
