import { useCallback, useMemo } from 'react';
import type { PanelId, Tab } from '@types';
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
  clearPersistedWorkspace,
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
  const { componentId, persistenceType } = useConfig();

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
    clearPersistedWorkspace(componentId, persistenceType);
  }, [componentId, persistenceType]);

  // Modal controls - accept Tab or tabId
  const openInfoModalFn = useCallback(
    (tabOrId: Tab | string) => {
      const tabId = typeof tabOrId === 'string' ? tabOrId : tabOrId.id;
      dispatch(openInfoModal({ tabId }));
    },
    [dispatch]
  );
  const closeInfoModalFn = useCallback(() => {
    dispatch(closeInfoModal());
  }, [dispatch]);
  const openHelpModalFn = useCallback(() => {
    dispatch(openHelpModal());
  }, [dispatch]);
  const closeHelpModalFn = useCallback(() => {
    dispatch(closeHelpModal());
  }, [dispatch]);
  const openSetIconModalFn = useCallback(
    (tabOrId: Tab | string) => {
      const tabId = typeof tabOrId === 'string' ? tabOrId : tabOrId.id;
      dispatch(openSetIconModal({ tabId }));
    },
    [dispatch]
  );
  const closeSetIconModalFn = useCallback(() => {
    dispatch(closeSetIconModal());
  }, [dispatch]);

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
