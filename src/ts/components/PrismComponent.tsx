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
  getWorkspaceStorageKey,
} from '@store';
import { toastEmitter } from '@utils/toastEmitter';
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
   * Server session identifier used to invalidate stale persisted workspaces.
   * Automatically injected by dash_prism.init() unless overridden.
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
   * If to persist workspace state. Defaults to false.
   */
  persistence?: boolean;

  /**
   * Where to persist workspace state: 'local' for localStorage,
   * 'session' for sessionStorage, or 'memory' for no persistence.
   * Defaults to 'memory'.
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
   * Styling props from Dash
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

  // Use a ref for setProps to avoid recreating the store when setProps reference changes.
  // This is critical: when dashSyncMiddleware calls setProps(), Dash may re-render with
  // a new setProps reference. Without this ref, the store would be recreated with fresh
  // initial state, causing tabs to disappear.
  const setPropsRef = useRef(config.setProps);
  useEffect(() => {
    setPropsRef.current = config.setProps;
  }, [config.setProps]);

  // Stable setProps wrapper that always calls the latest setProps
  const stableSetProps = useMemo(
    () => (props: Record<string, unknown>) => setPropsRef.current?.(props),
    []
  );

  // Create store with config values - memoized to prevent recreation
  // Note: stableSetProps is stable (empty deps), so it won't cause store recreation
  const { store, persistor, cleanup } = useMemo(
    () =>
      createPrismStore({
        componentId: config.componentId,
        persistenceType: config.persistenceType,
        maxTabs: config.maxTabs,
        setProps: stableSetProps,
      }),
    [config.componentId, config.persistenceType, config.maxTabs, stableSetProps]
  );

  // Clean up middleware resources on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Subscribe to toast events
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

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <PortalProvider>
          <UpdateWorkspaceSync updateWorkspace={updateWorkspace} />
          <InitialLayoutLoader />
          <DndProvider>
            <Toaster />
            <WorkspaceView actions={actions}>{children}</WorkspaceView>
          </DndProvider>
        </PortalProvider>
      </PersistGate>
    </Provider>
  );
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
  readWorkspace,
  style,
  children,
}: PrismProps) {
  // Create stable callback for clearing storage from error boundary
  const handleClearStorage = useCallback(() => {
    clearWorkspaceStorage(persistence_type, id);
  }, [persistence_type, id]);

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
      className={`prism-root prism-container ${theme === 'dark' ? 'dark' : ''} prism-size-${size} text-foreground`}
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
          persistenceType={persistence_type}
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
