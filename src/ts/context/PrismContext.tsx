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
  createInitialState as createBaseState,
  type PrismState,
  type Action,
} from '@context/prismReducer';
import { useConfig } from '@context/ConfigContext';
import { generateShortId } from '@utils/uuid';
import { validateWorkspace } from '@utils/workspace';
import { logger } from '@utils/logger';
import { toastEmitter } from '@utils/toastEmitter';
import { toast } from 'sonner';
import { Toaster } from '@components/ui/toaster';
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
const STORAGE_VERSION = 1;

type WorkspaceStorageMeta = {
  serverSessionId?: string;
  version: number;
  timestamp: number;
};

type StoredWorkspace = {
  meta: WorkspaceStorageMeta;
  workspace: Partial<Workspace>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function parseStorageMeta(value: unknown): WorkspaceStorageMeta | null {
  if (!isRecord(value)) return null;

  const version = value.version;
  const timestamp = value.timestamp;
  const serverSessionId = value.serverSessionId;

  if (!isFiniteNumber(version) || !isFiniteNumber(timestamp)) return null;
  if (
    serverSessionId !== undefined &&
    serverSessionId !== null &&
    typeof serverSessionId !== 'string'
  ) {
    return null;
  }

  const normalizedServerSessionId =
    typeof serverSessionId === 'string' ? serverSessionId : undefined;

  return {
    version,
    timestamp,
    serverSessionId: normalizedServerSessionId,
  };
}

function unwrapStoredWorkspace(
  value: unknown
): { workspace: unknown; meta?: WorkspaceStorageMeta } | null {
  if (!isRecord(value)) return null;

  if ('workspace' in value) {
    const meta = parseStorageMeta(value.meta);
    if (!meta) return null;
    return { workspace: value.workspace, meta };
  }

  return { workspace: value };
}

function logStorageWarning(message: string, details?: unknown): void {
  if (details !== undefined) {
    logger.warn(message, details);
  } else {
    logger.warn(message);
  }
}

/** Get namespaced storage key for component */
function getStorageKey(componentId?: string): string {
  return componentId ? `${STORAGE_KEY_PREFIX}-${componentId}` : STORAGE_KEY_PREFIX;
}

function getStorage(type: PersistenceType): Storage | null {
  if (type === 'local') return localStorage;
  if (type === 'session') return sessionStorage;
  return null; // memory = no storage
}

function getWorkspace(
  type: PersistenceType,
  componentId?: string,
  serverSessionId?: string
): Partial<Workspace> | null {
  const storage = getStorage(type);
  if (!storage) return null;

  try {
    const stored = storage.getItem(getStorageKey(componentId));
    if (!stored) return null;

    const parsed = JSON.parse(stored) as unknown;
    const unwrapped = unwrapStoredWorkspace(parsed);
    if (!unwrapped) {
      logStorageWarning('Stored workspace has invalid structure. Clearing storage.');
      clearWorkspace(type, componentId);
      return null;
    }

    if (unwrapped.meta) {
      if (unwrapped.meta.version !== STORAGE_VERSION) {
        logStorageWarning('Stored workspace version mismatch. Clearing storage.', {
          expected: STORAGE_VERSION,
          found: unwrapped.meta.version,
        });
        clearWorkspace(type, componentId);
        return null;
      }

      if (
        serverSessionId &&
        unwrapped.meta.serverSessionId &&
        unwrapped.meta.serverSessionId !== serverSessionId
      ) {
        logStorageWarning('Stored workspace server session mismatch. Clearing storage.', {
          expected: serverSessionId,
          found: unwrapped.meta.serverSessionId,
        });
        clearWorkspace(type, componentId);
        return null;
      }
    }

    const validation = validateWorkspace(unwrapped.workspace);
    if (!validation.ok) {
      const { errors } = validation as { ok: false; errors: string[] };
      logStorageWarning('Stored workspace failed validation. Clearing storage.', errors);
      clearWorkspace(type, componentId);
      return null;
    }

    return validation.workspace;
  } catch {
    logStorageWarning('Failed to parse stored workspace JSON. Clearing storage.');
    clearWorkspace(type, componentId);
    return null;
  }
}

function setWorkspace(
  type: PersistenceType,
  workspace: Partial<Workspace>,
  componentId?: string,
  serverSessionId?: string
): void {
  const storage = getStorage(type);
  if (!storage) return;

  try {
    const payload: StoredWorkspace = {
      meta: {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        serverSessionId,
      },
      workspace,
    };
    storage.setItem(getStorageKey(componentId), JSON.stringify(payload));
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

function buildInitialState(
  storedWorkspace?: Partial<Workspace>,
  initialLayout?: string,
  registeredLayouts?: RegisteredLayouts
): PrismState {
  const baseState = createBaseState();
  // Persisted state takes precedence over initialLayout
  if (storedWorkspace?.tabs?.length) {
    // Hydrate tabs with mountKey if missing (for tabs restored from storage)
    // Validate layoutIds against registeredLayouts to handle removed layouts
    const hydratedTabs = storedWorkspace.tabs.map((tab) => {
      const layoutId = tab.layoutId ?? undefined;
      const isLayoutValid = layoutId && registeredLayouts && layoutId in registeredLayouts;

      // Warn if tab references a layout that no longer exists
      if (layoutId && !isLayoutValid) {
        logger.warn(
          `Tab "${tab.name}" references unregistered layout "${layoutId}". Layout will be cleared.`
        );
      }

      return {
        ...tab,
        // Clear layoutId and related fields if layout no longer exists
        layoutId: isLayoutValid ? layoutId : undefined,
        layoutOption: isLayoutValid ? (tab.layoutOption ?? undefined) : undefined,
        layoutParams: isLayoutValid ? (tab.layoutParams ?? undefined) : undefined,
        icon: tab.icon ?? undefined,
        style: tab.style ?? undefined,
        mountKey: tab.mountKey ?? generateShortId(),
      };
    });
    return {
      tabs: hydratedTabs,
      panel: storedWorkspace.panel ?? baseState.panel,
      panelTabs: storedWorkspace.panelTabs ?? baseState.panelTabs,
      activeTabIds: storedWorkspace.activeTabIds ?? baseState.activeTabIds,
      activePanelId: storedWorkspace.activePanelId ?? baseState.activePanelId,
      favoriteLayouts: storedWorkspace.favoriteLayouts ?? baseState.favoriteLayouts,
      theme: storedWorkspace.theme ?? baseState.theme,
      searchBarsHidden: storedWorkspace.searchBarsHidden ?? baseState.searchBarsHidden,
      undoStack: [], // Never restore undo stack from storage
      searchBarModes: {}, // Ephemeral UI state, never persist
      renamingTabId: null, // Ephemeral UI state
    };
  }

  // Fresh state - apply initialLayout if provided and valid
  if (initialLayout && registeredLayouts?.[initialLayout]) {
    const layoutInfo = registeredLayouts[initialLayout];
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

  // Default: return baseState which already has one tab
  // This guarantees there's always at least one tab on initial load
  return baseState;
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
  const {
    persistence,
    persistenceType,
    componentId,
    serverSessionId,
    initialLayout,
    registeredLayouts,
    maxTabs,
  } = useConfig();

  // Create reducer with maxTabs config for global tab limit enforcement
  const reducer = useMemo(() => createPrismReducer({ maxTabs }), [maxTabs]);

  const [state, dispatch] = useReducer(
    reducer,
    {
      persistence,
      persistenceType,
      componentId,
      serverSessionId,
      initialLayout,
      registeredLayouts,
    },
    (deps) => {
      // Only load from storage if persistence is enabled
      const stored = deps.persistence
        ? getWorkspace(deps.persistenceType, deps.componentId, deps.serverSessionId)
        : null;
      return buildInitialState(stored ?? undefined, deps.initialLayout, deps.registeredLayouts);
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

  // Safe unmount wrapper to prevent race conditions
  const safeUnmountPortal = useCallback((node: HtmlPortalNode | undefined) => {
    if (!node) return;
    try {
      node.unmount();
    } catch {
      // Portal already unmounted - safe to ignore during cleanup race conditions
    }
  }, []);

  // Cleanup stale portal nodes when tabs are removed
  useEffect(() => {
    const currentIds = new Set(state.tabs.map((t) => t.id));
    for (const id of portalNodesRef.current.keys()) {
      if (!currentIds.has(id)) {
        const node = portalNodesRef.current.get(id);
        safeUnmountPortal(node);
        portalNodesRef.current.delete(id);
      }
    }
  }, [state.tabs, safeUnmountPortal]);

  // Cleanup all portal nodes on unmount
  useEffect(() => {
    return () => {
      for (const node of portalNodesRef.current.values()) {
        safeUnmountPortal(node);
      }
      portalNodesRef.current.clear();
    };
  }, [safeUnmountPortal]);

  // ================================================================================
  // TOAST EVENT SUBSCRIPTION
  // ================================================================================

  // Subscribe to toast events emitted from reducer
  useEffect(() => {
    const unsubscribe = toastEmitter.subscribe(({ type, message, description }) => {
      toast[type](message, {
        description,
        cancel: {
          label: 'Dismiss',
          onClick: () => {},
        },
      });
    });
    return unsubscribe;
  }, []);

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

  // Note: "Ensure at least one tab" logic is handled by buildInitialState.
  // The base state always has one tab, and we only restore from storage
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

    setWorkspace(persistenceType, workspace, componentId, serverSessionId);
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
    serverSessionId,
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

  return (
    <PrismContext.Provider value={value}>
      <Toaster />
      {children}
    </PrismContext.Provider>
  );
}
