import { useEffect, useCallback, useRef } from 'react';
import { usePrism } from './usePrism';
import { useConfig } from '@context/ConfigContext';
import { findPanelById } from '@utils/panels';
import type { PanelId, TabId } from '@types';

/**
 * Global keyboard shortcuts for Prism component.
 *
 * Shortcuts (Cmd/Ctrl + key):
 * - N: New tab in active panel
 * - D: Delete (close) active tab (if not locked)
 * - J: Navigate to previous tab
 * - K: Navigate to next tab
 * - O: Toggle lock on active tab
 * - I: Toggle pin on active panel
 * - R: Rename active tab (opens rename dialog)
 * - Shift+R: Refresh active tab (force refetch layout from server)
 * - Y: Toggle search bars visibility
 * - B: Duplicate active tab
 * - U: Undo last closed tab
 */
export function useKeyboardShortcuts() {
  const { state, dispatch } = usePrism();
  const { maxTabs } = useConfig();

  // Track rename mode - when true, we prompt user for new name
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // ========== Helper: Get active tab ==========
  const getActiveTab = useCallback(() => {
    const activeTabId = state.activeTabIds[state.activePanelId];
    if (!activeTabId) return null;
    return state.tabs?.find((t) => t.id === activeTabId) ?? null;
  }, [state.activeTabIds, state.activePanelId, state.tabs]);

  // ========== Helper: Get tabs in active panel ==========
  const getActivePanelTabs = useCallback(() => {
    const tabIds = state.panelTabs[state.activePanelId] ?? [];
    return tabIds.map((id) => state.tabs?.find((t) => t.id === id)).filter(Boolean);
  }, [state.panelTabs, state.activePanelId, state.tabs]);

  // ========== Action: Create new tab ==========
  const createTab = useCallback(
    (panelId: PanelId) => {
      const panelTabIds = state.panelTabs[panelId] ?? [];
      // maxTabs < 1 means unlimited; reducer also enforces this
      if (maxTabs >= 1 && panelTabIds.length >= maxTabs) {
        // TODO: Replace with toast.warning when Sonner is integrated
        console.error(`[Prism] Max tabs limit reached (${maxTabs}). Cannot create new tab.`);
        return;
      }

      dispatch({ type: 'ADD_TAB', payload: { panelId } });
    },
    [state.panelTabs, maxTabs, dispatch]
  );

  // ========== Action: Close active tab ==========
  const closeActiveTab = useCallback(() => {
    const tab = getActiveTab();
    const panel = findPanelById(state.panel, state.activePanelId);
    // Don't close if tab is locked OR panel is pinned
    if (tab && !tab.locked && !panel?.pinned) {
      dispatch({ type: 'REMOVE_TAB', payload: { tabId: tab.id } });
    }
  }, [getActiveTab, state.panel, state.activePanelId, dispatch]);

  // ========== Action: Undo close ==========
  const undoCloseTab = useCallback(() => {
    if (state.undoStack.length > 0) {
      dispatch({ type: 'POP_UNDO' });
    }
  }, [state.undoStack, dispatch]);

  // ========== Action: Navigate tabs (J = prev, K = next) ==========
  const navigateTab = useCallback(
    (direction: 'prev' | 'next') => {
      const panelTabs = getActivePanelTabs();
      if (panelTabs.length === 0) return;

      const activeTabId = state.activeTabIds[state.activePanelId];
      const currentIndex = panelTabs.findIndex((t) => t?.id === activeTabId);
      if (currentIndex === -1) return;

      let newIndex: number;
      if (direction === 'prev') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : panelTabs.length - 1;
      } else {
        newIndex = currentIndex < panelTabs.length - 1 ? currentIndex + 1 : 0;
      }

      const newTab = panelTabs[newIndex];
      if (newTab) {
        dispatch({
          type: 'SELECT_TAB',
          payload: { tabId: newTab.id as TabId, panelId: state.activePanelId },
        });
      }
    },
    [getActivePanelTabs, state.activeTabIds, state.activePanelId, dispatch]
  );

  // ========== Action: Toggle tab lock ==========
  const toggleTabLock = useCallback(() => {
    const tab = getActiveTab();
    if (tab) {
      dispatch({ type: 'TOGGLE_TAB_LOCK', payload: { tabId: tab.id } });
    }
  }, [getActiveTab, dispatch]);

  // ========== Action: Toggle panel pin ==========
  const togglePanelPin = useCallback(() => {
    const panelId = state.activePanelId;
    const panel = findPanelById(state.panel, panelId);
    if (!panel) return;

    if (panel.pinned) {
      dispatch({ type: 'UNPIN_PANEL', payload: { panelId } });
    } else {
      dispatch({ type: 'PIN_PANEL', payload: { panelId } });
    }
  }, [state.activePanelId, state.panel, dispatch]);

  // ========== Action: Rename tab ==========
  const renameActiveTab = useCallback(() => {
    const tab = getActiveTab();
    if (!tab || tab.locked) return;

    // Dispatch to trigger inline rename in TabBar via state.renamingTabId
    dispatch({ type: 'START_RENAME_TAB', payload: { tabId: tab.id } });
  }, [getActiveTab, dispatch]);

  // ========== Action: Toggle search bars ==========
  const toggleSearchBars = useCallback(() => {
    dispatch({ type: 'TOGGLE_SEARCH_BARS' });
  }, [dispatch]);

  // ========== Action: Duplicate tab ==========
  const duplicateActiveTab = useCallback(() => {
    const tab = getActiveTab();
    if (!tab) return;

    const panelTabIds = state.panelTabs[state.activePanelId] ?? [];
    // maxTabs < 1 means unlimited; reducer also enforces this
    if (maxTabs >= 1 && panelTabIds.length >= maxTabs) {
      // TODO: Replace with toast.warning when Sonner is integrated
      console.error(`[Prism] Max tabs limit reached (${maxTabs}). Cannot duplicate tab.`);
      return;
    }

    dispatch({ type: 'DUPLICATE_TAB', payload: { tabId: tab.id } });
  }, [getActiveTab, state.panelTabs, state.activePanelId, maxTabs, dispatch]);

  // ========== Action: Refresh tab (force refetch layout) ==========
  const refreshActiveTab = useCallback(() => {
    const tab = getActiveTab();

    // Guards: tab must exist and have a layout
    if (!tab) return;
    if (!tab.layoutId) return;

    dispatch({ type: 'REFRESH_TAB', payload: { tabId: tab.id } });
  }, [getActiveTab, dispatch]);

  // ========== Keyboard event handler ==========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip shortcuts when user is typing in editable elements
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isEditable) return;

      const isCtrlSpace =
        e.ctrlKey && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');
      if (isCtrlSpace) {
        e.preventDefault();
        if (!state.searchBarsHidden) {
          window.dispatchEvent(
            new CustomEvent('prism:focus-searchbar', {
              detail: { panelId: state.activePanelId },
            })
          );
        }
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          // New tab
          e.preventDefault();
          createTab(state.activePanelId);
          break;

        case 'd':
          // Delete (close) tab
          e.preventDefault();
          closeActiveTab();
          break;

        case 'j':
          // Navigate to previous tab
          e.preventDefault();
          navigateTab('prev');
          break;

        case 'k':
          // Navigate to next tab
          e.preventDefault();
          navigateTab('next');
          break;

        case 'o':
          // Toggle lock on active tab
          e.preventDefault();
          toggleTabLock();
          break;

        case 'i':
          // Toggle pin on active panel
          e.preventDefault();
          togglePanelPin();
          break;

        case 'r':
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl/Cmd + Shift + R: Refresh active tab (force refetch layout)
            refreshActiveTab();
          } else {
            // Ctrl/Cmd + R: Rename active tab
            renameActiveTab();
          }
          break;

        case 'y':
          // Toggle search bars
          e.preventDefault();
          toggleSearchBars();
          break;

        case 'b':
          // Duplicate tab
          e.preventDefault();
          duplicateActiveTab();
          break;

        case 'u':
          // Undo close tab
          e.preventDefault();
          undoCloseTab();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.activePanelId,
    createTab,
    closeActiveTab,
    navigateTab,
    toggleTabLock,
    togglePanelPin,
    renameActiveTab,
    refreshActiveTab,
    toggleSearchBars,
    duplicateActiveTab,
    undoCloseTab,
  ]);
}
