import {
  createSlice,
  isAnyOf,
  type PayloadAction,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';
import type { Tab, PanelId, TabId, LayoutId, Workspace } from '@types';
import type { WorkspaceState, ThunkExtra } from './types';
import { generateShortId } from '@utils/uuid';
import { createTab, findOpenTabForLayout, findTabById, findTabIndex } from '@utils/tabs';
import {
  getLeafPanelIds,
  countLeafPanels,
  findPanelById,
  isLeafPanel,
  updatePanelInTree,
  splitPanel as splitPanelTree,
  removePanelFromTree,
} from '@utils/panels';
import { logger } from '@utils/logger';
import {
  addTab,
  canAddPanel,
  canAddTab,
  duplicateTab,
  splitPanel,
  type SplitPanelPayload,
  type WorkspaceThunkConfig,
} from './workspaceThunks';
import { healWorkspace } from './workspaceHeal';

/** Gives the longest tab name. renameTab cuts a longer name to this length. */
export const MAX_TAB_NAME_LENGTH = 24;

// Tab and panel helpers for the reducers

/**
 * Collapses a panel that has no tabs, removing it from the tree.
 * Used by removeTab, moveTab, and splitPanel to clean up empty panels.
 *
 * @returns true if the panel was collapsed, false if it's the last panel or collapse failed
 */
function collapseEmptyPanel(state: WorkspaceState, panelId: PanelId): boolean {
  const panelTabCount = state.panelTabs[panelId]?.length ?? 0;
  if (panelTabCount > 0) return false;

  const leafPanels = getLeafPanelIds(state.panel);
  const otherPanels = leafPanels.filter((id) => id !== panelId);
  if (otherPanels.length === 0) return false;

  if (!removePanelFromTree(state.panel, panelId)) return false;

  delete state.activeTabIds[panelId];
  delete state.panelTabs[panelId];
  return true;
}

/**
 * Takes a tab out of the tab list of its panel. If the tab was the active tab of the panel, the
 * last remaining tab of the panel becomes active.
 *
 * The tab stays in `state.tabs` with its old `panelId`. The caller removes it or attaches it to
 * another panel.
 */
export function detachTab(state: WorkspaceState, tab: Tab): void {
  const panelId = tab.panelId;
  const panelTabIds = state.panelTabs[panelId] ?? [];
  const index = panelTabIds.indexOf(tab.id);
  if (index !== -1) panelTabIds.splice(index, 1);

  if (state.activeTabIds[panelId] === tab.id) {
    const lastTabId = panelTabIds[panelTabIds.length - 1];
    if (lastTabId) {
      state.activeTabIds[panelId] = lastTabId;
    } else {
      delete state.activeTabIds[panelId];
    }
  }
}

/**
 * Puts a tab into the tab list of `panelId`, at `index` or at the end. The tab becomes the active
 * tab of the panel, and the panel becomes the active panel.
 */
export function attachTab(state: WorkspaceState, tab: Tab, panelId: PanelId, index?: number): void {
  tab.panelId = panelId;
  const panelTabIds = (state.panelTabs[panelId] ??= []);
  if (index !== undefined && index >= 0) {
    panelTabIds.splice(Math.min(index, panelTabIds.length), 0, tab.id);
  } else {
    panelTabIds.push(tab.id);
  }
  state.activeTabIds[panelId] = tab.id;
  state.activePanelId = panelId;
}

/**
 * Removes a tab and repairs the surrounding state: panelTabs, the panel's active
 * tab, collapsing a panel that became empty, or spawning a blank tab when the
 * last tab of the last panel was removed.
 *
 * Shared by the user-facing `removeTab` (which respects locks) and by
 * `reconcileWithServer` (which must also drop locked tabs whose layout is gone).
 *
 * @returns true if a tab was removed
 */
function removeTabFromState(
  state: WorkspaceState,
  tabId: TabId,
  options: { ignoreLock?: boolean } = {}
): boolean {
  const tabIndex = findTabIndex(state.tabs, tabId);
  if (tabIndex === -1) return false;

  const tab = state.tabs[tabIndex];
  if (tab.locked && !options.ignoreLock) return false;

  const panelId = tab.panelId;
  state.tabs.splice(tabIndex, 1);
  detachTab(state, tab);

  if (collapseEmptyPanel(state, panelId)) {
    const remaining = getLeafPanelIds(state.panel);
    if (remaining.length > 0) {
      state.activePanelId = remaining[0];
    }
  } else if ((state.panelTabs[panelId]?.length ?? 0) === 0) {
    // The workspace never shows an empty last panel, so a blank tab replaces the removed one.
    const newTab = createTab(panelId);
    state.tabs.push(newTab);
    attachTab(state, newTab, panelId);
  }
  return true;
}

/**
 * Splits a panel to create a new panel with the specified tab.
 * Handles both same-panel splits (tab moves to new sibling) and
 * cross-panel splits (tab from another panel creates new panel here).
 */
function splitPanelInState(state: WorkspaceState, payload: SplitPanelPayload): void {
  const { panelId, direction, tabId, position = 'after' } = payload;

  const tabToMove = findTabById(state.tabs, tabId);
  if (!tabToMove) return;

  const sourcePanelId = tabToMove.panelId;
  const sourcePanelTabs = state.panelTabs[sourcePanelId] ?? [];
  const isSamePanelSplit = sourcePanelId === panelId;

  // Block same-panel split if panel only has one tab
  if (isSamePanelSplit && sourcePanelTabs.length <= 1) return;

  // The tree split throws if the panel is not a leaf of the tree.
  const newPanelId = splitPanelTree(state.panel, { panelId, direction, position });
  detachTab(state, tabToMove);
  attachTab(state, tabToMove, newPanelId);

  // A cross-panel split can empty the source panel. The new panel already has the focus, so the
  // result of the collapse does not matter.
  if (!isSamePanelSplit) {
    collapseEmptyPanel(state, sourcePanelId);
  }
}

// Initial state

/**
 * Builds a fresh initial workspace state: one panel containing one blank
 * "New Tab".
 *
 * This is a factory rather than a module-level constant on purpose:
 * - IDs must not be generated while the bundle is evaluating. `generateShortId`
 *   touches `crypto`, and any failure there would stop `window.dash_prism`
 *   from ever being defined.
 * - Every store, and every `resetWorkspace`, must get its own IDs and
 *   `createdAt`. A module-level constant would make two Prism instances on
 *   one page share tab/panel IDs, and a reset would reuse the IDs of the
 *   very first tab, so React would not see a new key.
 */
export function createInitialWorkspaceState(): WorkspaceState {
  const panelId: PanelId = generateShortId();
  const tab = createTab(panelId);

  return {
    tabs: [tab],
    panel: {
      id: panelId,
      order: 0,
      direction: 'horizontal',
      children: [],
      size: '100%',
    },
    panelTabs: { [panelId]: [tab.id] },
    activeTabIds: { [panelId]: tab.id },
    activePanelId: panelId,
    favoriteLayouts: [],
    searchBarsHidden: false,
  };
}

// Slice

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState: createInitialWorkspaceState,
  reducers: {
    // Tab actions

    removeTab(state, action: PayloadAction<{ tabId: TabId }>) {
      removeTabFromState(state, action.payload.tabId);
    },

    /**
     * Reconciles a (re)hydrated workspace with the server it is now talking to.
     *
     * Dispatched once after redux-persist's REHYDRATE. `serverSessionId` is the
     * Prism prop of the same name. Each tab whose layout the server no longer
     * knows is closed (locked or not) instead of rendering a "Layout is not
     * registered" error, and the new fingerprint is recorded. Nothing else is
     * touched: the workspace is never wiped.
     *
     * An empty `registeredLayoutIds` list disables pruning, because it cannot be
     * told apart from metadata that has not been injected.
     */
    reconcileWithServer(
      state,
      action: PayloadAction<{ serverSessionId?: string; registeredLayoutIds: LayoutId[] }>
    ) {
      const { serverSessionId, registeredLayoutIds } = action.payload;
      const known = new Set(registeredLayoutIds);
      const staleTabIds =
        registeredLayoutIds.length > 0
          ? state.tabs.filter((tab) => tab.layoutId && !known.has(tab.layoutId)).map((t) => t.id)
          : [];

      if (staleTabIds.length === 0 && state.serverSessionId === serverSessionId) return;

      // Pruning may collapse panels; keep the saved focus if that panel survives
      // instead of letting the collapse move it to the first remaining panel.
      const savedActivePanelId = state.activePanelId;
      for (const tabId of staleTabIds) {
        removeTabFromState(state, tabId, { ignoreLock: true });
      }
      if (getLeafPanelIds(state.panel).includes(savedActivePanelId)) {
        state.activePanelId = savedActivePanelId;
      }
      state.serverSessionId = serverSessionId;

      if (staleTabIds.length > 0) {
        // The user-facing toast is raised by <LoadNotice /> once the UI has
        // mounted (see reconcileMiddleware); this runs inside REHYDRATE, before
        // any toast subscriber exists.
        logger.info(
          `[reconcileWithServer] Closed ${staleTabIds.length} tab(s) whose layout is no longer registered (serverSessionId=${serverSessionId ?? 'none'})`
        );
      }
    },

    activateTab(state, action: PayloadAction<{ tabId: TabId; panelId: PanelId }>) {
      const { tabId, panelId } = action.payload;

      // Validate: tab must exist
      const tab = findTabById(state.tabs, tabId);
      if (!tab) {
        logger.debug(`[activateTab] Tab not found: ${tabId}`);
        return;
      }

      // Validate: tab must belong to the specified panel
      if (tab.panelId !== panelId) {
        logger.debug(`[activateTab] Tab ${tabId} belongs to panel ${tab.panelId}, not ${panelId}`);
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
        logger.debug(`[updateTabLayout] Tab not found: ${tabId}`);
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

      // Validate target panel exists as a leaf panel (prevents stale DnD events)
      const leafPanelIds = getLeafPanelIds(state.panel);
      if (!leafPanelIds.includes(targetPanelId)) return;

      detachTab(state, tab);
      attachTab(state, tab, targetPanelId, targetIndex);

      // The target panel already has the focus, so the result of the collapse does not matter.
      collapseEmptyPanel(state, sourcePanelId);
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

    // Panel actions

    setActivePanel(state, action: PayloadAction<{ panelId: PanelId }>) {
      const { panelId } = action.payload;

      // Validate: panelId must be a leaf panel
      const leafPanelIds = getLeafPanelIds(state.panel);
      if (!leafPanelIds.includes(panelId)) {
        logger.debug(`[setActivePanel] Panel is not a leaf panel: ${panelId}`);
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

    // Workspace actions

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

    resetWorkspace() {
      return createInitialWorkspaceState();
    },

    /**
     * Applies a workspace that a Dash callback sent through the `updateWorkspace` prop. Each
     * field in the payload replaces the field of the state, and healWorkspace then repairs what
     * the mix of old and new fields broke.
     */
    syncWorkspace(state, action: PayloadAction<Partial<Workspace>>) {
      const update = action.payload;
      if (update.tabs) state.tabs = update.tabs;
      if (update.panel) state.panel = update.panel;
      if (update.panelTabs) state.panelTabs = update.panelTabs;
      if (update.activeTabIds) state.activeTabIds = update.activeTabIds;
      if (update.activePanelId) state.activePanelId = update.activePanelId;
      if (update.favoriteLayouts) state.favoriteLayouts = update.favoriteLayouts;
      if (update.searchBarsHidden !== undefined) state.searchBarsHidden = update.searchBarsHidden;
      Object.assign(state, healWorkspace(state));
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(splitPanel.fulfilled, (state, action) => {
        // Two quick splits can both pass the check of the thunk. The second split is dropped.
        if (!canAddPanel(countLeafPanels(state.panel), action.payload.maxPanels)) return;
        // An earlier split in the same tick can also remove the target, and the tree split throws then.
        const target = findPanelById(state.panel, action.payload.panelId);
        if (!target || !isLeafPanel(target)) return;

        splitPanelInState(state, action.payload);
      })
      .addMatcher(isAnyOf(addTab.fulfilled, duplicateTab.fulfilled), (state, action) => {
        const { tab, maxTabs } = action.payload;
        // Two quick dispatches can both pass the check of the thunk. The second tab is dropped.
        if (!canAddTab(state.tabs.length, maxTabs)) return;
        state.tabs.push(tab);
        attachTab(state, tab, tab.panelId);
      });
  },
});

export const {
  removeTab,
  reconcileWithServer,
  activateTab,
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
  toggleSearchBars,
  toggleFavoriteLayout,
  resetWorkspace,
  syncWorkspace,
} = workspaceSlice.actions;

export const workspaceReducer = workspaceSlice.reducer;

// This thunk dispatches a slice action, so it lives here. workspaceThunks.ts cannot import the
// slice, because the slice imports the thunks.

/**
 * Switches to the open tab of a layout that does not allow multiple tabs, and tells the user.
 * The search bar and the share link use it before they open a layout.
 *
 * @returns true if it switched to an open tab, false if the layout can open in a new tab
 */
export const switchToOpenTab =
  (
    layoutId: LayoutId
  ): ThunkAction<boolean, WorkspaceThunkConfig['state'], ThunkExtra, UnknownAction> =>
  (dispatch, getState, extra) => {
    const layout = extra.getRegisteredLayouts()[layoutId];
    if (!layout) return false;

    const openTab = findOpenTabForLayout(getState().workspace.present.tabs, layoutId, layout);
    if (!openTab) return false;

    extra.notify('info', `Layout "${layout.name}" is already open. Switching to it.`);
    dispatch(activateTab({ tabId: openTab.id, panelId: openTab.panelId }));
    return true;
  };
