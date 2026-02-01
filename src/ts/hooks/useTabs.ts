import { useCallback } from 'react';
import { useDndContext } from '@dnd-kit/core';
import { useConfig } from '../context/ConfigContext';
import { findTabById, getTabsByPanelId } from '@utils/tabs';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  addTab,
  removeTab,
  duplicateTab,
  moveTab,
  renameTab,
  toggleTabLock,
  setTabIcon,
  setTabStyle,
} from '@store';

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
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const { maxTabs } = useConfig();

  const panelTabs = getTabsByPanelId(tabs, panelId);
  const totalTabCount = tabs.length;

  const createTab = useCallback(
    (name = 'New Tab', layoutId?: string) => {
      dispatch(addTab({ panelId, name, layoutId }));
    },
    [panelId, dispatch]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      dispatch(removeTab({ tabId }));
    },
    [dispatch]
  );

  const duplicateTabFn = useCallback(
    (tabId: string) => {
      dispatch(duplicateTab({ tabId }));
    },
    [dispatch]
  );

  const moveTabFn = useCallback(
    (tabId: string, targetPanelId: string) => {
      if (targetPanelId === panelId) return false;
      dispatch(moveTab({ tabId, targetPanelId }));
      return true;
    },
    [panelId, dispatch]
  );

  const renameTabFn = useCallback(
    (tabId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      dispatch(renameTab({ tabId, name: trimmed }));
      return true;
    },
    [dispatch]
  );

  const toggleLock = useCallback(
    (tabId: string) => {
      dispatch(toggleTabLock({ tabId }));
    },
    [dispatch]
  );

  const setIcon = useCallback(
    (tabId: string, icon?: string) => {
      dispatch(setTabIcon({ tabId, icon }));
    },
    [dispatch]
  );

  const setStyle = useCallback(
    (tabId: string, style?: string) => {
      dispatch(setTabStyle({ tabId, style }));
    },
    [dispatch]
  );

  return {
    panelTabs,
    canAddTab: maxTabs < 1 || totalTabCount < maxTabs,
    createTab,
    closeTab,
    duplicateTab: duplicateTabFn,
    moveTab: moveTabFn,
    renameTab: renameTabFn,
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
  const tabs = useAppSelector(selectTabs);

  const activeTabId = active?.id ? String(active.id) : null;
  const activeTab = activeTabId ? findTabById(tabs, activeTabId) : null;

  const overTabId = over?.id ? String(over.id) : null;
  const isOverPanel = overTabId?.startsWith('panel-drop-') ?? false;
  const overPanelId =
    isOverPanel && overTabId
      ? overTabId.replace('panel-drop-', '')
      : overTabId
        ? (findTabById(tabs, overTabId)?.panelId ?? null)
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
