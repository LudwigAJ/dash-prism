// src/ts/store/selectors.ts
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './index';
import { getLeafPanelIds } from '@utils/panels';

// Workspace Selectors (access .present for redux-undo wrapped state)

export const selectTabs = (state: RootState) => state.workspace.present.tabs;
export const selectPanel = (state: RootState) => state.workspace.present.panel;
export const selectPanelTabs = (state: RootState) => state.workspace.present.panelTabs;
export const selectActiveTabIds = (state: RootState) => state.workspace.present.activeTabIds;
export const selectActivePanelId = (state: RootState) => state.workspace.present.activePanelId;
export const selectFavoriteLayouts = (state: RootState) => state.workspace.present.favoriteLayouts;
export const selectSearchBarsHidden = (state: RootState) =>
  state.workspace.present.searchBarsHidden;

// Redux-Undo History Selectors

/** Checks if undo is available (has past states) */
export const selectCanUndo = (state: RootState) => state.workspace.past.length > 0;

// UI Selectors

export const selectSearchBarModes = (state: RootState) => state.ui.searchBarModes;
export const selectRenamingTabId = (state: RootState) => state.ui.renamingTabId;
export const selectLayoutSelectionRequest = (state: RootState) => state.ui.layoutSelectionRequest;
export const selectSearchFocusPanelId = (state: RootState) => state.ui.searchFocusPanelId;
export const selectInfoModalTabId = (state: RootState) => state.ui.infoModalTabId;
export const selectHelpModalOpen = (state: RootState) => state.ui.helpModalOpen;
export const selectSetIconModalTabId = (state: RootState) => state.ui.setIconModalTabId;
export const selectLoadNotice = (state: RootState) => state.ui.loadNotice;

// Derived Selectors (memoized)

export const selectTabCount = createSelector(selectTabs, (tabs) => tabs.length);

const selectLeafPanelIds = createSelector(selectPanel, getLeafPanelIds);

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
