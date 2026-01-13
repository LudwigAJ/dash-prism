import React, { createContext, useReducer, useEffect, useMemo, useState, useCallback } from 'react';
import { prismReducer, initialState, type PrismState, type Action } from '@context/prismReducer';
import { useConfig } from '@context/ConfigContext';
import type { Workspace, PersistenceType, TabId, DashComponent, Tab } from '@types';
import { getLeafPanelIds } from '@utils/panels';

// ========== Persistence Helpers ==========

const STORAGE_KEY = 'prism-workspace';

function getStorage(type: PersistenceType): Storage | null {
  if (type === 'local') return localStorage;
  if (type === 'session') return sessionStorage;
  return null; // memory = no storage
}

function getWorkspace(type: PersistenceType): Partial<Workspace> | null {
  const storage = getStorage(type);
  if (!storage) return null;

  try {
    const stored = storage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setWorkspace(type: PersistenceType, workspace: Partial<Workspace>): void {
  const storage = getStorage(type);
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // Storage full or unavailable
  }
}

function clearWorkspace(type: PersistenceType): void {
  const storage = getStorage(type);
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

// ========== Helpers ==========

function createInitialState(storedWorkspace?: Partial<Workspace>): PrismState {
  if (!storedWorkspace) {
    return initialState;
  }

  // Merge stored workspace with initialState defaults
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
  };
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
  writeWorkspace?: Partial<Workspace>;
  setProps?: (props: Record<string, any>) => void;
};

export function PrismProvider({ children, writeWorkspace, setProps }: PrismProviderProps) {
  // Initialize from storage on mount
  const { persistenceType } = useConfig();
  const [state, dispatch] = useReducer(prismReducer, persistenceType, (persistType) => {
    const stored = getWorkspace(persistenceType);
    return createInitialState(stored ?? undefined);
  });

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

  // ===== SYNC_WORKSPACE FROM writeWorkspace (Dash → Prism) =====
  // When developer sets writeWorkspace via callback, immediately sync state
  useEffect(() => {
    if (writeWorkspace) {
      dispatch({ type: 'SYNC_WORKSPACE', payload: writeWorkspace });
    }
  }, [writeWorkspace]);

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

    setWorkspace(persistenceType, workspace);
  }, [
    state.tabs,
    state.panel,
    state.panelTabs,
    state.activeTabIds,
    state.activePanelId,
    state.favoriteLayouts,
    state.searchBarsHidden,
    persistenceType,
  ]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      setProps,
      clearPersistedState: () => clearWorkspace(persistenceType),
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
