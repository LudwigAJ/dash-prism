// src/ts/store/selectors.ts
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './index';
import { getLeafPanelIds } from '@utils/panels';
import { findTabById } from '@utils/tabs';

// Workspace selectors. Each one reads the field of the same name of the present workspace.

export const selectTabs = (state: RootState) => state.workspace.present.tabs;
export const selectPanel = (state: RootState) => state.workspace.present.panel;
export const selectPanelTabs = (state: RootState) => state.workspace.present.panelTabs;
export const selectActiveTabIds = (state: RootState) => state.workspace.present.activeTabIds;
export const selectActivePanelId = (state: RootState) => state.workspace.present.activePanelId;
export const selectFavoriteLayouts = (state: RootState) => state.workspace.present.favoriteLayouts;
export const selectSearchBarsHidden = (state: RootState) =>
  state.workspace.present.searchBarsHidden;

// Undo history selectors

/** Tells if the undo history has a step to undo. */
export const selectCanUndo = (state: RootState) => state.workspace.past.length > 0;

// Ui selectors. Each one reads the field of the same name of the ui state.

export const selectSearchBarModes = (state: RootState) => state.ui.searchBarModes;
export const selectRenamingTabId = (state: RootState) => state.ui.renamingTabId;
export const selectLayoutSelectionRequest = (state: RootState) => state.ui.layoutSelectionRequest;
export const selectSearchFocusPanelId = (state: RootState) => state.ui.searchFocusPanelId;
export const selectInfoModalTabId = (state: RootState) => state.ui.infoModalTabId;
export const selectHelpModalOpen = (state: RootState) => state.ui.helpModalOpen;
export const selectSetIconModalTabId = (state: RootState) => state.ui.setIconModalTabId;
export const selectLoadNotice = (state: RootState) => state.ui.loadNotice;

// Derived selectors (memoized)

/** Gives the number of tabs in the workspace. */
export const selectTabCount = createSelector(selectTabs, (tabs) => tabs.length);

/** Gives the tab that the info modal shows, or null when the modal is closed. */
export const selectInfoModalTab = createSelector(selectTabs, selectInfoModalTabId, (tabs, tabId) =>
  tabId ? (findTabById(tabs, tabId) ?? null) : null
);

/** Gives the tab that the icon modal edits, or null when the modal is closed. */
export const selectSetIconModalTab = createSelector(
  selectTabs,
  selectSetIconModalTabId,
  (tabs, tabId) => (tabId ? (findTabById(tabs, tabId) ?? null) : null)
);

const selectLeafPanelIds = createSelector(selectPanel, getLeafPanelIds);

/** Gives the number of leaf panels, the panels that hold tabs. */
export const selectPanelCount = createSelector(
  selectLeafPanelIds,
  (leafPanels) => leafPanels.length
);

/** Tells if the workspace has one tab in one panel, so no drag-and-drop operation can apply. */
export const selectIsSingleTabMode = createSelector(
  selectTabCount,
  selectPanelCount,
  (tabCount, panelCount) => tabCount === 1 && panelCount === 1
);

/** Gives the fields of the workspace that Dash sees, as the `readWorkspace` prop sends them. */
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
