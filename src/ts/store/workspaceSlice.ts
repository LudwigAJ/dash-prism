// src/ts/store/workspaceSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Tab, Panel, PanelId, TabId, LayoutId, PanelDirection } from '@types';
import type { WorkspaceState, ThunkExtra } from './types';
import { generateShortId } from '@utils/uuid';
import { findTabById, findTabIndex } from '@utils/tabs';
import {
  getLeafPanelIds,
  findPanelById,
  updatePanelInTree,
  removePanelFromTree,
  isLeafPanel,
  splitPanel,
  collapsePanel,
} from '@utils/panels';
import { notifyUser } from '@utils/notifications';

// =============================================================================
// Constants
// =============================================================================

export const MAX_TAB_NAME_LENGTH = 24;
export const MAX_LEAF_PANELS = 20;

// =============================================================================
// Initial State
// =============================================================================

const initialPanelId: PanelId = generateShortId();
const initialTabId: TabId = generateShortId();

export const initialWorkspaceState: WorkspaceState = {
  tabs: [
    {
      id: initialTabId,
      name: 'New Tab',
      panelId: initialPanelId,
      layoutId: undefined,
      createdAt: Date.now(),
      mountKey: generateShortId(),
    },
  ],
  panel: {
    id: initialPanelId,
    order: 0,
    direction: 'horizontal',
    children: [],
    size: '100%',
  },
  panelTabs: { [initialPanelId]: [initialTabId] },
  activeTabIds: { [initialPanelId]: initialTabId },
  activePanelId: initialPanelId,
  favoriteLayouts: [],
  searchBarsHidden: false,
};

// =============================================================================
// Async Thunks (for maxTabs validation)
// =============================================================================

type AddTabPayload = {
  panelId: PanelId;
  name?: string;
  layoutId?: string;
  params?: Record<string, string>;
  option?: string;
};

/**
 * Async thunk for adding a tab with maxTabs validation.
 * Uses thunk extra argument to access config.
 */
export const addTab = createAsyncThunk<
  Tab, // Return type
  AddTabPayload, // Argument type
  { state: { workspace: { present: WorkspaceState } }; extra: ThunkExtra; rejectValue: string }
>('workspace/addTab', async (payload, { getState, extra, rejectWithValue }) => {
  const { tabs } = getState().workspace.present;

  // Validate maxTabs limit
  if (extra.maxTabs > 0 && tabs.length >= extra.maxTabs) {
    notifyUser(
      'warning',
      `Maximum tabs limit reached (${extra.maxTabs})`,
      `Cannot add tab: maximum of ${extra.maxTabs} tabs reached.`
    );
    return rejectWithValue(`Maximum tabs limit reached (${extra.maxTabs})`);
  }

  // Create the new tab
  const newTab: Tab = {
    id: generateShortId(),
    name: payload.name ?? 'New Tab',
    panelId: payload.panelId,
    layoutId: payload.layoutId,
    layoutParams: payload.params,
    layoutOption: payload.option,
    createdAt: Date.now(),
    mountKey: generateShortId(),
  };

  return newTab;
});

export const duplicateTab = createAsyncThunk<
  Tab,
  { tabId: TabId },
  { state: { workspace: { present: WorkspaceState } }; extra: ThunkExtra; rejectValue: string }
>('workspace/duplicateTab', async ({ tabId }, { getState, extra, rejectWithValue }) => {
  const { tabs } = getState().workspace.present;

  if (extra.maxTabs > 0 && tabs.length >= extra.maxTabs) {
    notifyUser(
      'warning',
      `Cannot duplicate: maximum tabs limit reached (${extra.maxTabs})`,
      `DUPLICATE_TAB blocked: workspace at maxTabs limit (${extra.maxTabs})`
    );
    return rejectWithValue(`Maximum tabs limit reached`);
  }

  const originalTab = findTabById(tabs, tabId);
  if (!originalTab) {
    return rejectWithValue('Tab not found');
  }

  const newTab: Tab = {
    ...originalTab,
    id: generateShortId(),
    name: `${originalTab.name} (copy)`,
    createdAt: Date.now(),
    locked: false,
    layoutParams: originalTab.layoutParams ? { ...originalTab.layoutParams } : undefined,
    mountKey: generateShortId(),
  };

  return newTab;
});

// =============================================================================
// Slice Definition
// =============================================================================

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: initialWorkspaceState,
  reducers: {
    // -------------------------------------------------------------------------
    // Tab Actions (synchronous)
    // -------------------------------------------------------------------------

    removeTab(state, action: PayloadAction<{ tabId: TabId }>) {
      const { tabId } = action.payload;
      const tabIndex = findTabIndex(state.tabs, tabId);
      if (tabIndex === -1) return;

      const tab = state.tabs[tabIndex];
      if (tab.locked) return;

      const panelId = tab.panelId;

      // Note: Undo is handled by redux-undo wrapping the entire slice.
      // When user dispatches undo(), the entire state reverts to before this action.

      // Remove from tabs array
      state.tabs.splice(tabIndex, 1);

      // Remove from panelTabs
      const idx = state.panelTabs[panelId]?.indexOf(tabId);
      if (idx !== undefined && idx !== -1) {
        state.panelTabs[panelId].splice(idx, 1);
      }

      // Update active tab
      if (state.activeTabIds[panelId] === tabId) {
        const remaining = state.panelTabs[panelId] ?? [];
        const lastTab = remaining[remaining.length - 1];
        if (lastTab) {
          state.activeTabIds[panelId] = lastTab;
        } else {
          delete state.activeTabIds[panelId];
        }
      }
    },

    selectTab(state, action: PayloadAction<{ tabId: TabId; panelId: PanelId }>) {
      const { tabId, panelId } = action.payload;
      state.activeTabIds[panelId] = tabId;
      state.activePanelId = panelId;
    },

    renameTab(state, action: PayloadAction<{ tabId: TabId; name: string }>) {
      const { tabId, name } = action.payload;
      const tab = findTabById(state.tabs, tabId);
      if (tab) {
        tab.name = name.length > MAX_TAB_NAME_LENGTH ? name.slice(0, MAX_TAB_NAME_LENGTH) : name;
      }
    },

    lockTab(state, action: PayloadAction<{ tabId: TabId }>) {
      const tab = findTabById(state.tabs, action.payload.tabId);
      if (tab) tab.locked = true;
    },

    unlockTab(state, action: PayloadAction<{ tabId: TabId }>) {
      const tab = findTabById(state.tabs, action.payload.tabId);
      if (tab) tab.locked = false;
    },

    toggleTabLock(state, action: PayloadAction<{ tabId: TabId }>) {
      const tab = findTabById(state.tabs, action.payload.tabId);
      if (tab) tab.locked = !tab.locked;
    },

    updateTabLayout(
      state,
      action: PayloadAction<{
        tabId: TabId;
        layoutId: LayoutId;
        name: string;
        params?: Record<string, string>;
        option?: string;
      }>
    ) {
      const { tabId, layoutId, name, params, option } = action.payload;
      const tab = findTabById(state.tabs, tabId);
      if (tab) {
        const layoutChanging = tab.layoutId !== undefined && tab.layoutId !== layoutId;
        tab.layoutId = layoutId;
        tab.name = name;
        tab.layoutParams = params;
        tab.layoutOption = option;
        if (layoutChanging) {
          tab.mountKey = generateShortId();
        }
      }
    },

    moveTab(
      state,
      action: PayloadAction<{ tabId: TabId; targetPanelId: PanelId; targetIndex?: number }>
    ) {
      const { tabId, targetPanelId, targetIndex } = action.payload;
      const tab = findTabById(state.tabs, tabId);
      if (!tab) return;

      const sourcePanelId = tab.panelId;
      if (sourcePanelId === targetPanelId) return;

      // Remove from source
      const sourceIdx = state.panelTabs[sourcePanelId]?.indexOf(tabId);
      if (sourceIdx !== undefined && sourceIdx !== -1) {
        state.panelTabs[sourcePanelId].splice(sourceIdx, 1);
      }

      // Add to target
      if (!state.panelTabs[targetPanelId]) state.panelTabs[targetPanelId] = [];
      if (targetIndex !== undefined && targetIndex >= 0) {
        const clampedIndex = Math.min(targetIndex, state.panelTabs[targetPanelId].length);
        state.panelTabs[targetPanelId].splice(clampedIndex, 0, tabId);
      } else {
        state.panelTabs[targetPanelId].push(tabId);
      }

      tab.panelId = targetPanelId;
      state.activeTabIds[targetPanelId] = tabId;
      state.activePanelId = targetPanelId;
    },

    reorderTab(
      state,
      action: PayloadAction<{ panelId: PanelId; fromIndex: number; toIndex: number }>
    ) {
      const { panelId, fromIndex, toIndex } = action.payload;
      const panelTabIds = state.panelTabs[panelId];
      if (!panelTabIds || fromIndex < 0 || fromIndex >= panelTabIds.length) return;

      const clampedToIndex = Math.max(0, Math.min(toIndex, panelTabIds.length - 1));
      const [movedId] = panelTabIds.splice(fromIndex, 1);
      panelTabIds.splice(clampedToIndex, 0, movedId);
    },

    setTabIcon(state, action: PayloadAction<{ tabId: TabId; icon?: string }>) {
      const tab = findTabById(state.tabs, action.payload.tabId);
      if (tab) tab.icon = action.payload.icon;
    },

    setTabStyle(state, action: PayloadAction<{ tabId: TabId; style?: string }>) {
      const tab = findTabById(state.tabs, action.payload.tabId);
      if (tab) tab.style = action.payload.style;
    },

    refreshTab(state, action: PayloadAction<{ tabId: TabId }>) {
      const tab = findTabById(state.tabs, action.payload.tabId);
      if (tab && tab.layoutId) {
        tab.mountKey = generateShortId();
      }
    },

    // -------------------------------------------------------------------------
    // Panel Actions
    // -------------------------------------------------------------------------

    setActivePanel(state, action: PayloadAction<{ panelId: PanelId }>) {
      state.activePanelId = action.payload.panelId;
    },

    resizePanel(state, action: PayloadAction<{ panelId: PanelId; size: string | number }>) {
      updatePanelInTree(state.panel, action.payload.panelId, (panel) => {
        panel.size = action.payload.size;
      });
    },

    pinPanel(state, action: PayloadAction<{ panelId: PanelId }>) {
      const panel = findPanelById(state.panel, action.payload.panelId);
      if (panel) panel.pinned = true;
    },

    unpinPanel(state, action: PayloadAction<{ panelId: PanelId }>) {
      const panel = findPanelById(state.panel, action.payload.panelId);
      if (panel) panel.pinned = false;
    },

    splitPanelAction(
      state,
      action: PayloadAction<{
        panelId: PanelId;
        direction: PanelDirection;
        tabId: TabId;
        position?: 'before' | 'after';
      }>
    ) {
      const { panelId, direction, tabId, position = 'after' } = action.payload;

      // Check if we've reached the maximum number of leaf panels
      const currentLeafCount = getLeafPanelIds(state.panel).length;
      if (currentLeafCount >= MAX_LEAF_PANELS) {
        notifyUser(
          'warning',
          `Cannot split: maximum of ${MAX_LEAF_PANELS} panels reached`,
          `Cannot split panel: maximum of ${MAX_LEAF_PANELS} panels reached.`
        );
        return;
      }

      const panelToSplit = findPanelById(state.panel, panelId);
      if (!panelToSplit) {
        notifyUser('error', 'Cannot split: panel not found');
        return;
      }

      // Verify it's a leaf panel
      if (!isLeafPanel(panelToSplit)) {
        notifyUser('error', 'Cannot split a non-leaf panel');
        return;
      }

      const tabToMove = findTabById(state.tabs, tabId);
      if (!tabToMove) return;

      const sourcePanelId = tabToMove.panelId;
      const sourcePanelTabs = state.panelTabs[sourcePanelId] ?? [];
      const isSamePanelSplit = sourcePanelId === panelId;

      // Block same-panel split if panel only has one tab
      if (isSamePanelSplit && sourcePanelTabs.length <= 1) return;

      // Perform the split operation
      const splitResult = splitPanel(state.panel, { panelId, direction, position });
      if (!splitResult.success || !splitResult.newPanelId) {
        notifyUser('error', `Cannot split: ${splitResult.error}`);
        return;
      }

      const { newPanelId } = splitResult;

      // Initialize new panel's state
      state.panelTabs[newPanelId] = [];

      // Move the tab to the new panel
      // Remove from source panelTabs
      const sourceIdx = state.panelTabs[sourcePanelId]?.indexOf(tabId);
      if (sourceIdx !== undefined && sourceIdx !== -1) {
        state.panelTabs[sourcePanelId].splice(sourceIdx, 1);
      }

      // Add to new panel
      state.panelTabs[newPanelId].push(tabId);
      tabToMove.panelId = newPanelId;

      // Update active states
      state.activeTabIds[newPanelId] = tabId;
      state.activePanelId = newPanelId;

      // Update active tab in original/source panel if needed
      if (state.activeTabIds[panelId] === tabId) {
        const remaining = state.panelTabs[panelId] ?? [];
        const lastTab = remaining[remaining.length - 1];
        if (lastTab) {
          state.activeTabIds[panelId] = lastTab;
        } else {
          delete state.activeTabIds[panelId];
        }
      }

      if (!isSamePanelSplit && state.activeTabIds[sourcePanelId] === tabId) {
        const remaining = state.panelTabs[sourcePanelId] ?? [];
        const lastTab = remaining[remaining.length - 1];
        if (lastTab) {
          state.activeTabIds[sourcePanelId] = lastTab;
        } else {
          delete state.activeTabIds[sourcePanelId];
        }
      }

      // Collapse source panel if empty (for cross-panel splits)
      if (!isSamePanelSplit) {
        const sourceEmpty = (state.panelTabs[sourcePanelId]?.length ?? 0) === 0;
        if (sourceEmpty) {
          const leafPanels = getLeafPanelIds(state.panel);
          const otherPanels = leafPanels.filter((id) => id !== sourcePanelId);
          if (otherPanels.length > 0) {
            removePanelFromTree(state.panel, sourcePanelId);
            delete state.activeTabIds[sourcePanelId];
            delete state.panelTabs[sourcePanelId];
          }
        }
      }
    },

    collapsePanelAction(state, action: PayloadAction<{ panelId: PanelId }>) {
      const { panelId } = action.payload;

      const leafPanels = getLeafPanelIds(state.panel).filter((id) => id !== panelId);
      if (leafPanels.length === 0) {
        notifyUser('warning', 'Cannot close the last panel');
        return;
      }

      // Verify panel exists
      if (!getLeafPanelIds(state.panel).includes(panelId)) {
        notifyUser('error', 'Cannot close panel: panel not found');
        return;
      }

      const targetPanelId = leafPanels[0];

      // Move all tabs to target panel
      const tabsToMove = [...(state.panelTabs[panelId] ?? [])];
      for (const tid of tabsToMove) {
        const tab = findTabById(state.tabs, tid);
        if (tab) {
          // Remove from source
          const idx = state.panelTabs[panelId]?.indexOf(tid);
          if (idx !== undefined && idx !== -1) {
            state.panelTabs[panelId].splice(idx, 1);
          }
          // Add to target
          if (!state.panelTabs[targetPanelId]) state.panelTabs[targetPanelId] = [];
          state.panelTabs[targetPanelId].push(tid);
          tab.panelId = targetPanelId;
        }
      }

      // Collapse the panel in the tree
      const collapseResult = collapsePanel(state.panel, panelId);
      if (!collapseResult.success) {
        notifyUser('error', `Failed to close panel: ${collapseResult.error}`);
        // Rollback: move tabs back
        for (const tid of tabsToMove) {
          const tab = findTabById(state.tabs, tid);
          if (tab) {
            const idx = state.panelTabs[targetPanelId]?.indexOf(tid);
            if (idx !== undefined && idx !== -1) {
              state.panelTabs[targetPanelId].splice(idx, 1);
            }
            if (!state.panelTabs[panelId]) state.panelTabs[panelId] = [];
            state.panelTabs[panelId].push(tid);
            tab.panelId = panelId;
          }
        }
        return;
      }

      // Clean up state
      delete state.activeTabIds[panelId];
      delete state.panelTabs[panelId];

      // Update active states
      if (tabsToMove.length > 0) {
        const hasActiveTab =
          state.activeTabIds[targetPanelId] &&
          state.panelTabs[targetPanelId]?.includes(state.activeTabIds[targetPanelId]);
        if (!hasActiveTab) {
          state.activeTabIds[targetPanelId] = tabsToMove[0];
        }
      }
      state.activePanelId = targetPanelId;
    },

    // -------------------------------------------------------------------------
    // Workspace Actions
    // -------------------------------------------------------------------------

    toggleSearchBars(state) {
      state.searchBarsHidden = !state.searchBarsHidden;
    },

    toggleFavoriteLayout(state, action: PayloadAction<{ layoutId: LayoutId }>) {
      const { layoutId } = action.payload;
      const favorites = state.favoriteLayouts ?? [];
      const index = favorites.indexOf(layoutId);
      if (index === -1) {
        state.favoriteLayouts = [...favorites, layoutId];
      } else {
        state.favoriteLayouts = favorites.filter((id) => id !== layoutId);
      }
    },

    // Note: popUndo is removed - redux-undo handles undo/redo for all actions.
    // Use dispatch(undo()) from redux-undo instead.

    resetWorkspace() {
      return initialWorkspaceState;
    },

    /**
     * Sync workspace from Dash backend (updateWorkspace prop)
     */
    syncWorkspace(state, action: PayloadAction<Partial<WorkspaceState>>) {
      const update = action.payload;
      if (update.tabs) state.tabs = update.tabs;
      if (update.panel) state.panel = update.panel;
      if (update.panelTabs) state.panelTabs = update.panelTabs;
      if (update.activeTabIds) state.activeTabIds = update.activeTabIds;
      if (update.activePanelId) state.activePanelId = update.activePanelId;
      if (update.favoriteLayouts) state.favoriteLayouts = update.favoriteLayouts;
      if (update.searchBarsHidden !== undefined) state.searchBarsHidden = update.searchBarsHidden;
    },
  },

  extraReducers: (builder) => {
    // Handle async thunk fulfilled cases
    builder
      .addCase(addTab.fulfilled, (state, action) => {
        const newTab = action.payload;
        state.tabs.push(newTab);

        if (!state.panelTabs[newTab.panelId]) {
          state.panelTabs[newTab.panelId] = [];
        }
        state.panelTabs[newTab.panelId].push(newTab.id);
        state.activeTabIds[newTab.panelId] = newTab.id;
        state.activePanelId = newTab.panelId;
      })
      .addCase(duplicateTab.fulfilled, (state, action) => {
        const newTab = action.payload;
        state.tabs.push(newTab);

        if (!state.panelTabs[newTab.panelId]) {
          state.panelTabs[newTab.panelId] = [];
        }
        state.panelTabs[newTab.panelId].push(newTab.id);
        state.activeTabIds[newTab.panelId] = newTab.id;
      });
  },
});

// Export actions
export const {
  removeTab,
  selectTab,
  renameTab,
  lockTab,
  unlockTab,
  toggleTabLock,
  updateTabLayout,
  moveTab,
  reorderTab,
  setTabIcon,
  setTabStyle,
  refreshTab,
  setActivePanel,
  resizePanel,
  pinPanel,
  unpinPanel,
  splitPanelAction,
  collapsePanelAction,
  toggleSearchBars,
  toggleFavoriteLayout,
  resetWorkspace,
  syncWorkspace,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
