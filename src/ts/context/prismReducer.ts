import { produce, Draft } from 'immer';
import type { Tab, Panel, Workspace, PanelDirection, PanelId, TabId, LayoutId } from '@types';
import { generateShortId } from '@utils/uuid';
import { findTabIndex, findTabById } from '@utils/tabs';
import { validateWorkspace } from '@utils/workspaceValidation';
import {
  getLeafPanelIds,
  findPanelById,
  updatePanelInTree,
  removePanelFromTree,
} from '@utils/panels';

// =============================================================================
// Types
// =============================================================================

export type SearchBarMode = 'hidden' | 'display' | 'search' | 'params' | 'options';

export type PrismState = {
  undoStack: Array<{ tab: Tab; position: number; panelId: PanelId }>;
  searchBarModes: Record<PanelId, SearchBarMode>;
  /** Tab ID currently being renamed (ephemeral UI state, not persisted) */
  renamingTabId: TabId | null;
} & Workspace;

type DraftState = Draft<PrismState>;

type WorkspaceSource = Pick<
  PrismState,
  | 'tabs'
  | 'panel'
  | 'panelTabs'
  | 'activeTabIds'
  | 'activePanelId'
  | 'favoriteLayouts'
  | 'theme'
  | 'searchBarsHidden'
>;

function buildWorkspaceSnapshot(source: WorkspaceSource): Workspace {
  return {
    tabs: source.tabs,
    panel: source.panel,
    panelTabs: source.panelTabs,
    activeTabIds: source.activeTabIds,
    activePanelId: source.activePanelId,
    favoriteLayouts: source.favoriteLayouts,
    theme: source.theme,
    searchBarsHidden: source.searchBarsHidden,
  };
}

function mergeWorkspaceUpdate(state: WorkspaceSource, update: Partial<Workspace>): Workspace {
  const base = buildWorkspaceSnapshot(state);
  return {
    ...base,
    tabs: update.tabs ?? base.tabs,
    panel: update.panel ?? base.panel,
    panelTabs: update.panelTabs ?? base.panelTabs,
    activeTabIds: update.activeTabIds ?? base.activeTabIds,
    activePanelId: update.activePanelId ?? base.activePanelId,
    favoriteLayouts: update.favoriteLayouts ?? base.favoriteLayouts,
    theme: update.theme ?? base.theme,
    searchBarsHidden: update.searchBarsHidden ?? base.searchBarsHidden,
  };
}

// =============================================================================
// Helper Functions (operate on draft state)
// =============================================================================

/**
 * Check if a panel has no tabs.
 */
function isPanelEmpty(draft: DraftState, panelId: PanelId): boolean {
  return (draft.panelTabs[panelId]?.length ?? 0) === 0;
}

/**
 * Select the last tab in a panel as active.
 * If no tabs remain, delete the activeTabId entry.
 */
function handleSelectLastTabInPanel(draft: DraftState, panelId: PanelId): void {
  const remaining = getTabsForPanel(draft, panelId);
  const lastTab = remaining[remaining.length - 1];
  if (lastTab) {
    draft.activeTabIds[panelId] = lastTab.id;
  } else {
    delete draft.activeTabIds[panelId];
  }
}

/**
 * Get tabs for a panel using panelTabs as source of truth.
 * More reliable than filtering by tab.panelId during mutations.
 */
function getTabsForPanel(draft: DraftState, panelId: PanelId): Draft<Tab>[] {
  const tabIds = draft.panelTabs[panelId] ?? [];
  return tabIds
    .map((id) => draft.tabs.find((t) => t.id === id))
    .filter((t): t is Draft<Tab> => t !== undefined);
}

/**
 * Move a tab from one panel to another.
 * Updates both tab.panelId AND panelTabs atomically.
 * Returns sourcePanelId for further processing, or undefined if no-op/failed.
 *
 * @param targetIndex - Optional index to insert at. If undefined, appends to end.
 */
function handleMoveTabToPanel(
  draft: DraftState,
  tabId: TabId,
  targetPanelId: PanelId,
  targetIndex?: number
): PanelId | undefined {
  const tab = findTabById(draft.tabs, tabId);
  if (!tab) return undefined;

  const sourcePanelId = tab.panelId;

  // No-op if already in target panel
  if (sourcePanelId === targetPanelId) return undefined;

  // Remove from source panelTabs
  const sourceIdx = draft.panelTabs[sourcePanelId]?.indexOf(tabId);
  if (sourceIdx !== undefined && sourceIdx !== -1) {
    draft.panelTabs[sourcePanelId].splice(sourceIdx, 1);
  }

  // Add to target panelTabs at specified index or end
  if (!draft.panelTabs[targetPanelId]) draft.panelTabs[targetPanelId] = [];
  if (targetIndex !== undefined && targetIndex >= 0) {
    // Clamp index to valid range and insert at position
    const clampedIndex = Math.min(targetIndex, draft.panelTabs[targetPanelId].length);
    draft.panelTabs[targetPanelId].splice(clampedIndex, 0, tabId);
  } else {
    // Append to end (default behavior)
    draft.panelTabs[targetPanelId].push(tabId);
  }

  // Update tab's panelId
  tab.panelId = targetPanelId;

  return sourcePanelId;
}

/**
 * Remove a tab from its panel's tracking (panelTabs only, not tabs array).
 */
function handleRemoveTabFromPanelTracking(draft: DraftState, tabId: TabId, panelId: PanelId): void {
  const idx = draft.panelTabs[panelId]?.indexOf(tabId);
  if (idx !== undefined && idx !== -1) {
    draft.panelTabs[panelId].splice(idx, 1);
  }
}

/**
 * Add a tab to a panel's tracking (panelTabs only).
 */
function handleAddTabToPanelTracking(draft: DraftState, tabId: TabId, panelId: PanelId): void {
  if (!draft.panelTabs[panelId]) draft.panelTabs[panelId] = [];
  if (!draft.panelTabs[panelId].includes(tabId)) {
    draft.panelTabs[panelId].push(tabId);
  }
}

/**
 * Update active tab for a panel after a tab was removed/moved.
 * Selects the last remaining tab, or clears if none.
 */
function handleUpdateActiveTabAfterRemoval(
  draft: DraftState,
  panelId: PanelId,
  removedTabId: TabId
): void {
  if (draft.activeTabIds[panelId] !== removedTabId) return;
  handleSelectLastTabInPanel(draft, panelId);
}

/**
 * Collapse a panel if it's empty.
 * Returns true if collapsed, false otherwise.
 */
function handleCollapseIfEmpty(draft: DraftState, panelId: PanelId): boolean {
  if (!isPanelEmpty(draft, panelId)) return false;

  const leafPanels = getLeafPanelIds(draft.panel);
  const otherLeafPanels = leafPanels.filter((id) => id !== panelId);

  // Cannot collapse the last remaining panel
  if (otherLeafPanels.length === 0) return false;

  const targetPanelId = otherLeafPanels[0];

  // Remove panel from tree
  removePanelFromTree(draft.panel, panelId);

  // Clean up state
  delete draft.activeTabIds[panelId];
  delete draft.panelTabs[panelId];
  delete draft.searchBarModes[panelId];

  // Update active panel
  draft.activePanelId = targetPanelId;

  return true;
}

/**
 * Spawn a new empty tab in a panel.
 */
function handleSpawnEmptyTab(draft: DraftState, panelId: PanelId): void {
  const newTab: Tab = {
    id: generateShortId(),
    name: 'New Tab',
    panelId,
    layoutId: undefined,
    createdAt: Date.now(),
  };
  draft.tabs.push(newTab);
  handleAddTabToPanelTracking(draft, newTab.id, panelId);
  draft.activeTabIds[panelId] = newTab.id;
}

/**
 * Ensure a panel has at least one tab.
 * Either collapses the panel or spawns a new tab.
 */
function handleEnsurePanelHasTab(draft: DraftState, panelId: PanelId): void {
  if (!isPanelEmpty(draft, panelId)) return;

  // Try to collapse first, spawn if can't collapse
  if (!handleCollapseIfEmpty(draft, panelId)) {
    handleSpawnEmptyTab(draft, panelId);
  }
}

/**
 * Check if a panel exists in the current tree.
 */
function isPanelExists(draft: DraftState, panelId: PanelId): boolean {
  return getLeafPanelIds(draft.panel).includes(panelId);
}

// =============================================================================
// Initial State
// =============================================================================

export function createInitialState(): PrismState {
  const initialPanelId: PanelId = generateShortId();
  const initialTabId: TabId = generateShortId();

  return {
    // PERSISTED STATE
    tabs: [
      {
        id: initialTabId,
        name: 'New Tab',
        panelId: initialPanelId,
        layoutId: undefined,
        createdAt: Date.now(),
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
    // NOT PERSISTED
    theme: 'light',
    // size: 'md',
    undoStack: [],
    searchBarModes: {},
    renamingTabId: null,
  };
}

export const initialState: PrismState = createInitialState();

// =============================================================================
// State Validation (Development Only)
// =============================================================================

/**
 * Validate state invariants in development mode only.
 * Logs errors to console if any invariants are violated.
 */
function validateState(draft: DraftState): void {
  if (process.env.NODE_ENV === 'production') return;

  const validation = validateWorkspace(buildWorkspaceSnapshot(draft as WorkspaceSource));
  if (validation.ok) return;

  const { errors } = validation as { ok: false; errors: string[] };
  console.error('❌ State invariant violations:', errors);
}

// =============================================================================
// Actions
// =============================================================================

export type Action =
  | { type: 'SYNC_WORKSPACE'; payload: Partial<Workspace> }
  | {
      type: 'ADD_TAB';
      payload: {
        panelId: PanelId;
        name?: string;
        layoutId?: string;
        params?: Record<string, string>;
        option?: string;
      };
    }
  | { type: 'REMOVE_TAB'; payload: { tabId: TabId } }
  | { type: 'SELECT_TAB'; payload: { tabId: TabId; panelId: PanelId } }
  | { type: 'RENAME_TAB'; payload: { tabId: TabId; name: string } }
  | { type: 'LOCK_TAB'; payload: { tabId: TabId } }
  | { type: 'UNLOCK_TAB'; payload: { tabId: TabId } }
  | { type: 'TOGGLE_TAB_LOCK'; payload: { tabId: TabId } }
  | { type: 'DUPLICATE_TAB'; payload: { tabId: TabId } }
  | {
      type: 'UPDATE_TAB_LAYOUT';
      payload: {
        tabId: TabId;
        layoutId: LayoutId;
        name: string;
        params?: Record<string, string>;
        option?: string;
      };
    }
  | { type: 'MOVE_TAB'; payload: { tabId: TabId; targetPanelId: PanelId; targetIndex?: number } }
  | { type: 'REORDER_TAB'; payload: { panelId: PanelId; fromIndex: number; toIndex: number } }
  | { type: 'SET_TAB_ICON'; payload: { tabId: TabId; icon?: string } }
  | { type: 'SET_TAB_STYLE'; payload: { tabId: TabId; style?: string } }
  | {
      type: 'SPLIT_PANEL';
      payload: {
        panelId: PanelId;
        direction: PanelDirection;
        tabId: TabId;
        /** 'before' = new panel first (left/top), 'after' = new panel second (right/bottom) */
        position?: 'before' | 'after';
      };
    }
  | { type: 'COLLAPSE_PANEL'; payload: { panelId: PanelId } }
  | { type: 'RESIZE_PANEL'; payload: { panelId: PanelId; size: string | number } }
  | { type: 'SET_ACTIVE_PANEL'; payload: { panelId: PanelId } }
  | { type: 'PIN_PANEL'; payload: { panelId: PanelId } }
  | { type: 'UNPIN_PANEL'; payload: { panelId: PanelId } }
  | { type: 'TOGGLE_SEARCH_BARS' }
  | { type: 'SET_SEARCHBAR_MODE'; payload: { panelId: PanelId; mode: SearchBarMode } }
  | { type: 'TOGGLE_FAVORITE_LAYOUT'; payload: { layoutId: LayoutId } }
  | { type: 'POP_UNDO' }
  | { type: 'START_RENAME_TAB'; payload: { tabId: TabId } }
  | { type: 'CLEAR_RENAME_TAB' }
  | { type: 'RESET_WORKSPACE' }
  | { type: 'REFRESH_TAB'; payload: { tabId: TabId } };

// =============================================================================
// Reducer Config
// =============================================================================

export type ReducerConfig = {
  /** Maximum number of tabs allowed globally. Values < 1 mean unlimited. */
  maxTabs: number;
};

const DEFAULT_REDUCER_CONFIG: ReducerConfig = {
  maxTabs: 16,
};

/**
 * Check if adding a new tab would exceed the maxTabs limit.
 * Returns true if the action should be blocked.
 */
function isMaxTabsExceeded(draft: DraftState, maxTabs: number): boolean {
  // maxTabs < 1 means unlimited
  if (maxTabs < 1) return false;
  return draft.tabs.length >= maxTabs;
}

// =============================================================================
// Reducer Factory
// =============================================================================

/**
 * Create a prism reducer with the given configuration.
 * Use this factory to inject config (like maxTabs) into the reducer.
 *
 * @param config - Configuration options for the reducer
 * @returns A reducer function for use with useReducer
 */
export function createPrismReducer(config: Partial<ReducerConfig> = {}) {
  const { maxTabs } = { ...DEFAULT_REDUCER_CONFIG, ...config };

  return function prismReducer(state: PrismState, action: Action): PrismState {
    return produce(state, (draft) => {
      switch (action.type) {
        // -----------------------------------------------------------------------
        // Workspace Sync (Dash → Prism)
        // -----------------------------------------------------------------------
        case 'SYNC_WORKSPACE': {
          const mergedWorkspace = mergeWorkspaceUpdate(state, action.payload);
          const validation = validateWorkspace(mergedWorkspace);

          if (!validation.ok) {
            const { errors } = validation as { ok: false; errors: string[] };
            console.warn('SYNC_WORKSPACE rejected due to validation errors:', errors);
            break;
          }

          const normalized = validation.workspace;

          draft.tabs = normalized.tabs.map((tab) => ({
            ...tab,
            mountKey: tab.mountKey ?? generateShortId(),
          }));
          draft.panel = normalized.panel;
          draft.panelTabs = normalized.panelTabs;
          draft.activeTabIds = normalized.activeTabIds;
          draft.activePanelId = normalized.activePanelId;
          draft.favoriteLayouts = normalized.favoriteLayouts ?? draft.favoriteLayouts;
          draft.searchBarsHidden = normalized.searchBarsHidden ?? draft.searchBarsHidden;
          draft.theme = normalized.theme ?? draft.theme;
          break;
        }

        // -----------------------------------------------------------------------
        // Tab Actions
        // -----------------------------------------------------------------------

        case 'ADD_TAB': {
          // Enforce maxTabs limit (< 1 means unlimited)
          if (isMaxTabsExceeded(draft, maxTabs)) {
            console.warn(`ADD_TAB blocked: workspace at maxTabs limit (${maxTabs})`);
            break;
          }

          const {
            panelId,
            name = 'New Tab',
            layoutId = undefined,
            params,
            option,
          } = action.payload;
          const newTab: Tab = {
            id: generateShortId(),
            name,
            panelId,
            layoutId,
            layoutParams: params ?? undefined,
            layoutOption: option ?? undefined,
            createdAt: Date.now(),
            mountKey: generateShortId(),
          };
          draft.tabs.push(newTab);
          handleAddTabToPanelTracking(draft, newTab.id, panelId);
          draft.activeTabIds[panelId] = newTab.id;
          draft.activePanelId = panelId;
          break;
        }

        case 'REORDER_TAB': {
          const { panelId, fromIndex, toIndex } = action.payload;
          const panelTabIds = draft.panelTabs[panelId];
          if (!panelTabIds || fromIndex < 0 || fromIndex >= panelTabIds.length) break;

          const clampedToIndex = Math.max(0, Math.min(toIndex, panelTabIds.length - 1));
          const [movedId] = panelTabIds.splice(fromIndex, 1);
          panelTabIds.splice(clampedToIndex, 0, movedId);
          break;
        }

        case 'REMOVE_TAB': {
          const { tabId } = action.payload;
          const tabIndex = findTabIndex(draft.tabs, tabId);
          if (tabIndex === -1) break;

          const tab = draft.tabs[tabIndex];
          if (tab.locked) break;

          const panelId = tab.panelId;

          // Push to undo stack
          const panelTabIds = draft.panelTabs[panelId] ?? [];
          const position = panelTabIds.indexOf(tabId);
          if (draft.undoStack.length >= 10) draft.undoStack.shift();
          draft.undoStack.push({ tab: { ...tab } as Tab, position, panelId });

          // Remove from tabs array
          draft.tabs.splice(tabIndex, 1);

          // Remove from panelTabs tracking
          handleRemoveTabFromPanelTracking(draft, tabId, panelId);

          // Update active tab
          handleUpdateActiveTabAfterRemoval(draft, panelId, tabId);

          // Collapse or spawn new tab
          handleEnsurePanelHasTab(draft, panelId);
          break;
        }

        case 'SELECT_TAB': {
          const { tabId, panelId } = action.payload;
          draft.activeTabIds[panelId] = tabId;
          draft.activePanelId = panelId;
          break;
        }

        case 'RENAME_TAB': {
          const { tabId, name } = action.payload;
          const tab = findTabById(draft.tabs, tabId);
          if (tab) tab.name = name;
          // Clear rename mode after committing
          draft.renamingTabId = null;
          break;
        }

        case 'LOCK_TAB': {
          const { tabId } = action.payload;
          const tab = findTabById(draft.tabs, tabId);
          if (tab) tab.locked = true;
          break;
        }

        case 'UNLOCK_TAB': {
          const { tabId } = action.payload;
          const tab = findTabById(draft.tabs, tabId);
          if (tab) tab.locked = false;
          break;
        }

        case 'TOGGLE_TAB_LOCK': {
          const { tabId } = action.payload;
          const tab = findTabById(draft.tabs, tabId);
          if (tab) tab.locked = !tab.locked;
          break;
        }

        case 'DUPLICATE_TAB': {
          // Enforce maxTabs limit (< 1 means unlimited)
          if (isMaxTabsExceeded(draft, maxTabs)) {
            console.warn(`DUPLICATE_TAB blocked: workspace at maxTabs limit (${maxTabs})`);
            break;
          }

          const { tabId } = action.payload;
          const originalTab = findTabById(draft.tabs, tabId);
          if (!originalTab) break;

          const newTab: Tab = {
            ...originalTab,
            id: generateShortId(),
            name: `${originalTab.name} (copy)`,
            createdAt: Date.now(),
            locked: false,
            // Deep copy layoutParams to prevent shared references
            layoutParams: originalTab.layoutParams ? { ...originalTab.layoutParams } : undefined,
            // New mountKey for fresh React mount
            mountKey: generateShortId(),
          };
          draft.tabs.push(newTab);
          handleAddTabToPanelTracking(draft, newTab.id, newTab.panelId);
          draft.activeTabIds[newTab.panelId] = newTab.id;
          break;
        }

        case 'UPDATE_TAB_LAYOUT': {
          const { tabId, layoutId, name, params, option } = action.payload;
          const tab = findTabById(draft.tabs, tabId);
          if (tab) {
            tab.layoutId = layoutId;
            tab.name = name;
            tab.layoutParams = params ?? undefined;
            tab.layoutOption = option ?? undefined;
          }
          break;
        }

        case 'MOVE_TAB': {
          const { tabId, targetPanelId, targetIndex } = action.payload;

          const sourcePanelId = handleMoveTabToPanel(draft, tabId, targetPanelId, targetIndex);
          if (!sourcePanelId) break; // No-op or tab not found

          // Update active tabs
          draft.activeTabIds[targetPanelId] = tabId;
          draft.activePanelId = targetPanelId;
          handleUpdateActiveTabAfterRemoval(draft, sourcePanelId, tabId);

          // Collapse source if empty
          handleCollapseIfEmpty(draft, sourcePanelId);
          break;
        }

        case 'SET_TAB_ICON': {
          const { tabId, icon } = action.payload;
          const tab = findTabById(draft.tabs, tabId);
          if (tab) tab.icon = icon;
          break;
        }

        case 'SET_TAB_STYLE': {
          const { tabId, style } = action.payload;
          const tab = findTabById(draft.tabs, tabId);
          if (tab) tab.style = style;
          break;
        }

        // -----------------------------------------------------------------------
        // Panel Actions
        // -----------------------------------------------------------------------

        case 'SPLIT_PANEL': {
          const { panelId, direction, tabId, position = 'after' } = action.payload;

          const panelToSplit = findPanelById(draft.panel, panelId);
          if (!panelToSplit) break;

          const tabToMove = findTabById(draft.tabs, tabId);
          if (!tabToMove) break;

          // Determine source panel (where tab is coming from)
          const sourcePanelId = tabToMove.panelId;
          const sourcePanelTabs = draft.panelTabs[sourcePanelId] ?? [];
          const isSamePanelSplit = sourcePanelId === panelId;

          // Block same-panel split if panel only has one tab
          // (can't split a panel by dragging its only tab onto itself)
          if (isSamePanelSplit && sourcePanelTabs.length <= 1) break;

          // Generate IDs for container and new sibling panel only
          // The original panel KEEPS its ID to avoid re-renders
          const containerId = generateShortId();
          const newPanelId = generateShortId();

          // Determine ordering based on drop position:
          // - 'before' (left/top): new panel first (order: 0), original second (order: 1)
          // - 'after' (right/bottom): original first (order: 0), new panel second (order: 1)
          const newPanelOrder = position === 'before' ? 0 : 1;
          const originalPanelOrder = position === 'before' ? 1 : 0;

          // Create the original panel as a child (keeps same ID!)
          const originalPanelAsChild: Panel = {
            id: panelId, // KEEP ORIGINAL ID - prevents tab re-renders
            order: originalPanelOrder,
            direction: panelToSplit.direction,
            children: [], // Leaf panel has no children
            size: '50%',
          };

          // Create new sibling panel for the moved tab
          const newSiblingPanel: Panel = {
            id: newPanelId,
            order: newPanelOrder,
            direction,
            children: [],
            size: '50%',
          };

          // Build children array sorted by order
          const children =
            position === 'before'
              ? [newSiblingPanel, originalPanelAsChild]
              : [originalPanelAsChild, newSiblingPanel];

          // Transform the original panel location into a container
          updatePanelInTree(draft.panel, panelId, (panel) => {
            panel.id = containerId;
            panel.direction = direction;
            panel.children = children;
            // Root panel keeps size, nested containers don't need it
            if (panel !== draft.panel) {
              delete panel.size;
            }
          });

          // Initialize new panel's state
          draft.panelTabs[newPanelId] = [];
          // Don't set activeTabIds yet - will be set after tab is moved

          // Move the tab to the new panel
          // This updates tab.panelId and panelTabs atomically
          handleMoveTabToPanel(draft, tabId, newPanelId);

          // Update active states
          draft.activeTabIds[newPanelId] = tabId;
          draft.activePanelId = newPanelId;

          // Update active tab in original panel if needed
          // (in case we moved the currently active tab)
          if (draft.activeTabIds[panelId] === tabId) {
            const remainingTabs = draft.panelTabs[panelId] ?? [];
            const lastTabId = remainingTabs[remainingTabs.length - 1];
            if (lastTabId) {
              draft.activeTabIds[panelId] = lastTabId;
            } else {
              delete draft.activeTabIds[panelId];
            }
          }

          // For cross-panel splits, update active tab in SOURCE panel if we moved its active tab
          if (!isSamePanelSplit && draft.activeTabIds[sourcePanelId] === tabId) {
            const remainingSourceTabs = draft.panelTabs[sourcePanelId] ?? [];
            const lastSourceTabId = remainingSourceTabs[remainingSourceTabs.length - 1];
            if (lastSourceTabId) {
              draft.activeTabIds[sourcePanelId] = lastSourceTabId;
            } else {
              delete draft.activeTabIds[sourcePanelId];
            }
          }

          // For cross-panel splits, collapse the source panel if it's now empty
          // (handleCollapseIfEmpty already checks it's not the last panel)
          if (!isSamePanelSplit) {
            handleCollapseIfEmpty(draft, sourcePanelId);
          } else {
            // For same-panel splits, ensure original panel still has tabs (safety check)
            handleEnsurePanelHasTab(draft, panelId);
          }
          break;
        }

        case 'COLLAPSE_PANEL': {
          const { panelId } = action.payload;

          const leafPanels = getLeafPanelIds(draft.panel).filter((id) => id !== panelId);
          if (leafPanels.length === 0) break; // Can't collapse last panel

          const targetPanelId = leafPanels[0];

          // Move all tabs from collapsing panel to target
          const tabsToMove = [...(draft.panelTabs[panelId] ?? [])];
          for (const tid of tabsToMove) {
            handleMoveTabToPanel(draft, tid, targetPanelId);
          }

          // Remove panel from tree
          removePanelFromTree(draft.panel, panelId);

          // Clean up
          delete draft.activeTabIds[panelId];
          delete draft.panelTabs[panelId];

          // Update active states
          if (tabsToMove.length > 0) {
            // Only set active tab if target panel doesn't already have a valid one
            const targetHasActiveTab =
              draft.activeTabIds[targetPanelId] &&
              draft.panelTabs[targetPanelId]?.includes(draft.activeTabIds[targetPanelId]);
            if (!targetHasActiveTab) {
              draft.activeTabIds[targetPanelId] = tabsToMove[0];
            }
          }
          draft.activePanelId = targetPanelId;
          break;
        }

        case 'RESIZE_PANEL': {
          const { panelId, size } = action.payload;
          updatePanelInTree(draft.panel, panelId, (panel) => {
            panel.size = size;
          });
          break;
        }

        case 'PIN_PANEL': {
          const { panelId } = action.payload;
          const panel = findPanelById(draft.panel, panelId);
          if (panel) panel.pinned = true;
          break;
        }

        case 'UNPIN_PANEL': {
          const { panelId } = action.payload;
          const panel = findPanelById(draft.panel, panelId);
          if (panel) panel.pinned = false;
          break;
        }

        case 'SET_ACTIVE_PANEL': {
          draft.activePanelId = action.payload.panelId;
          break;
        }

        case 'TOGGLE_SEARCH_BARS': {
          draft.searchBarsHidden = !draft.searchBarsHidden;
          break;
        }

        case 'SET_SEARCHBAR_MODE': {
          const { panelId, mode } = action.payload;
          draft.searchBarModes[panelId] = mode;
          break;
        }

        // -----------------------------------------------------------------------
        // Favorites
        // -----------------------------------------------------------------------
        case 'TOGGLE_FAVORITE_LAYOUT': {
          const { layoutId } = action.payload;
          const favorites = draft.favoriteLayouts ?? [];
          const index = favorites.indexOf(layoutId);
          if (index === -1) {
            draft.favoriteLayouts = [...favorites, layoutId];
          } else {
            draft.favoriteLayouts = favorites.filter((id) => id !== layoutId);
          }
          break;
        }

        // -----------------------------------------------------------------------
        // Undo
        // -----------------------------------------------------------------------
        case 'POP_UNDO': {
          const lastUndo = draft.undoStack.pop();
          if (!lastUndo) break;

          const { tab, position, panelId } = lastUndo;

          // Check if panel still exists, otherwise use active panel
          const targetPanelId = isPanelExists(draft, panelId) ? panelId : draft.activePanelId;

          // Re-add the tab with correct panelId
          const restoredTab: Tab = { ...tab, panelId: targetPanelId };
          draft.tabs.push(restoredTab);

          // Add to panelTabs at original position (or end if position invalid)
          if (!draft.panelTabs[targetPanelId]) draft.panelTabs[targetPanelId] = [];
          const insertPos = Math.min(position, draft.panelTabs[targetPanelId].length);
          draft.panelTabs[targetPanelId].splice(insertPos, 0, restoredTab.id);

          // Update active states
          draft.activeTabIds[targetPanelId] = restoredTab.id;
          draft.activePanelId = targetPanelId;
          break;
        }

        // -----------------------------------------------------------------------
        // Rename Tab UI State
        // -----------------------------------------------------------------------
        case 'START_RENAME_TAB': {
          const { tabId } = action.payload;
          const tab = findTabById(draft.tabs, tabId);
          // Only allow rename if tab exists and is not locked
          if (tab && !tab.locked) {
            draft.renamingTabId = tabId;
          }
          break;
        }

        case 'CLEAR_RENAME_TAB': {
          draft.renamingTabId = null;
          break;
        }

        case 'RESET_WORKSPACE': {
          // Reset to initial state - used when clearing persisted storage
          const resetState = createInitialState();
          draft.tabs = resetState.tabs;
          draft.panel = resetState.panel;
          draft.panelTabs = resetState.panelTabs;
          draft.activeTabIds = resetState.activeTabIds;
          draft.activePanelId = resetState.activePanelId;
          draft.favoriteLayouts = resetState.favoriteLayouts;
          draft.theme = resetState.theme;
          draft.searchBarsHidden = resetState.searchBarsHidden;
          draft.undoStack = [];
          draft.searchBarModes = {};
          draft.renamingTabId = null;
          break;
        }

        case 'REFRESH_TAB': {
          const { tabId } = action.payload;
          const tab = findTabById(draft.tabs, tabId);

          // Guard: tab must exist
          if (!tab) break;

          // Guard: must have layout to refresh
          if (!tab.layoutId) break;

          // Regenerate mountKey to force React remount
          tab.mountKey = generateShortId();
          break;
        }
      }

      // Validate state consistency in development mode
      validateState(draft);
    });
  };
}

/**
 * Default prism reducer with standard configuration (maxTabs: 16).
 * For custom configuration, use createPrismReducer({ maxTabs: ... }).
 */
export const prismReducer = createPrismReducer();
