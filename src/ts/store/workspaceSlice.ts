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
  splitPanel as splitPanelTree,
  collapsePanel as collapsePanelTree,
} from '@utils/panels';
import { notifyUser } from '@utils/toastEmitter';
import { canAddTab } from './selectors';

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
  /** Internal: maxTabs limit passed through for race condition guard in reducer */
  maxTabs?: number;
};

/** Return type for addTab thunk - includes tab and maxTabs for race condition guard */
type AddTabResult = { tab: Tab; maxTabs: number };

/**
 * Async thunk for adding a tab with maxTabs validation.
 * Uses thunk extra argument to access config.
 *
 * Note: The fulfilled reducer includes a secondary maxTabs check to prevent
 * race conditions when multiple addTab calls are dispatched rapidly.
 */
export const addTab = createAsyncThunk<
  AddTabResult, // Return type
  AddTabPayload, // Argument type
  { state: { workspace: { present: WorkspaceState } }; extra: ThunkExtra; rejectValue: string }
>('workspace/addTab', async (payload, { getState, extra, rejectWithValue }) => {
  const { tabs } = getState().workspace.present;

  // Validate maxTabs limit using shared canAddTab helper
  if (!canAddTab(tabs.length, extra.maxTabs)) {
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

  // Pass maxTabs through for race condition guard in reducer
  return { tab: newTab, maxTabs: extra.maxTabs };
});

/** Return type for duplicateTab thunk */
type DuplicateTabResult = { tab: Tab; maxTabs: number };

export const duplicateTab = createAsyncThunk<
  DuplicateTabResult,
  { tabId: TabId },
  { state: { workspace: { present: WorkspaceState } }; extra: ThunkExtra; rejectValue: string }
>('workspace/duplicateTab', async ({ tabId }, { getState, extra, rejectWithValue }) => {
  const { tabs } = getState().workspace.present;

  // Validate maxTabs limit using shared canAddTab helper
  if (!canAddTab(tabs.length, extra.maxTabs)) {
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

  // Pass maxTabs through for race condition guard in reducer
  return { tab: newTab, maxTabs: extra.maxTabs };
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

      // Handle empty panel: collapse or spawn new tab
      const panelTabCount = state.panelTabs[panelId]?.length ?? 0;
      if (panelTabCount === 0) {
        const leafPanels = getLeafPanelIds(state.panel);
        const otherPanels = leafPanels.filter((id) => id !== panelId);

        if (otherPanels.length > 0) {
          // Collapse the empty panel - there are other panels to use
          const collapseResult = collapsePanelTree(state.panel, panelId);
          if (collapseResult.success) {
            delete state.activeTabIds[panelId];
            delete state.panelTabs[panelId];
            // Move focus to another panel
            state.activePanelId = otherPanels[0];
          }
        } else {
          // This is the last panel - spawn a new empty tab
          const newTabId: TabId = generateShortId();
          const newTab: Tab = {
            id: newTabId,
            name: 'New Tab',
            panelId: panelId,
            createdAt: Date.now(),
            mountKey: generateShortId(),
          };
          state.tabs.push(newTab);
          state.panelTabs[panelId] = [newTabId];
          state.activeTabIds[panelId] = newTabId;
        }
      }
    },

    selectTab(state, action: PayloadAction<{ tabId: TabId; panelId: PanelId }>) {
      const { tabId, panelId } = action.payload;

      // Validate: tab must exist
      const tab = findTabById(state.tabs, tabId);
      if (!tab) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[selectTab] Tab not found: ${tabId}`);
        }
        return;
      }

      // Validate: tab must belong to the specified panel
      if (tab.panelId !== panelId) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[selectTab] Tab ${tabId} belongs to panel ${tab.panelId}, not ${panelId}`);
        }
        return;
      }

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
      if (!tab) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[updateTabLayout] Tab not found: ${tabId}`);
        }
        return;
      }

      const layoutChanging = tab.layoutId !== undefined && tab.layoutId !== layoutId;
      tab.layoutId = layoutId;
      tab.name = name;
      tab.layoutParams = params;
      tab.layoutOption = option;
      if (layoutChanging) {
        tab.mountKey = generateShortId();
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

      // Update source panel's active tab if the moved tab was active
      if (state.activeTabIds[sourcePanelId] === tabId) {
        const remaining = state.panelTabs[sourcePanelId] ?? [];
        const lastTab = remaining[remaining.length - 1];
        if (lastTab) {
          state.activeTabIds[sourcePanelId] = lastTab;
        } else {
          delete state.activeTabIds[sourcePanelId];
        }
      }

      // Collapse source panel if it's now empty (and not the last panel)
      const sourceEmpty = (state.panelTabs[sourcePanelId]?.length ?? 0) === 0;
      if (sourceEmpty) {
        const leafPanels = getLeafPanelIds(state.panel);
        const otherPanels = leafPanels.filter((id) => id !== sourcePanelId);
        if (otherPanels.length > 0) {
          const collapseResult = collapsePanelTree(state.panel, sourcePanelId);
          if (collapseResult.success) {
            delete state.activeTabIds[sourcePanelId];
            delete state.panelTabs[sourcePanelId];
          }
        }
      }
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
      const { panelId } = action.payload;

      // Validate: panelId must be a leaf panel
      const leafPanelIds = getLeafPanelIds(state.panel);
      if (!leafPanelIds.includes(panelId)) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[setActivePanel] Panel is not a leaf panel: ${panelId}`);
        }
        return;
      }

      state.activePanelId = panelId;
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

    /**
     * Split a panel to create a new panel with the specified tab.
     * Handles both same-panel splits (tab moves to new sibling) and
     * cross-panel splits (tab from another panel creates new panel here).
     */
    splitPanel(
      state,
      action: PayloadAction<{
        panelId: PanelId;
        direction: PanelDirection;
        tabId: TabId;
        position?: 'before' | 'after';
      }>
    ) {
      const { panelId, direction, tabId, position = 'after' } = action.payload;

      // Step 1: Validate split is allowed
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

      // Step 2: Perform tree split operation
      const splitResult = splitPanelTree(state.panel, { panelId, direction, position });
      if (!splitResult.success || !splitResult.newPanelId) {
        notifyUser('error', `Cannot split: ${splitResult.error}`);
        return;
      }

      const { newPanelId } = splitResult;

      // Step 3: Move tab to new panel
      state.panelTabs[newPanelId] = [];

      const sourceIdx = state.panelTabs[sourcePanelId]?.indexOf(tabId);
      if (sourceIdx !== undefined && sourceIdx !== -1) {
        state.panelTabs[sourcePanelId].splice(sourceIdx, 1);
      }

      state.panelTabs[newPanelId].push(tabId);
      tabToMove.panelId = newPanelId;

      // Step 4: Update active states
      state.activeTabIds[newPanelId] = tabId;
      state.activePanelId = newPanelId;

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

      // Step 5: Clean up source panel if empty (for cross-panel splits)
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

    collapsePanel(state, action: PayloadAction<{ panelId: PanelId }>) {
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
      const collapseResult = collapsePanelTree(state.panel, panelId);
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
     * Sync workspace from Dash backend (updateWorkspace prop).
     *
     * Validates state invariants after applying updates:
     * - All tabs must reference valid leaf panels
     * - panelTabs must be consistent with tabs array
     * - activeTabIds must reference existing tabs in correct panels
     *
     * Auto-heals inconsistencies when possible to prevent crashes.
     */
    syncWorkspace(state, action: PayloadAction<Partial<WorkspaceState>>) {
      const update = action.payload;

      // Apply updates
      if (update.tabs) state.tabs = update.tabs;
      if (update.panel) state.panel = update.panel;
      if (update.panelTabs) state.panelTabs = update.panelTabs;
      if (update.activeTabIds) state.activeTabIds = update.activeTabIds;
      if (update.activePanelId) state.activePanelId = update.activePanelId;
      if (update.favoriteLayouts) state.favoriteLayouts = update.favoriteLayouts;
      if (update.searchBarsHidden !== undefined) state.searchBarsHidden = update.searchBarsHidden;

      // Validate and auto-heal state invariants
      const leafPanelIds = new Set(getLeafPanelIds(state.panel));

      // 1. Remove tabs that reference non-existent panels
      const validTabs = state.tabs.filter((tab) => leafPanelIds.has(tab.panelId));
      if (validTabs.length !== state.tabs.length) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[syncWorkspace] Removed ${state.tabs.length - validTabs.length} orphaned tabs`
          );
        }
        state.tabs = validTabs;
      }

      // 2. Rebuild panelTabs from tabs to ensure consistency
      const rebuiltPanelTabs: Record<PanelId, TabId[]> = {};
      for (const panelId of leafPanelIds) {
        rebuiltPanelTabs[panelId] = [];
      }
      for (const tab of state.tabs) {
        if (rebuiltPanelTabs[tab.panelId]) {
          rebuiltPanelTabs[tab.panelId].push(tab.id);
        }
      }
      state.panelTabs = rebuiltPanelTabs;

      // 3. Validate and fix activeTabIds
      const tabIdSet = new Set(state.tabs.map((t) => t.id));
      for (const panelId of leafPanelIds) {
        const activeTabId = state.activeTabIds[panelId];
        const panelTabIds = state.panelTabs[panelId] ?? [];

        if (activeTabId && (!tabIdSet.has(activeTabId) || !panelTabIds.includes(activeTabId))) {
          // Active tab doesn't exist or isn't in this panel - pick first tab or delete
          if (panelTabIds.length > 0) {
            state.activeTabIds[panelId] = panelTabIds[0];
          } else {
            delete state.activeTabIds[panelId];
          }
        }
      }

      // Clean up activeTabIds for non-existent panels
      for (const panelId of Object.keys(state.activeTabIds) as PanelId[]) {
        if (!leafPanelIds.has(panelId)) {
          delete state.activeTabIds[panelId];
        }
      }

      // 4. Validate activePanelId
      if (!leafPanelIds.has(state.activePanelId)) {
        const firstLeafPanel = Array.from(leafPanelIds)[0];
        if (firstLeafPanel) {
          state.activePanelId = firstLeafPanel;
        }
      }
    },
  },

  extraReducers: (builder) => {
    // Handle async thunk fulfilled cases
    builder
      .addCase(addTab.fulfilled, (state, action) => {
        const { tab: newTab, maxTabs } = action.payload;

        // Guard: Re-check maxTabs limit to prevent race condition.
        // Between thunk validation and this reducer, another addTab could have completed.
        if (!canAddTab(state.tabs.length, maxTabs)) {
          // Silently skip - the tab was already created but we can't add it.
          // This is a rare race condition edge case.
          return;
        }

        state.tabs.push(newTab);

        if (!state.panelTabs[newTab.panelId]) {
          state.panelTabs[newTab.panelId] = [];
        }
        state.panelTabs[newTab.panelId].push(newTab.id);
        state.activeTabIds[newTab.panelId] = newTab.id;
        state.activePanelId = newTab.panelId;
      })
      .addCase(duplicateTab.fulfilled, (state, action) => {
        const { tab: newTab, maxTabs } = action.payload;

        // Guard: Re-check maxTabs limit to prevent race condition
        if (!canAddTab(state.tabs.length, maxTabs)) {
          return;
        }

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
  splitPanel,
  collapsePanel,
  toggleSearchBars,
  toggleFavoriteLayout,
  resetWorkspace,
  syncWorkspace,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
