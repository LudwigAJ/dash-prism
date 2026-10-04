// src/ts/store/selectors.ts
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './index';
import { getLeafPanelIds } from '@utils/panels';

// =============================================================================
// Workspace Selectors (access .present for redux-undo wrapped state)
// =============================================================================

/** Accesses the present workspace state (unwraps redux-undo) */
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

/** Checks if undo is available (has past states) */
export const selectCanUndo = (state: RootState) => state.workspace.past.length > 0;

/** Checks if redo is available (has future states) */
export const selectCanRedo = (state: RootState) => state.workspace.future.length > 0;

/** Gets the number of undo steps available */
export const selectUndoCount = (state: RootState) => state.workspace.past.length;

/** Gets the number of redo steps available */
export const selectRedoCount = (state: RootState) => state.workspace.future.length;

// =============================================================================
// UI Selectors
// =============================================================================

export const selectSearchBarModes = (state: RootState) => state.ui.searchBarModes;
export const selectRenamingTabId = (state: RootState) => state.ui.renamingTabId;
export const selectLayoutSelectionRequest = (state: RootState) => state.ui.layoutSelectionRequest;
export const selectSearchFocusPanelId = (state: RootState) => state.ui.searchFocusPanelId;
export const selectInfoModalTabId = (state: RootState) => state.ui.infoModalTabId;
export const selectHelpModalOpen = (state: RootState) => state.ui.helpModalOpen;
export const selectSetIconModalTabId = (state: RootState) => state.ui.setIconModalTabId;
export const selectLoadNotice = (state: RootState) => state.ui.loadNotice;

// =============================================================================
// Derived Selectors (memoized)
// =============================================================================

export const selectTabCount = createSelector(selectTabs, (tabs) => tabs.length);

/**
 * Checks if a new tab can be added based on maxTabs limit.
 * This is a utility function (not a pure selector) because maxTabs comes from config.
 *
 * @param tabCount - Current number of tabs
 * @param maxTabs - Maximum tabs allowed (0 or negative means unlimited)
 * @returns true if a new tab can be added
 */
export function canAddTab(tabCount: number, maxTabs: number): boolean {
  return maxTabs < 1 || tabCount < maxTabs;
}

/**
 * Checks if a panel can be added based on the maxPanels limit.
 *
 * @param panelCount - Current number of leaf panels
 * @param maxPanels - Maximum panels allowed (0 or negative means unlimited)
 * @returns true if a new panel can be added
 */
export function canAddPanel(panelCount: number, maxPanels: number): boolean {
  return maxPanels < 1 || panelCount < maxPanels;
}

export const selectLeafPanelIds = createSelector(selectPanel, getLeafPanelIds);

export const selectPanelCount = createSelector(
  selectLeafPanelIds,
  (leafPanels) => leafPanels.length
);

/** True while the workspace has one tab in one panel, so no drag-and-drop operation can apply. */
export const selectIsSingleTabMode = createSelector(
  selectTabCount,
  selectPanelCount,
  (tabCount, panelCount) => tabCount === 1 && panelCount === 1
);

// Note: selectCanUndo is defined above in Redux-Undo History Selectors
// It uses state.workspace.past.length > 0 (redux-undo approach)

/**
 * Selects workspace snapshot for Dash sync
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
