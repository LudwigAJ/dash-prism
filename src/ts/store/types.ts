// src/ts/store/types.ts
import type { Tab, Panel, PanelId, TabId } from '@types';

/**
 * Persisted workspace state - saved to localStorage/sessionStorage
 *
 * Note: `theme` is NOT included here - it's controlled by Dash via props
 * and accessed through ConfigContext. This keeps workspace state focused
 * on layout/tab data only.
 *
 * Note: Undo/redo is handled by redux-undo wrapping this slice.
 * The undo history is ephemeral (not persisted) and resets on page reload.
 */
export type WorkspaceState = {
  tabs: Tab[];
  panel: Panel;
  panelTabs: Record<PanelId, TabId[]>;
  activeTabIds: Record<PanelId, TabId>;
  activePanelId: PanelId;
  favoriteLayouts: string[];
  searchBarsHidden: boolean;
};

/**
 * Ephemeral UI state - never persisted
 */
export type SearchBarMode = 'hidden' | 'display' | 'search' | 'params' | 'options';

export type UiState = {
  searchBarModes: Record<PanelId, SearchBarMode>;
  renamingTabId: TabId | null;
  // Modal state (moved from PrismContext useState)
  infoModalTabId: TabId | null;
  helpModalOpen: boolean;
  setIconModalTabId: TabId | null;
};

/**
 * Store configuration passed at runtime
 */
export type StoreConfig = {
  componentId?: string;
  serverSessionId?: string;
  persistenceType: 'local' | 'session' | 'memory';
  maxTabs: number;
  setProps?: (props: Record<string, unknown>) => void;
};

/**
 * Thunk extra argument - injected config available in async thunks
 */
export type ThunkExtra = {
  maxTabs: number;
};
