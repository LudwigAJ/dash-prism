// src/ts/store/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { PanelId, TabId } from '@types';
import type { UiState, SearchBarMode } from './types';
import { removeTab } from './workspaceSlice';

export const initialUiState: UiState = {
  searchBarModes: {},
  renamingTabId: null,
  infoModalTabId: null,
  helpModalOpen: false,
  setIconModalTabId: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    setSearchBarMode(state, action: PayloadAction<{ panelId: PanelId; mode: SearchBarMode }>) {
      state.searchBarModes[action.payload.panelId] = action.payload.mode;
    },

    clearSearchBarMode(state, action: PayloadAction<{ panelId: PanelId }>) {
      delete state.searchBarModes[action.payload.panelId];
    },

    startRenameTab(state, action: PayloadAction<{ tabId: TabId }>) {
      state.renamingTabId = action.payload.tabId;
    },

    clearRenameTab(state) {
      state.renamingTabId = null;
    },

    openInfoModal(state, action: PayloadAction<{ tabId: TabId }>) {
      state.infoModalTabId = action.payload.tabId;
    },

    closeInfoModal(state) {
      state.infoModalTabId = null;
    },

    openHelpModal(state) {
      state.helpModalOpen = true;
    },

    closeHelpModal(state) {
      state.helpModalOpen = false;
    },

    openSetIconModal(state, action: PayloadAction<{ tabId: TabId }>) {
      state.setIconModalTabId = action.payload.tabId;
    },

    closeSetIconModal(state) {
      state.setIconModalTabId = null;
    },
  },

  extraReducers: (builder) => {
    // Clean up stale tab references when a tab is removed from workspaceSlice.
    // Without this, modals/rename state could reference a deleted tab.
    builder.addCase(removeTab, (state, action) => {
      const { tabId } = action.payload;
      if (state.renamingTabId === tabId) state.renamingTabId = null;
      if (state.infoModalTabId === tabId) state.infoModalTabId = null;
      if (state.setIconModalTabId === tabId) state.setIconModalTabId = null;
    });
  },
});

export const {
  setSearchBarMode,
  clearSearchBarMode,
  startRenameTab,
  clearRenameTab,
  openInfoModal,
  closeInfoModal,
  openHelpModal,
  closeHelpModal,
  openSetIconModal,
  closeSetIconModal,
} = uiSlice.actions;

export default uiSlice.reducer;
