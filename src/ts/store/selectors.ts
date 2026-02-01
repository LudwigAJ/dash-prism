// src/ts/store/selectors.ts
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './index';
import type { PanelId, TabId } from '@types';
import { getLeafPanelIds, isLastPanel } from '@utils/panels';
import { findTabById, getTabsByPanelId, getActiveTabForPanel } from '@utils/tabs';

// =============================================================================
// Workspace Selectors (access .present for redux-undo wrapped state)
// =============================================================================

/** Access the present workspace state (unwraps redux-undo) */
export const selectWorkspacePresent = (state: RootState) => state.workspace.present;

export const selectTabs = (state: RootState) => state.workspace.present.tabs;
export const selectPanel = (state: RootState) => state.workspace.present.panel;
export const selectPanelTabs = (state: RootState) => state.workspace.present.panelTabs;
export const selectActiveTabIds = (state: RootState) => state.workspace.present.activeTabIds;
export const selectActivePanelId = (state: RootState) => state.workspace.present.activePanelId;
export const selectFavoriteLayouts = (state: RootState) => state.workspace.present.favoriteLayouts;
export const selectSearchBarsHidden = (state: RootState) =>
  state.workspace.present.searchBarsHidden;

// Note: selectTheme is NOT here - theme comes from ConfigContext (Dash props)
// Note: selectUndoStack is NOT here - undo state is managed by redux-undo (see selectors below)

// =============================================================================
// Redux-Undo History Selectors
// =============================================================================

/** Check if undo is available (has past states) */
export const selectCanUndo = (state: RootState) => state.workspace.past.length > 0;

/** Check if redo is available (has future states) */
export const selectCanRedo = (state: RootState) => state.workspace.future.length > 0;

/** Get the number of undo steps available */
export const selectUndoCount = (state: RootState) => state.workspace.past.length;

/** Get the number of redo steps available */
export const selectRedoCount = (state: RootState) => state.workspace.future.length;

// =============================================================================
// UI Selectors
// =============================================================================

export const selectSearchBarModes = (state: RootState) => state.ui.searchBarModes;
export const selectRenamingTabId = (state: RootState) => state.ui.renamingTabId;
export const selectInfoModalTabId = (state: RootState) => state.ui.infoModalTabId;
export const selectHelpModalOpen = (state: RootState) => state.ui.helpModalOpen;
export const selectSetIconModalTabId = (state: RootState) => state.ui.setIconModalTabId;

// =============================================================================
// Derived Selectors (memoized)
// =============================================================================

export const selectTabCount = createSelector(selectTabs, (tabs) => tabs.length);

export const selectLeafPanelIds = createSelector(selectPanel, getLeafPanelIds);

export const selectPanelCount = createSelector(
  selectLeafPanelIds,
  (leafPanels) => leafPanels.length
);

// Note: selectCanUndo is defined above in Redux-Undo History Selectors
// It uses state.workspace.past.length > 0 (redux-undo approach)

/**
 * Factory selector for getting tabs in a specific panel
 */
export const makeSelectPanelTabs = (panelId: PanelId) =>
  createSelector(selectTabs, (tabs) => getTabsByPanelId(tabs, panelId));

/**
 * Factory selector for getting active tab in a panel
 */
export const makeSelectActiveTab = (panelId: PanelId) =>
  createSelector(
    selectTabs,
    selectActiveTabIds,
    (tabs, activeTabIds) => getActiveTabForPanel(tabs, activeTabIds, panelId) ?? null
  );

/**
 * Factory selector for search bar mode
 */
export const makeSelectSearchBarMode = (panelId: PanelId) =>
  createSelector(selectSearchBarModes, (modes) => modes[panelId] ?? 'display');

/**
 * Check if a tab can be closed
 */
export const makeSelectCanCloseTab = (panelId: PanelId, tabId: TabId) =>
  createSelector(selectTabs, selectPanel, (tabs, panel) => {
    const tab = findTabById(tabs, tabId);
    if (!tab) return false;
    if (tab.locked) return false;
    if (!isLastPanel(panel, tab.panelId)) return true;
    const panelTabs = getTabsByPanelId(tabs, panelId);
    return panelTabs.length > 1;
  });

/**
 * Select workspace snapshot for Dash sync
 */
export const selectWorkspaceSnapshot = createSelector(
  selectTabs,
  selectPanel,
  selectPanelTabs,
  selectActiveTabIds,
  selectActivePanelId,
  selectFavoriteLayouts,
  selectSearchBarsHidden,
  (tabs, panel, panelTabs, activeTabIds, activePanelId, favoriteLayouts, searchBarsHidden) => ({
    tabs,
    panel,
    panelTabs,
    activeTabIds,
    activePanelId,
    favoriteLayouts,
    searchBarsHidden,
  })
);
