import { useCallback, useMemo } from 'react';
import { getLeafPanelIds, isLastPanel } from '@utils/panels';
import type { PanelId, TabId, Tab } from '@types';
import { findTabById, getActiveTabForPanel, getTabsByPanelId } from '@utils/tabs';
import { usePortal } from '@context/PortalContext';
import { useConfig } from '@context/ConfigContext';
import {
  useAppSelector,
  useAppDispatch,
  selectTabs,
  selectPanel,
  selectPanelTabs,
  selectActiveTabIds,
  selectActivePanelId,
  selectFavoriteLayouts,
  selectSearchBarsHidden,
  selectRenamingTabId,
  selectInfoModalTabId,
  selectHelpModalOpen,
  selectSetIconModalTabId,
  selectCanUndo,
  getWorkspaceStorageKey,
  // UI actions for modals
  openInfoModal,
  closeInfoModal,
  openHelpModal,
  closeHelpModal,
  openSetIconModal,
  closeSetIconModal,
} from '@store';

// =============================================================================
// Hooks
// =============================================================================

/**
 * Primary hook for accessing Prism state.
 * Now uses Redux internally. For dispatching actions, use useAppDispatch
 * and import action creators directly from @store.
 *
 * @example
 * ```tsx
 * import { usePrism } from '@hooks/usePrism';
 * import { useAppDispatch, addTab, removeTab } from '@store';
 *
 * function MyComponent() {
 *   const { state, infoModalTab, openInfoModal } = usePrism();
 *   const dispatch = useAppDispatch();
 *
 *   const handleAddTab = () => dispatch(addTab({ panelId: 'main' }));
 *   const handleRemoveTab = (tabId: string) => dispatch(removeTab({ tabId }));
 * }
 * ```
 */
export function usePrism() {
  const dispatch = useAppDispatch();
  const { getPortalNode } = usePortal();
  const { componentId } = useConfig();

  // Select all state from Redux
  const tabs = useAppSelector(selectTabs);
  const panel = useAppSelector(selectPanel);
  const panelTabs = useAppSelector(selectPanelTabs);
  const activeTabIds = useAppSelector(selectActiveTabIds);
  const activePanelId = useAppSelector(selectActivePanelId);
  const favoriteLayouts = useAppSelector(selectFavoriteLayouts);
  const searchBarsHidden = useAppSelector(selectSearchBarsHidden);
  const renamingTabId = useAppSelector(selectRenamingTabId);
  const infoModalTabId = useAppSelector(selectInfoModalTabId);
  const helpModalOpen = useAppSelector(selectHelpModalOpen);
  const setIconModalTabId = useAppSelector(selectSetIconModalTabId);
  const canUndo = useAppSelector(selectCanUndo);

  // Derive modal tabs from IDs for backward compatibility
  const infoModalTab = useMemo(
    () => (infoModalTabId ? (findTabById(tabs, infoModalTabId) ?? null) : null),
    [tabs, infoModalTabId]
  );
  const setIconModalTab = useMemo(
    () => (setIconModalTabId ? (findTabById(tabs, setIconModalTabId) ?? null) : null),
    [tabs, setIconModalTabId]
  );

  // Construct state object for convenience
  const state = useMemo(
    () => ({
      tabs,
      panel,
      panelTabs,
      activeTabIds,
      activePanelId,
      favoriteLayouts,
      searchBarsHidden,
      renamingTabId,
      // Undo availability (redux-undo manages history)
      undoStack: canUndo ? [{}] : [],
    }),
    [
      tabs,
      panel,
      panelTabs,
      activeTabIds,
      activePanelId,
      favoriteLayouts,
      searchBarsHidden,
      renamingTabId,
      canUndo,
    ]
  );

  // Clear persisted state helper (redux-persist handles persistence)
  const clearPersistedState = useCallback(() => {
    const key = getWorkspaceStorageKey(componentId);
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // Storage access may fail in some contexts
    }
  }, [componentId]);

  // Modal controls - accept Tab or tabId
  const openInfoModalFn = useCallback(
    (tabOrId: Tab | string) => {
      const tabId = typeof tabOrId === 'string' ? tabOrId : tabOrId.id;
      dispatch(openInfoModal({ tabId }));
    },
    [dispatch]
  );
  const closeInfoModalFn = useCallback(() => dispatch(closeInfoModal()), [dispatch]);
  const openHelpModalFn = useCallback(() => dispatch(openHelpModal()), [dispatch]);
  const closeHelpModalFn = useCallback(() => dispatch(closeHelpModal()), [dispatch]);
  const openSetIconModalFn = useCallback(
    (tabOrId: Tab | string) => {
      const tabId = typeof tabOrId === 'string' ? tabOrId : tabOrId.id;
      dispatch(openSetIconModal({ tabId }));
    },
    [dispatch]
  );
  const closeSetIconModalFn = useCallback(() => dispatch(closeSetIconModal()), [dispatch]);

  return {
    state,
    clearPersistedState,
    // Portal management
    getPortalNode,
    // Modal state (Tab objects for component compatibility)
    infoModalTab,
    infoModalTabId,
    helpModalOpen,
    setIconModalTab,
    setIconModalTabId,
    // Modal controls
    openInfoModal: openInfoModalFn,
    closeInfoModal: closeInfoModalFn,
    openHelpModal: openHelpModalFn,
    closeHelpModal: closeHelpModalFn,
    openSetIconModal: openSetIconModalFn,
    closeSetIconModal: closeSetIconModalFn,
  };
}

/**
 * Returns all tabs in the workspace.
 * Convenience selector for `state.tabs`.
 */
export function useTabs() {
  return useAppSelector(selectTabs);
}

/**
 * Returns the active tab for a specific panel.
 *
 * @param panelId - The panel ID to get the active tab for
 * @returns The active Tab object, or null if no active tab
 */
export function useActiveTab(panelId: PanelId) {
  const tabs = useAppSelector(selectTabs);
  const activeTabIds = useAppSelector(selectActiveTabIds);
  return getActiveTabForPanel(tabs, activeTabIds, panelId) ?? null;
}

/**
 * Returns all tabs belonging to a specific panel.
 *
 * @param panelId - The panel ID to get tabs for
 * @returns Array of Tab objects in the panel
 */
export function usePanelTabs(panelId: PanelId) {
  const tabs = useAppSelector(selectTabs);
  return getTabsByPanelId(tabs, panelId);
}

/**
 * Workspace-level utilities for checking constraints and getting overview info.
 *
 * @returns Object with panel info, helper functions, and counts
 *
 * @example
 * ```tsx
 * function StatusInfo() {
 *   const { tabCount, panelCount, canCloseTab } = useWorkspace();
 *   return <span>{tabCount} tabs in {panelCount} panels</span>;
 * }
 * ```
 */
export function useWorkspace() {
  const tabs = useAppSelector(selectTabs);
  const panel = useAppSelector(selectPanel);

  const leafPanels = getLeafPanelIds(panel);
  const isOnlyPanel = (panelId: PanelId) => leafPanels.length === 1 && leafPanels[0] === panelId;

  // Check if closing a tab would leave the workspace empty
  const canCloseTab = (panelId: PanelId, tabId: TabId) => {
    const tab = findTabById(tabs, tabId);
    if (!tab) return false;
    if (tab.locked) return false;

    // If this is not the last panel, we can always close
    if (!isLastPanel(panel, tab.panelId)) return true;

    // In the last panel, we can close if there's more than 1 tab
    const panelTabsList = getTabsByPanelId(tabs, panelId);
    return panelTabsList.length > 1;
  };

  return {
    panel,
    leafPanels,
    isOnlyPanel,
    canCloseTab,
    tabCount: tabs?.length ?? 0,
    panelCount: leafPanels.length,
  };
}
