import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ConfigProvider, useConfig } from '@context/ConfigContext';
import { PortalProvider } from '@context/PortalContext';
import { DndProvider } from '@context/DndProvider';
import { WorkspaceView } from '@components/WorkspaceView';
import { ErrorBoundary } from '@components/ErrorBoundary';
import { Toaster } from '@components/ui/toaster';
import {
  createPrismStore,
  syncWorkspace,
  updateTabLayout,
  selectTabs,
  useAppDispatch,
  useAppSelector,
  selectLoadNotice,
  clearLoadNotice,
  getWorkspaceStorageKey,
  resolvePersistenceType,
} from '@store';
import { subscribeToToasts } from '@utils/toastEmitter';
import { toast } from 'sonner';
import type {
  RegisteredLayouts,
  Theme,
  Size,
  Workspace,
  StatusBarPosition,
  PersistenceType,
} from '@types';
import '../global.css';
import { DashComponentProps } from 'props';

/** Clear workspace from storage (used by workspace-level error boundary) */
function clearWorkspaceStorage(persistenceType: PersistenceType, componentId?: string): void {
  const key = getWorkspaceStorageKey(componentId);
  try {
    if (persistenceType === 'local') localStorage.removeItem(key);
    else if (persistenceType === 'session') sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Prism is an advanced multi-panel workspace manager for Plotly Dash.
 * It provides dynamic layout management with drag-and-drop tab organization,
 * multi-panel splits, and persistent workspace state across sessions.
 */
export type PrismProps = {
  /**
   * Unique ID to identify this component in Dash callbacks.
   */
  id?: string;

  /**
   * Fingerprint of the server-side layout registry, stored with the persisted
   * workspace. On load, tabs whose layout is no longer in registeredLayouts are
   * closed instead of showing an error; the rest of the workspace is kept and
   * the stored fingerprint is updated so the registry change is recorded.
   * dash_prism.init() derives it from the registered layout IDs (stable across
   * workers and restarts). Which tabs are closed depends only on
   * registeredLayouts (nothing is closed while no layout is registered at
   * all); setting this by hand merely changes the recorded fingerprint. Read
   * once when the component mounts.
   */
  serverSessionId?: string;

  // persisted props
  // tabs: Record<PanelId, Tab[]>;
  // panels: Panel;
  // activePanelId: PanelId;
  // activeTabIds: Record<PanelId, string>;

  /**
   * Child components (typically PrismContent instances).
   */
  children?: React.ReactNode;

  /**
   * Registry of available layouts that can be rendered in tabs.
   * Maps layout IDs to their configuration (name, params, options, etc).
   * This is automatically populated by dash_prism.init().
   */
  registeredLayouts?: RegisteredLayouts;

  /**
   * Visual theme for the workspace.
   */
  theme?: Theme;

  /**
   * Size variant affecting spacing and typography.
   */
  size?: Size;

  /**
   * Maximum number of tabs allowed per panel.
   */
  maxTabs?: number;

  /**
   * Placeholder text shown in the search bar.
   */
  searchBarPlaceholder?: string;

  /**
   * Timeout in seconds for layout loading.
   * If children don't arrive within this time after a layout is selected,
   * an error state is shown. Default is 30 seconds.
   */
  layoutTimeout?: number;

  /**
   * Position of the status bar relative to the workspace.
   */
  statusBarPosition?: StatusBarPosition;

  /**
   * Read-only workspace state from Dash.
   * Updates trigger re-hydration of the internal state.
   */
  readWorkspace?: Workspace; // OUTPUT: Prism -> Dash (current state)

  /**
   * Write-only output property.
   * Workspace state changes are written here for Dash callbacks.
   */
  updateWorkspace?: Partial<Workspace>;

  /**
   * Array of PrismAction components to display in the status bar.
   * Each PrismAction has its own id and n_clicks for individual callbacks.
   */
  actions?: JSX.Element[];

  /**
   * Whether to persist workspace state in the browser. When false (the default)
   * nothing is written to storage and persistence_type is ignored.
   */
  persistence?: boolean;

  /**
   * Where to persist workspace state when persistence is true: 'local' for
   * localStorage (survives browser restarts), 'session' for sessionStorage
   * (current browser tab only), or 'memory' for no storage. Defaults to 'memory',
   * so set this together with persistence=True.
   */
  persistence_type?: PersistenceType;

  /**
   * Layout ID to automatically load in the first tab on initial load.
   * Must match a registered layout ID. If persistence is enabled and a saved
   * workspace exists, the persisted state takes precedence over initialLayout.
   */
  initialLayout?: string;

  /**
   * Whether opening a new tab should automatically focus the SearchBar and
   * open the dropdown. If true (default), new tabs instantly show the layout
   * dropdown. If false, users must click the SearchBar to see the dropdown.
   */
  newTabOpensDropdown?: boolean;

  /**
   * CSS class name(s) to add to the root container.
   */
  className?: string;

  /**
   * Inline CSS styles for the root container.
   */
  style?: Record<string, string>;
} & DashComponentProps;

/**
 * Inner component that uses ConfigContext to create the Redux store.
 * Must be inside ConfigProvider to access config values.
 */
function PrismInner({
  actions,
  children,
  updateWorkspace,
}: {
  actions: JSX.Element[];
  children?: React.ReactNode;
  updateWorkspace?: Partial<Workspace>;
}) {
  const config = useConfig();

  // Use refs for setProps and registeredLayouts to avoid recreating the store
  // when their object references change. This is critical: when dashSyncMiddleware
  // calls setProps(), Dash may re-render with a new setProps reference. Without
  // this ref, the store would be recreated with fresh initial state.
  const setPropsRef = useRef(config.setProps);
  useEffect(() => {
    setPropsRef.current = config.setProps;
  }, [config.setProps]);

  const registeredLayoutsRef = useRef(config.registeredLayouts);
  useEffect(() => {
    registeredLayoutsRef.current = config.registeredLayouts;
  }, [config.registeredLayouts]);

  // Stable wrappers that always access the latest values via refs
  const stableSetProps = useMemo(
    () => (props: Record<string, unknown>) => setPropsRef.current?.(props),
    []
  );
  const stableGetRegisteredLayouts = useMemo(() => () => registeredLayoutsRef.current, []);

  // Create store with config values - memoized to prevent recreation
  // Note: stableSetProps and stableGetRegisteredLayouts are stable (empty deps),
  // so they won't cause store recreation
  const { store, persistor, cleanup } = useMemo(
    () =>
      createPrismStore({
        componentId: config.componentId,
        serverSessionId: config.serverSessionId,
        persistenceType: config.persistenceType,
        maxTabs: config.maxTabs,
        setProps: stableSetProps,
        getRegisteredLayouts: stableGetRegisteredLayouts,
      }),
    [
      config.componentId,
      config.serverSessionId,
      config.persistenceType,
      config.maxTabs,
      stableSetProps,
      stableGetRegisteredLayouts,
    ]
  );

  // Clean up middleware resources on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Subscribe to toast events
  useEffect(() => {
    const unsubscribe = subscribeToToasts(({ type, message, description }) => {
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

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <PortalProvider>
          <UpdateWorkspaceSync updateWorkspace={updateWorkspace} />
          <InitialLayoutLoader />
          <DndProvider>
            <Toaster />
            <LoadNotice />
            <WorkspaceView actions={actions}>{children}</WorkspaceView>
          </DndProvider>
        </PortalProvider>
      </PersistGate>
    </Provider>
  );
}

/**
 * Shows the "tabs closed on load" toast recorded by the reconcile middleware.
 * Rendered as a sibling *after* <Toaster /> so sonner has subscribed by the time
 * this effect runs (sibling effects run in tree order); the middleware itself
 * fires during REHYDRATE, before anything here is mounted.
 */
function LoadNotice() {
  const notice = useAppSelector(selectLoadNotice);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!notice) return;
    const n = notice.closedTabs;
    toast.info(`Closed ${n} tab${n === 1 ? '' : 's'} whose layout is no longer available`, {
      cancel: { label: 'Dismiss', onClick: () => {} },
    });
    dispatch(clearLoadNotice());
  }, [notice, dispatch]);

  return null;
}

/**
 * Component to sync updateWorkspace from Dash props to Redux.
 * Separated to avoid re-rendering the entire tree on updateWorkspace changes.
 */
function UpdateWorkspaceSync({ updateWorkspace }: { updateWorkspace?: Partial<Workspace> }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (updateWorkspace) {
      dispatch(syncWorkspace(updateWorkspace));
    }
  }, [updateWorkspace, dispatch]);

  return null;
}

/**
 * Applies the initialLayout config to the first tab on fresh workspaces.
 * Runs once after rehydration. If persistence restored a saved workspace
 * (tabs already have layouts), this is a no-op.
 */
function InitialLayoutLoader() {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const { initialLayout, registeredLayouts } = useConfig();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;
    if (!initialLayout) return;

    const layout = registeredLayouts[initialLayout];
    if (!layout) return;

    // Only apply to a fresh workspace: single tab with no layout
    if (tabs.length === 1 && !tabs[0].layoutId) {
      appliedRef.current = true;
      dispatch(
        updateTabLayout({
          tabId: tabs[0].id,
          layoutId: initialLayout,
          name: layout.name,
        })
      );
    }
  }, [tabs, initialLayout, registeredLayouts, dispatch]);

  return null;
}

/**
 * Advanced multi-panel workspace manager for Plotly Dash.
 * Provides dynamic layout management with drag-and-drop tab organization,
 * multi-panel splits, and persistent workspace state across sessions.
 */
export function Prism({
  id,
  serverSessionId,
  setProps,
  registeredLayouts = {},
  theme = 'light',
  size = 'md',
  maxTabs = 16,
  statusBarPosition = 'bottom',
  searchBarPlaceholder = 'Search layouts...',
  layoutTimeout = 30,
  actions = [],
  persistence = false,
  persistence_type = 'memory',
  initialLayout,
  newTabOpensDropdown = true,
  updateWorkspace,
  className,
  style,
  children,
}: PrismProps) {
  // `persistence` is the on/off switch; `persistence_type` only applies when it is on.
  // Resolve once here so every consumer (store, error boundary) sees the same answer.
  const persistenceType = resolvePersistenceType(persistence, persistence_type);

  // Create stable callback for clearing storage from error boundary
  const handleClearStorage = useCallback(() => {
    clearWorkspaceStorage(persistenceType, id);
  }, [persistenceType, id]);

  useEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.getAttribute('data-prism-theme');
    root.setAttribute('data-prism-theme', theme);

    return () => {
      if (previousTheme === null) {
        root.removeAttribute('data-prism-theme');
      } else {
        root.setAttribute('data-prism-theme', previousTheme);
      }
    };
  }, [theme]);

  return (
    <div
      id={id}
      className={`prism-root prism-container ${theme === 'dark' ? 'dark' : ''} prism-size-${size} text-foreground${className ? ` ${className}` : ''}`}
      style={style}
    >
      <ErrorBoundary
        level="workspace"
        onClearStorage={persistence ? handleClearStorage : undefined}
      >
        <ConfigProvider
          componentId={id}
          serverSessionId={serverSessionId}
          registeredLayouts={registeredLayouts}
          theme={theme}
          size={size}
          maxTabs={maxTabs}
          persistence={persistence}
          persistenceType={persistenceType}
          searchBarPlaceholder={searchBarPlaceholder}
          statusBarPosition={statusBarPosition}
          initialLayout={initialLayout}
          newTabOpensDropdown={newTabOpensDropdown}
          layoutTimeout={layoutTimeout}
          setProps={setProps}
        >
          <PrismInner actions={actions} updateWorkspace={updateWorkspace}>
            {children}
          </PrismInner>
        </ConfigProvider>
      </ErrorBoundary>
    </div>
  );
}

Prism.dashChildrenUpdate = true;
