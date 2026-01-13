import { useContext } from 'react';
import { getLeafPanelIds, isLastPanel } from '@utils/panels';
import { PrismContext } from '@context/PrismContext';
import type { Panel, PanelId, TabId } from '@types';
import { findTabById, getActiveTabForPanel, getTabsByPanelId } from '@utils/tabs';

// =============================================================================
// Hooks
// =============================================================================

/**
 * Primary hook for accessing Prism context.
 * Provides access to state, dispatch, and modal controls.
 *
 * @throws Error if used outside of PrismProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, dispatch } = usePrism();
 *   const handleAddTab = () => dispatch({ type: 'ADD_TAB', payload: { panelId: 'main' } });
 * }
 * ```
 */
export function usePrism() {
  const context = useContext(PrismContext);
  if (!context) {
    throw new Error('usePrism must be used within PrismProvider');
  }
  return context;
}

/**
 * Returns all tabs in the workspace.
 * Convenience selector for `state.tabs`.
 */
export function useTabs() {
  const { state } = usePrism();
  return state.tabs;
}

/**
 * Returns the active tab for a specific panel.
 *
 * @param panelId - The panel ID to get the active tab for
 * @returns The active Tab object, or null if no active tab
 */
export function useActiveTab(panelId: string) {
  const { state } = usePrism();
  return getActiveTabForPanel(state.tabs, state.activeTabIds, panelId) ?? null;
}

/**
 * Returns all tabs belonging to a specific panel.
 *
 * @param panelId - The panel ID to get tabs for
 * @returns Array of Tab objects in the panel
 */
export function usePanelTabs(panelId: string) {
  const { state } = usePrism();
  return getTabsByPanelId(state.tabs, panelId);
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
  const { state } = usePrism();

  const leafPanels = getLeafPanelIds(state.panel);
  const isOnlyPanel = (panelId: string) => leafPanels.length === 1 && leafPanels[0] === panelId;

  // Check if closing a tab would leave the workspace empty
  const canCloseTab = (panelId: PanelId, tabId: TabId) => {
    const tab = findTabById(state.tabs, tabId);
    if (!tab) return false;
    if (tab.locked) return false;

    // If this is not the last panel, we can always close
    if (!isLastPanel(state.panel, tab.panelId)) return true;

    // In the last panel, we can close if there's more than 1 tab
    const panelTabs = getTabsByPanelId(state.tabs, panelId);
    return panelTabs.length > 1;
  };

  return {
    panel: state.panel,
    leafPanels,
    isOnlyPanel,
    canCloseTab,
    tabCount: state.tabs.length,
    panelCount: leafPanels.length,
  };
}
