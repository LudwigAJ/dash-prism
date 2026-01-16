import React, {
  createContext,
  useReducer,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import { createHtmlPortalNode, HtmlPortalNode } from 'react-reverse-portal';
import {
  createPrismReducer,
  initialState,
  type PrismState,
  type Action,
} from '@context/prismReducer';
import { useConfig } from '@context/ConfigContext';
import { generateShortId } from '@utils/uuid';
import type {
  Workspace,
  PersistenceType,
  TabId,
  DashComponent,
  Tab,
  RegisteredLayouts,
} from '@types';

// ========== Persistence Helpers ==========

const STORAGE_KEY_PREFIX = 'prism-workspace';

/** Get namespaced storage key for component */
function getStorageKey(componentId?: string): string {
  return componentId ? `${STORAGE_KEY_PREFIX}-${componentId}` : STORAGE_KEY_PREFIX;
}

function getStorage(type: PersistenceType): Storage | null {
  if (type === 'local') return localStorage;
  if (type === 'session') return sessionStorage;
  return null; // memory = no storage
}

function getWorkspace(type: PersistenceType, componentId?: string): Partial<Workspace> | null {
  const storage = getStorage(type);
  if (!storage) return null;

  try {
    const stored = storage.getItem(getStorageKey(componentId));
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setWorkspace(
  type: PersistenceType,
  workspace: Partial<Workspace>,
  componentId?: string
): void {
  const storage = getStorage(type);
  if (!storage) return;

  try {
    storage.setItem(getStorageKey(componentId), JSON.stringify(workspace));
  } catch {
    // Storage full or unavailable
  }
}

function clearWorkspace(type: PersistenceType, componentId?: string): void {
  const storage = getStorage(type);
  if (!storage) return;

  try {
    storage.removeItem(getStorageKey(componentId));
  } catch {
    // Ignore
  }
}

// ========== Helpers ==========

function createInitialState(
  storedWorkspace?: Partial<Workspace>,
  initialLayout?: string,
  registeredLayouts?: RegisteredLayouts
): PrismState {
  // Persisted state takes precedence over initialLayout
  if (storedWorkspace?.tabs?.length) {
    // Hydrate tabs with mountKey if missing (for tabs restored from storage)
    const hydratedTabs = storedWorkspace.tabs.map((tab) => ({
      ...tab,
      mountKey: tab.mountKey ?? generateShortId(),
    }));
    return {
      tabs: hydratedTabs,
      panel: storedWorkspace.panel ?? initialState.panel,
      panelTabs: storedWorkspace.panelTabs ?? initialState.panelTabs,
      activeTabIds: storedWorkspace.activeTabIds ?? initialState.activeTabIds,
      activePanelId: storedWorkspace.activePanelId ?? initialState.activePanelId,
      favoriteLayouts: storedWorkspace.favoriteLayouts ?? initialState.favoriteLayouts,
      theme: storedWorkspace.theme ?? initialState.theme,
      searchBarsHidden: storedWorkspace.searchBarsHidden ?? initialState.searchBarsHidden,
      undoStack: [], // Never restore undo stack from storage
      searchBarModes: {}, // Ephemeral UI state, never persist
      renamingTabId: null, // Ephemeral UI state
    };
  }

  // Fresh state - apply initialLayout if provided and valid
  if (initialLayout && registeredLayouts?.[initialLayout]) {
    const layoutInfo = registeredLayouts[initialLayout];
    const baseState = { ...initialState };
    // Update the first tab with the initial layout
    if (baseState.tabs.length > 0) {
      baseState.tabs = [
        {
          ...baseState.tabs[0],
          layoutId: initialLayout,
          name: layoutInfo.name,
        },
      ];
    }
    return baseState;
  }

  // Default: return initialState which already has one tab
  // This guarantees there's always at least one tab on initial load
  return initialState;
}

// ========== Context ==========

type PrismContextValue = {
  // State & dispatch
  state: PrismState;
  dispatch: React.Dispatch<Action>;
  setProps?: (props: Record<string, unknown>) => void;
  clearPersistedState: () => void;
  // Portal management
  getPortalNode: (tabId: TabId) => HtmlPortalNode | undefined;
  // Modal actions
  openInfoModal: (tab: Tab) => void;
  closeInfoModal: () => void;
  openHelpModal: () => void;
  closeHelpModal: () => void;
  openSetIconModal: (tab: Tab) => void;
  closeSetIconModal: () => void;
  // Modal state
  infoModalTab: Tab | null;
  helpModalOpen: boolean;
  setIconModalTab: Tab | null;
};

export const PrismContext = createContext<PrismContextValue | null>(null);

// ========== Provider ==========

type PrismProviderProps = {
  children: React.ReactNode;
  persistenceType?: PersistenceType;
  updateWorkspace?: Partial<Workspace>;
  setProps?: (props: Record<string, any>) => void;
};

export function PrismProvider({ children, updateWorkspace, setProps }: PrismProviderProps) {
  // Initialize from storage on mount
  const { persistence, persistenceType, componentId, initialLayout, registeredLayouts, maxTabs } =
    useConfig();

  // Create reducer with maxTabs config for global tab limit enforcement
  const reducer = useMemo(() => createPrismReducer({ maxTabs }), [maxTabs]);

  const [state, dispatch] = useReducer(
    reducer,
    { persistence, persistenceType, componentId, initialLayout, registeredLayouts },
    (deps) => {
      // Only load from storage if persistence is enabled
      const stored = deps.persistence ? getWorkspace(deps.persistenceType, deps.componentId) : null;
      return createInitialState(stored ?? undefined, deps.initialLayout, deps.registeredLayouts);
    }
  );

  // ================================================================================
  // MODAL STATE (not persisted)
  // ================================================================================

  const [infoModalTab, setInfoModalTab] = useState<Tab | null>(null);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [setIconModalTab, setSetIconModalTab] = useState<Tab | null>(null);

  // Modal open/close handlers
  const openInfoModal = useCallback((tab: Tab) => setInfoModalTab(tab), []);
  const closeInfoModal = useCallback(() => setInfoModalTab(null), []);
  const openHelpModal = useCallback(() => setHelpModalOpen(true), []);
  const closeHelpModal = useCallback(() => setHelpModalOpen(false), []);
  const openSetIconModal = useCallback((tab: Tab) => setSetIconModalTab(tab), []);
  const closeSetIconModal = useCallback(() => setSetIconModalTab(null), []);

  // ================================================================================
  // PORTAL NODE MANAGEMENT (for react-reverse-portal)
  // ================================================================================

  // Portal nodes stored in ref (mutations don't trigger re-renders)
  const portalNodesRef = useRef<Map<TabId, HtmlPortalNode>>(new Map());

  // Lazy initialization: create portal node on first access if tab exists
  // This is synchronous - no loading flash on new tabs
  const getPortalNode = useCallback(
    (tabId: TabId): HtmlPortalNode | undefined => {
      // Guard: only create for tabs that exist
      const tabExists = state.tabs.some((t) => t.id === tabId);
      if (!tabExists) return undefined;

      // Lazy initialization pattern
      let node = portalNodesRef.current.get(tabId);
      if (!node) {
        node = createHtmlPortalNode({
          attributes: { class: 'prism-portal-node h-full w-full' },
        });
        portalNodesRef.current.set(tabId, node);
      }
      return node;
    },
    [state.tabs]
  );

  // Cleanup stale portal nodes when tabs are removed
  useEffect(() => {
    const currentIds = new Set(state.tabs.map((t) => t.id));
    for (const id of portalNodesRef.current.keys()) {
      if (!currentIds.has(id)) {
        portalNodesRef.current.delete(id);
      }
    }
  }, [state.tabs]);

  // ================================================================================
  // EFFECTS FOR SYNCING WITH DASH PROPS
  // ================================================================================

  // ===== SYNC_WORKSPACE FROM updateWorkspace (Dash → Prism) =====
  // When developer sets updateWorkspace via callback, immediately sync state
  useEffect(() => {
    if (updateWorkspace) {
      dispatch({ type: 'SYNC_WORKSPACE', payload: updateWorkspace });
    }
  }, [updateWorkspace]);

  // Note: "Ensure at least one tab" logic is handled by createInitialState.
  // The initialState always has one tab, and we only restore from storage
  // if storedWorkspace.tabs has items. This eliminates the need for a
  // useEffect that dispatches ADD_TAB with setTimeout.

  // ===== UPDATE readWorkspace (Prism → Dash) =====
  // Handled by useDashSync hook: immediate on mount, 500ms debounce thereafter

  // ===== AUTO-SAVE TO STORAGE =====
  // Save state changes to storage based on persistence mode
  useEffect(() => {
    // Skip if persistence is disabled or using memory mode
    if (!persistence || persistenceType === 'memory') return;

    const workspace: Partial<Workspace> = {
      tabs: state.tabs,
      panel: state.panel,
      panelTabs: state.panelTabs,
      activeTabIds: state.activeTabIds,
      activePanelId: state.activePanelId,
      favoriteLayouts: state.favoriteLayouts,
      searchBarsHidden: state.searchBarsHidden,
    };

    setWorkspace(persistenceType, workspace, componentId);
  }, [
    state.tabs,
    state.panel,
    state.panelTabs,
    state.activeTabIds,
    state.activePanelId,
    state.favoriteLayouts,
    state.searchBarsHidden,
    persistence,
    persistenceType,
    componentId,
  ]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      setProps,
      clearPersistedState: () => clearWorkspace(persistenceType, componentId),
      // Portal management
      getPortalNode,
      // Modal state & actions
      infoModalTab,
      helpModalOpen,
      setIconModalTab,
      openInfoModal,
      closeInfoModal,
      openHelpModal,
      closeHelpModal,
      openSetIconModal,
      closeSetIconModal,
    }),
    [
      state,
      dispatch,
      setProps,
      persistenceType,
      componentId,
      getPortalNode,
      infoModalTab,
      helpModalOpen,
      setIconModalTab,
      openInfoModal,
      closeInfoModal,
      openHelpModal,
      closeHelpModal,
      openSetIconModal,
      closeSetIconModal,
    ]
  );

  return <PrismContext.Provider value={value}>{children}</PrismContext.Provider>;
}
