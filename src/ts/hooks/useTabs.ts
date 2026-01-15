import { useCallback } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { usePrism } from './usePrism';
import { useConfig } from '../context/ConfigContext';
import { findTabById, getTabsByPanelId } from '@utils/tabs';

/**
 * Hook for managing tabs within a specific panel.
 * Provides CRUD operations and tab state for a panel.
 *
 * @param panelId - The panel ID to manage tabs for
 * @returns Object with tab list, constraints, and action functions
 *
 * @example
 * ```tsx
 * function TabManager({ panelId }: { panelId: string }) {
 *   const { panelTabs, canAddTab, createTab, closeTab } = useTabs(panelId);
 *
 *   return (
 *     <div>
 *       {panelTabs.map(tab => (
 *         <Tab key={tab.id} onClose={() => closeTab(tab.id)} />
 *       ))}
 *       {canAddTab && <button onClick={() => createTab()}>New Tab</button>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTabs(panelId: string) {
  const { state, dispatch } = usePrism();
  const { maxTabs } = useConfig();

  const panelTabs = getTabsByPanelId(state.tabs, panelId);

  const createTab = useCallback(
    (name = 'New Tab', layoutId?: string) => {
      // maxTabs < 1 means unlimited; reducer also enforces this
      if (maxTabs >= 1 && panelTabs.length >= maxTabs) {
        console.warn(`Max tabs (${maxTabs}) reached for panel ${panelId}`);
        return;
      }

      // Dispatch intent - reducer handles ID generation
      dispatch({ type: 'ADD_TAB', payload: { panelId, name, layoutId } });
    },
    [panelTabs.length, maxTabs, panelId, dispatch]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      // Dispatch REMOVE_TAB - reducer validates (ignores locked tabs) and handles undo stack
      dispatch({ type: 'REMOVE_TAB', payload: { tabId } });
    },
    [dispatch]
  );

  const duplicateTab = useCallback(
    (tabId: string) => {
      // maxTabs < 1 means unlimited; reducer also enforces this
      if (maxTabs >= 1 && panelTabs.length >= maxTabs) {
        console.warn(`Max tabs (${maxTabs}) reached for panel ${panelId}`);
        return;
      }
      // Dispatch intent - reducer handles ID generation and copying
      dispatch({ type: 'DUPLICATE_TAB', payload: { tabId } });
    },
    [panelTabs.length, maxTabs, panelId, dispatch]
  );

  const moveTab = useCallback(
    (tabId: string, targetPanelId: string) => {
      if (targetPanelId === panelId) return false;
      dispatch({ type: 'MOVE_TAB', payload: { tabId, targetPanelId } });
      return true;
    },
    [panelId, dispatch]
  );

  const renameTab = useCallback(
    (tabId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      dispatch({ type: 'RENAME_TAB', payload: { tabId, name: trimmed } });
      return true;
    },
    [dispatch]
  );

  const toggleLock = useCallback(
    (tabId: string) => {
      dispatch({ type: 'TOGGLE_TAB_LOCK', payload: { tabId } });
    },
    [dispatch]
  );

  const setIcon = useCallback(
    (tabId: string, icon?: string) => {
      dispatch({ type: 'SET_TAB_ICON', payload: { tabId, icon } });
    },
    [dispatch]
  );

  const setStyle = useCallback(
    (tabId: string, style?: string) => {
      dispatch({ type: 'SET_TAB_STYLE', payload: { tabId, style } });
    },
    [dispatch]
  );

  return {
    panelTabs,
    canAddTab: panelTabs.length < maxTabs,
    createTab,
    closeTab,
    duplicateTab,
    moveTab,
    renameTab,
    toggleLock,
    setIcon,
    setStyle,
  };
}

/**
 * Hook for accessing drag-and-drop state for tabs.
 * Uses @dnd-kit context to provide current drag information.
 *
 * @returns Object with drag state: isDragging, activeTab, target info
 *
 * @example
 * ```tsx
 * function DropIndicator() {
 *   const { isDragging, overPanelId } = useTabDrag();
 *   if (!isDragging) return null;
 *   return <div className={overPanelId ? 'highlight' : ''} />;
 * }
 * ```
 */
export function useTabDrag() {
  const { active, over } = useDndContext();
  const { state } = usePrism();

  const activeTabId = active?.id ? String(active.id) : null;
  const activeTab = activeTabId ? findTabById(state.tabs, activeTabId) : null;

  const overTabId = over?.id ? String(over.id) : null;
  const isOverPanel = overTabId?.startsWith('panel-drop-') ?? false;
  const overPanelId =
    isOverPanel && overTabId
      ? overTabId.replace('panel-drop-', '')
      : overTabId
        ? (findTabById(state.tabs, overTabId)?.panelId ?? null)
        : null;

  return {
    isDragging: !!activeTab,
    activeTab,
    activeTabId,
    overTabId,
    overPanelId,
    isOverPanel,
  };
}
