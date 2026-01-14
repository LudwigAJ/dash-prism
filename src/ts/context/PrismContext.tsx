import React, { createContext, useReducer, useEffect, useMemo, useState, useCallback } from 'react';
import { prismReducer, initialState, type PrismState, type Action } from '@context/prismReducer';
import { useConfig } from '@context/ConfigContext';
import type {
  Workspace,
  PersistenceType,
  TabId,
  DashComponent,
  Tab,
  RegisteredLayouts,
} from '@types';
import { getLeafPanelIds } from '@utils/panels';

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
    return {
      tabs: storedWorkspace.tabs ?? initialState.tabs,
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
          loading: true, // Trigger layout fetch
        },
      ];
    }
    return baseState;
  }

  return initialState;
}

// ========== Context ==========

type PrismContextValue = {
  // State & dispatch
  state: PrismState;
  dispatch: React.Dispatch<Action>;
  setProps?: (props: Record<string, unknown>) => void;
  clearPersistedState: () => void;
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
  const { persistenceType, componentId, initialLayout, registeredLayouts } = useConfig();
  const [state, dispatch] = useReducer(
    prismReducer,
    { persistenceType, componentId, initialLayout, registeredLayouts },
    (deps) => {
      const stored = getWorkspace(deps.persistenceType, deps.componentId);
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
  // EFFECTS FOR SYNCING WITH DASH PROPS
  // ================================================================================

  // ===== SYNC_WORKSPACE FROM updateWorkspace (Dash → Prism) =====
  // When developer sets updateWorkspace via callback, immediately sync state
  useEffect(() => {
    if (updateWorkspace) {
      dispatch({ type: 'SYNC_WORKSPACE', payload: updateWorkspace });
    }
  }, [updateWorkspace]);

  // ===== ENSURE AT LEAST ONE TAB hook =====
  useEffect(() => {
    const leafPanelIds = getLeafPanelIds(state.panel);
    const hasNoTabs = leafPanelIds.every((panelId) => !state.panelTabs[panelId]?.length);

    if (hasNoTabs && leafPanelIds.length > 0) {
      // Use setTimeout to avoid dispatching during render
      const timer = setTimeout(() => {
        dispatch({ type: 'ADD_TAB', payload: { panelId: leafPanelIds[0] } });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [state.panel, state.panelTabs, dispatch]);

  // ===== UPDATE readWorkspace (Prism → Dash) =====
  // Handled by useDashSync hook: immediate on mount, 500ms debounce thereafter

  // ===== AUTO-SAVE TO STORAGE =====
  // Save state changes to storage based on persistence mode
  useEffect(() => {
    if (persistenceType === 'memory') return; // No persistence needed

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
    persistenceType,
    componentId,
  ]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      setProps,
      clearPersistedState: () => clearWorkspace(persistenceType, componentId),
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
