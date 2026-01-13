import { useEffect, useCallback } from 'react';
import { usePrism } from './usePrism';
import { useConfig } from '@context/ConfigContext';

export function useKeyboardShortcuts() {
  const { state, dispatch } = usePrism();
  const { maxTabs } = useConfig();

  const createTab = useCallback(
    (panelId: string) => {
      const panelTabs = state.tabs.filter((t) => t.panelId === panelId);
      if (panelTabs.length >= maxTabs) return;

      // Dispatch intent - reducer handles ID generation
      dispatch({ type: 'ADD_TAB', payload: { panelId } });
    },
    [state.tabs, maxTabs, dispatch]
  );

  const closeActiveTab = useCallback(() => {
    const activeTabId = state.activeTabIds[state.activePanelId];
    if (activeTabId) {
      const tab = state.tabs.find((t) => t.id === activeTabId);
      if (tab && !tab.locked) {
        // Just dispatch REMOVE_TAB - reducer handles undo stack internally
        dispatch({ type: 'REMOVE_TAB', payload: { tabId: activeTabId } });
      }
    }
  }, [state, dispatch]);

  const undoCloseTab = useCallback(() => {
    if (state.undoStack.length > 0) {
      dispatch({ type: 'POP_UNDO' });
    }
  }, [state.undoStack, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + N: New tab
      if (isMod && e.key === 'n') {
        e.preventDefault();
        createTab(state.activePanelId);
      }

      // Cmd/Ctrl + D: Close tab
      if (isMod && e.key === 'd') {
        e.preventDefault();
        closeActiveTab();
      }

      // Cmd/Ctrl + Shift + Z: Undo close
      if (isMod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undoCloseTab();
      }

      // Cmd/Ctrl + Shift + H: Toggle search bars
      if (isMod && e.key === 'h') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_SEARCH_BARS' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createTab, closeActiveTab, undoCloseTab, state.activePanelId, dispatch]);
}
