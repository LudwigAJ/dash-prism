import type { LayoutId, PanelId, TabId, RegisteredLayouts, Workspace } from '@types';
import type { Storage } from 'redux-persist';

/**
 * Holds the persisted workspace slice: the `Workspace` that Dash sees, with the
 * bookkeeping that stays in the browser.
 *
 * Note: `theme` is NOT included here - it's controlled by Dash via props
 * and accessed through ConfigContext. This keeps workspace state focused
 * on layout/tab data only.
 *
 * Note: Undo/redo is handled by redux-undo wrapping this slice.
 * The undo history is ephemeral (not persisted) and resets on page reload.
 */
export interface WorkspaceState extends Workspace {
  favoriteLayouts: LayoutId[];
  searchBarsHidden: boolean;
  /**
   * The `serverSessionId` that this workspace was last reconciled against.
   * Compared on rehydrate; see `reconcileWithServer`.
   */
  serverSessionId?: string;
}

/** Names the mode of the search bar of a panel. */
export type SearchBarMode = 'hidden' | 'display' | 'search' | 'params' | 'options';

/** Holds the ui state. The store never persists it, so a reload starts from initialUiState. */
export interface UiState {
  searchBarModes: Record<PanelId, SearchBarMode>;
  // Command requests: `renamingTabId`, `layoutSelectionRequest` and `searchFocusPanelId`.
  // A producer sets the request. Only the component that owns the target consumes it, and it
  // clears the request after it handled it: the TabBar of the panel that holds the tab for a
  // rename, and the SearchBar of the panel for the other two. A component that does not own
  // the target leaves the request alone. If it cleared it, the owner could miss the request.
  renamingTabId: TabId | null;
  /** A layout the user picked on the empty-tab screen of `tabId`. */
  layoutSelectionRequest: { tabId: TabId; layoutId: LayoutId } | null;
  /** The panel whose search bar must take the focus. */
  searchFocusPanelId: PanelId | null;
  // Which modal is open, and for which tab.
  infoModalTabId: TabId | null;
  helpModalOpen: boolean;
  setIconModalTabId: TabId | null;
  /**
   * Set by the reconcile middleware when loading the persisted workspace closed
   * tabs whose layouts no longer exist. Rendered once as a toast by
   * `<LoadNotice />` (which then clears it) — the reducer cannot toast during
   * REHYDRATE because nothing has subscribed to toasts yet at that point.
   */
  loadNotice: { closedTabs: number } | null;
}

/** Holds the settings that Prism passes to createPrismStore. */
export interface StoreConfig {
  componentId: string;
  serverSessionId?: string;
  persistenceType: 'local' | 'session' | 'memory';
  /**
   * Tab limit for the whole workspace (values below 1 mean unlimited). Pass a
   * getter to let the limit change after the store exists: Prism passes a ref
   * getter so a Dash callback that updates `maxTabs` does not rebuild the
   * store (and lose the undo history) the way re-creating it would.
   */
  maxTabs: number | (() => number);
  /** Panel limit for the whole workspace, resolved from the prop (values below 1 mean unlimited). Accepts a getter like `maxTabs`. */
  maxPanels: number | (() => number);
  setProps?: (props: Record<string, unknown>) => void;
  /** Getter for registered layouts — used by thunks to check constraints like allowMultiple */
  getRegisteredLayouts?: () => RegisteredLayouts;
  /**
   * Overrides the redux-persist storage engine. When omitted the engine is
   * chosen from `persistenceType`. Intended for tests that need to seed or
   * inspect persisted data without a browser.
   */
  storage?: Storage;
}

/** Holds the extra argument of the thunks: the live limits, the layouts and the toast channel. */
export interface ThunkExtra {
  /** Live tab limit, read at dispatch time so prop changes apply immediately. */
  getMaxTabs: () => number;
  /** Live panel limit, read at dispatch time like the tab limit. */
  getMaxPanels: () => number;
  getRegisteredLayouts: () => RegisteredLayouts;
  /** Shows a toast in the Toaster of this Prism instance, and logs `logDetails` or the message. */
  notify: (level: 'info' | 'warning' | 'error', message: string, logDetails?: string) => void;
}
