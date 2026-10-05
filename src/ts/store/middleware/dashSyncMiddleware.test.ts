/**
 * Unit tests for dashSyncMiddleware - Dash state synchronization.
 *
 * These tests verify:
 * - First sync is immediate
 * - Subsequent syncs are debounced
 * - Deduplication via serialization comparison
 * - Syncs on workspace and undo/redo actions
 * - Does not sync on UI-only actions
 * - A connected middleware sends a pending sync on page unload, also after a reconnect
 * - A disconnect drops a pending sync
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isAction, type Middleware } from '@reduxjs/toolkit';
import { ActionCreators, ActionTypes } from 'redux-undo';
import { PERSIST, REHYDRATE } from 'redux-persist';
import { activateTab, removeTab } from '@store/workspaceSlice';
import { addTab, splitPanel } from '@store/workspaceThunks';
import { setSearchBarMode, openHelpModal } from '@store/uiSlice';
import { createDashSyncMiddleware, isWorkspaceChange } from './dashSyncMiddleware';
import { createTestStore, PANEL_1, TAB_1, type TestStore } from '@store/testing';

// connect() listens for page unload on window, and the tests run in node.
vi.stubGlobal('window', new EventTarget());

function createSyncedStore(setProps?: (props: Record<string, unknown>) => void) {
  const dashSync = createDashSyncMiddleware(setProps);

  // dashSyncMiddleware dispatches into the store it was given, so a spy on
  // store.dispatch never sees those actions. Record the stream from inside the
  // chain instead, downstream of the middleware under test.
  const dispatched: string[] = [];
  const recorder: Middleware = () => (next) => (action: unknown) => {
    if (isAction(action)) dispatched.push(action.type);
    return next(action);
  };

  const store = createTestStore(undefined, { middleware: [dashSync.middleware, recorder] });
  return { store, connect: dashSync.connect, dispatched };
}

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
      const { store } = createSyncedStore(setProps);

      // First workspace action
      store.dispatch(activateTab({ tabId: TAB_1, panelId: PANEL_1 }));

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
      const { store } = createSyncedStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

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
      const { store } = createSyncedStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

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
      const { store } = createSyncedStore(setProps);
      const state = store.getState().workspace.present;
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
      const { store } = createSyncedStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

      await store.dispatch(addTab({ panelId: panelId, name: 'New Tab' }));

      expect(setProps).toHaveBeenCalled();
    });

    it('does not sync on UI-only actions', () => {
      const setProps = vi.fn();
      const { store } = createSyncedStore(setProps);

      // UI action - should not trigger sync
      store.dispatch(setSearchBarMode({ panelId: PANEL_1, mode: 'search' }));

      expect(setProps).not.toHaveBeenCalled();

      // Another UI action
      store.dispatch(openHelpModal());

      expect(setProps).not.toHaveBeenCalled();
    });

    it('syncs on undo action', async () => {
      const setProps = vi.fn();
      const { store } = createSyncedStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

      // First, make a change
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 2' }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Clear debounce
      vi.advanceTimersByTime(500);

      // Undo
      store.dispatch(ActionCreators.undo());
      vi.advanceTimersByTime(500);

      // Should have synced twice total
      expect(setProps.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('syncs on redo action', async () => {
      const setProps = vi.fn();
      const { store } = createSyncedStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

      // Make a change
      await store.dispatch(addTab({ panelId: panelId, name: 'Tab 2' }));
      vi.advanceTimersByTime(500);

      // Undo
      store.dispatch(ActionCreators.undo());
      vi.advanceTimersByTime(500);

      const callCountAfterUndo = setProps.mock.calls.length;

      // Redo
      store.dispatch(ActionCreators.redo());
      vi.advanceTimersByTime(500);

      expect(setProps.mock.calls.length).toBeGreaterThan(callCountAfterUndo);
    });
  });

  describe('no setProps', () => {
    it('handles undefined setProps gracefully', () => {
      const { store } = createSyncedStore(undefined);

      // Should not throw
      expect(() => {
        store.dispatch(activateTab({ tabId: TAB_1, panelId: PANEL_1 }));
      }).not.toThrow();
    });
  });

  describe('workspace snapshot', () => {
    it('includes all required workspace fields', async () => {
      const setProps = vi.fn();
      const { store } = createSyncedStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

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

  describe('page unload', () => {
    /** Sends the first sync at once and leaves a second sync pending. */
    async function makePendingSync(store: TestStore) {
      const panelId = store.getState().workspace.present.activePanelId;
      await store.dispatch(addTab({ panelId, name: 'Tab 1' }));
      await store.dispatch(addTab({ panelId, name: 'Tab 2' }));
    }

    it('sends the pending sync at once when the page unloads', async () => {
      const setProps = vi.fn();
      const { store, connect } = createSyncedStore(setProps);
      const disconnect = connect();

      await makePendingSync(store);
      expect(setProps).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new Event('pagehide'));
      expect(setProps).toHaveBeenCalledTimes(2);

      // The timer of the flushed sync does not send the same workspace again.
      vi.advanceTimersByTime(500);
      expect(setProps).toHaveBeenCalledTimes(2);
      disconnect();
    });

    // React StrictMode runs the effect that connects the middleware, its cleanup and the effect
    // again.
    it('sends the pending sync on unload after a reconnect', async () => {
      const setProps = vi.fn();
      const { store, connect } = createSyncedStore(setProps);
      connect()();
      const disconnect = connect();

      await makePendingSync(store);
      window.dispatchEvent(new Event('beforeunload'));

      expect(setProps).toHaveBeenCalledTimes(2);
      disconnect();
    });

    it('drops the pending sync and ignores the unload after a disconnect', async () => {
      const setProps = vi.fn();
      const { store, connect } = createSyncedStore(setProps);
      const disconnect = connect();

      await makePendingSync(store);
      disconnect();

      vi.advanceTimersByTime(500);
      window.dispatchEvent(new Event('pagehide'));
      expect(setProps).toHaveBeenCalledTimes(1);
    });
  });

  // Any workspace change that removes a panel also removes the stale search-bar modes.
  describe('search-bar mode cleanup', () => {
    async function splitIntoTwoPanels(store: TestStore) {
      const rootPanelId = store.getState().workspace.present.panel.id;
      await store.dispatch(addTab({ panelId: rootPanelId, name: 'Tab A' }));
      await store.dispatch(addTab({ panelId: rootPanelId, name: 'Tab B' }));
      const [tabA, tabB] = store.getState().workspace.present.tabs;
      await store.dispatch(
        splitPanel({ panelId: rootPanelId, direction: 'horizontal', tabId: tabB.id })
      );
      // The split keeps the id of the old panel for its first child.
      const newPanelId = store.getState().workspace.present.panel.children[1].id;
      return { rootPanelId, newPanelId, tabA, tabB };
    }

    it('prunes the mode of a panel collapsed by removing its last tab', async () => {
      const { store } = createSyncedStore(vi.fn());
      const { rootPanelId, newPanelId, tabB } = await splitIntoTwoPanels(store);

      store.dispatch(setSearchBarMode({ panelId: rootPanelId, mode: 'search' }));
      store.dispatch(setSearchBarMode({ panelId: newPanelId, mode: 'display' }));
      expect(Object.keys(store.getState().ui.searchBarModes).sort()).toEqual(
        [rootPanelId, newPanelId].sort()
      );

      // removeTab collapses the now-empty panel internally.
      store.dispatch(removeTab({ tabId: tabB.id }));

      expect(store.getState().ui.searchBarModes[newPanelId]).toBeUndefined();
      expect(store.getState().ui.searchBarModes[rootPanelId]).toBe('search');
    });

    it('does not dispatch prune actions when nothing is stale', async () => {
      const { store, dispatched } = createSyncedStore(vi.fn());
      const { rootPanelId, tabA } = await splitIntoTwoPanels(store);
      store.dispatch(setSearchBarMode({ panelId: rootPanelId, mode: 'search' }));

      dispatched.length = 0;
      store.dispatch(activateTab({ panelId: rootPanelId, tabId: tabA.id }));

      expect(dispatched).not.toContain('ui/pruneSearchBarModes');
    });

    it('does dispatch a prune action when a mode is stale (the guard above has teeth)', async () => {
      const { store, dispatched } = createSyncedStore(vi.fn());
      const { newPanelId, tabB } = await splitIntoTwoPanels(store);
      store.dispatch(setSearchBarMode({ panelId: newPanelId, mode: 'search' }));

      dispatched.length = 0;
      store.dispatch(removeTab({ tabId: tabB.id }));

      expect(dispatched).toContain('ui/pruneSearchBarModes');
    });
  });
});

describe('isWorkspaceChange', () => {
  it('matches workspace actions, history moves and the rehydration', () => {
    for (const type of [
      'workspace/renameTab',
      ActionTypes.UNDO,
      ActionTypes.REDO,
      ActionTypes.JUMP,
      ActionTypes.JUMP_TO_PAST,
      ActionTypes.JUMP_TO_FUTURE,
      REHYDRATE,
    ]) {
      expect(isWorkspaceChange({ type })).toBe(true);
    }
  });

  it('does not match ui actions or actions that leave the present workspace alone', () => {
    for (const type of ['ui/openHelpModal', ActionTypes.CLEAR_HISTORY, PERSIST]) {
      expect(isWorkspaceChange({ type })).toBe(false);
    }
  });
});
