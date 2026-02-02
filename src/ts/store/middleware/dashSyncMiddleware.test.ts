/**
 * Unit tests for dashSyncMiddleware - Dash state synchronization.
 *
 * These tests verify:
 * - First sync is immediate
 * - Subsequent syncs are debounced
 * - Deduplication via serialization comparison
 * - Syncs on workspace and undo/redo actions
 * - Does not sync on UI-only actions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import undoable from 'redux-undo';
import workspaceReducer, { selectTab, addTab, removeTab } from '../workspaceSlice';
import uiReducer, { setSearchBarMode, openHelpModal } from '../uiSlice';
import { createDashSyncMiddleware } from './dashSyncMiddleware';
import type { WorkspaceState, ThunkExtra } from '../types';
import type { PanelId, TabId } from '@types';

// =============================================================================
// Test Utilities
// =============================================================================

function createTestStore(setProps?: (props: Record<string, unknown>) => void, maxTabs = 16) {
  const thunkExtra: ThunkExtra = { maxTabs };

  const undoableWorkspaceReducer = undoable(workspaceReducer, {
    limit: 50,
    ignoreInitialState: true,
  });

  const rootReducer = combineReducers({
    workspace: undoableWorkspaceReducer,
    ui: uiReducer,
  });

  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: { extraArgument: thunkExtra },
      }).concat(createDashSyncMiddleware(setProps)),
  });
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
      const store = createTestStore(setProps);

      // First workspace action
      store.dispatch(selectTab({ tabId: 'tab-1' as TabId, panelId: 'panel-1' as PanelId }));

      // Should sync immediately without waiting for debounce
      expect(setProps).toHaveBeenCalledTimes(1);
      expect(setProps).toHaveBeenCalledWith({
        readWorkspace: expect.objectContaining({
          tabs: expect.any(Array),
          panel: expect.any(Object),
        }),
      });
    });

    it('subsequent syncs are debounced', () => {
      const setProps = vi.fn();
      const store = createTestStore(setProps);

      // First action - immediate
      store.dispatch(selectTab({ tabId: 'tab-1' as TabId, panelId: 'panel-1' as PanelId }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Second action - should be debounced
      store.dispatch(selectTab({ tabId: 'tab-2' as TabId, panelId: 'panel-1' as PanelId }));
      expect(setProps).toHaveBeenCalledTimes(1); // Still 1, debounced

      // Third action - still debounced
      store.dispatch(selectTab({ tabId: 'tab-3' as TabId, panelId: 'panel-1' as PanelId }));
      expect(setProps).toHaveBeenCalledTimes(1); // Still 1

      // Advance timer past debounce threshold (500ms)
      vi.advanceTimersByTime(500);
      expect(setProps).toHaveBeenCalledTimes(2); // Now synced
    });

    it('debounce resets on each action', () => {
      const setProps = vi.fn();
      const store = createTestStore(setProps);

      // First action - immediate
      store.dispatch(selectTab({ tabId: 'tab-1' as TabId, panelId: 'panel-1' as PanelId }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Wait 300ms
      vi.advanceTimersByTime(300);

      // Another action resets debounce
      store.dispatch(selectTab({ tabId: 'tab-2' as TabId, panelId: 'panel-1' as PanelId }));

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
      const store = createTestStore(setProps);
      const state = store.getState().workspace.present;
      const panelId = state.activePanelId;
      const tabId = state.tabs[0]?.id;

      // First action
      store.dispatch(selectTab({ tabId: tabId as TabId, panelId: panelId as PanelId }));
      expect(setProps).toHaveBeenCalledTimes(1);

      // Same selection again - state hasn't changed
      vi.advanceTimersByTime(500);
      store.dispatch(selectTab({ tabId: tabId as TabId, panelId: panelId as PanelId }));
      vi.advanceTimersByTime(500);

      // Should still be 1 because state is identical
      expect(setProps).toHaveBeenCalledTimes(1);
    });
  });

  describe('action filtering', () => {
    it('syncs on workspace actions', async () => {
      const setProps = vi.fn();
      const store = createTestStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

      await store.dispatch(addTab({ panelId: panelId as PanelId, name: 'New Tab' }));

      expect(setProps).toHaveBeenCalled();
    });

    it('does not sync on UI-only actions', () => {
      const setProps = vi.fn();
      const store = createTestStore(setProps);

      // UI action - should not trigger sync
      store.dispatch(setSearchBarMode({ panelId: 'panel-1' as PanelId, mode: 'search' }));

      expect(setProps).not.toHaveBeenCalled();

      // Another UI action
      store.dispatch(openHelpModal());

      expect(setProps).not.toHaveBeenCalled();
    });

    it('syncs on undo action', async () => {
      const setProps = vi.fn();
      const store = createTestStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

      // First, make a change
      await store.dispatch(addTab({ panelId: panelId as PanelId, name: 'Tab 2' }));
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
      const store = createTestStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

      // Make a change
      await store.dispatch(addTab({ panelId: panelId as PanelId, name: 'Tab 2' }));
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
      const store = createTestStore(undefined);

      // Should not throw
      expect(() => {
        store.dispatch(selectTab({ tabId: 'tab-1' as TabId, panelId: 'panel-1' as PanelId }));
      }).not.toThrow();
    });
  });

  describe('workspace snapshot', () => {
    it('includes all required workspace fields', async () => {
      const setProps = vi.fn();
      const store = createTestStore(setProps);
      const panelId = store.getState().workspace.present.activePanelId;

      await store.dispatch(addTab({ panelId: panelId as PanelId, name: 'New Tab' }));

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
});
