import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LayoutId, PanelId, TabId } from '@types';
import type { UiState, SearchBarMode } from './types';
import { removeTab } from './workspaceSlice';

/** Holds the ui state of a new store: no modal, no request and no search-bar mode. */
export const initialUiState: UiState = {
  searchBarModes: {},
  renamingTabId: null,
  layoutSelectionRequest: null,
  searchFocusPanelId: null,
  infoModalTabId: null,
  helpModalOpen: false,
  setIconModalTabId: null,
  loadNotice: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUiState,
  reducers: {
    setSearchBarMode(state, action: PayloadAction<{ panelId: PanelId; mode: SearchBarMode }>) {
      state.searchBarModes[action.payload.panelId] = action.payload.mode;
    },

    /**
     * Drops search-bar modes for panels that no longer exist. dashSyncMiddleware dispatches it
     * after any workspace change, so every collapse is covered: removeTab, moveTab, splitPanel,
     * reconcileWithServer and the rehydration.
     */
    pruneSearchBarModes(state, action: PayloadAction<{ leafPanelIds: PanelId[] }>) {
      const keep = new Set<string>(action.payload.leafPanelIds);
      for (const panelId of Object.keys(state.searchBarModes)) {
        if (!keep.has(panelId)) delete state.searchBarModes[panelId];
      }
    },

    startRenameTab(state, action: PayloadAction<{ tabId: TabId }>) {
      state.renamingTabId = action.payload.tabId;
    },

    clearRenameTab(state) {
      state.renamingTabId = null;
    },

    requestLayoutSelection(state, action: PayloadAction<{ tabId: TabId; layoutId: LayoutId }>) {
      state.layoutSelectionRequest = action.payload;
    },

    clearLayoutSelectionRequest(state) {
      state.layoutSelectionRequest = null;
    },

    requestSearchFocus(state, action: PayloadAction<{ panelId: PanelId }>) {
      state.searchFocusPanelId = action.payload.panelId;
    },

    clearSearchFocusRequest(state) {
      state.searchFocusPanelId = null;
    },

    openInfoModal(state, action: PayloadAction<{ tabId: TabId }>) {
      state.infoModalTabId = action.payload.tabId;
    },

    setLoadNotice(state, action: PayloadAction<{ closedTabs: number }>) {
      state.loadNotice = action.payload;
    },

    clearLoadNotice(state) {
      state.loadNotice = null;
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
      if (state.layoutSelectionRequest?.tabId === tabId) state.layoutSelectionRequest = null;
      if (state.infoModalTabId === tabId) state.infoModalTabId = null;
      if (state.setIconModalTabId === tabId) state.setIconModalTabId = null;
    });
  },
});

export const {
  setSearchBarMode,
  pruneSearchBarModes,
  startRenameTab,
  clearRenameTab,
  requestLayoutSelection,
  clearLayoutSelectionRequest,
  requestSearchFocus,
  clearSearchFocusRequest,
  openInfoModal,
  closeInfoModal,
  openHelpModal,
  closeHelpModal,
  openSetIconModal,
  closeSetIconModal,
  setLoadNotice,
  clearLoadNotice,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;
