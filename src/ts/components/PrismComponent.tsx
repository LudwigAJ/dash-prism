import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ConfigProvider, useConfig } from '@context/ConfigContext';
import { PortalProvider } from '@context/PortalContext';
import { PortalContainerProvider } from '@context/PortalContainerContext';
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
  clearPersistedWorkspace,
  resolvePersistenceType,
} from '@store';
import { cn } from '@utils/cn';
import { usePrismToast } from '@hooks/usePrismToast';
import { DEFAULT_STATUS_BAR_ITEMS } from '@constants/statusBar';
import type {
  RegisteredLayouts,
  Theme,
  Size,
  Workspace,
  StatusBarPosition,
  PersistenceType,
  EmptyTabView,
  StatusBarItem,
} from '@types';
import '../global.css';
import { type DashComponentProps } from 'props';

/**
 * Prism is an advanced multi-panel workspace manager for Plotly Dash.
 * It provides dynamic layout management with drag-and-drop tab organization,
 * multi-panel splits, and persistent workspace state across sessions.
 */
export type PrismProps = {
  /**
   * Unique ID to identify this component in Dash callbacks. Also scopes the
   * persisted workspace (storage key), so it is read when the component mounts;
   * changing it afterwards remounts the workspace and starts a fresh undo history.
   */
  id?: string;

  /**
   * The fingerprint of the registered layout IDs. It is a hash of the sorted
   * IDs, thus it is the same on every worker and after each restart for the same
   * set of layouts. Prism stores it with the persisted workspace. When the
   * workspace loads, Prism closes each tab whose layout is not in
   * registeredLayouts any more. Prism keeps the rest of the workspace and
   * records the new fingerprint. A closed tab shows no "Layout not found" error,
   * but a toast tells the user how many tabs Prism closed. The tabs that Prism
   * closes depend only on registeredLayouts, and Prism closes no tab while that
   * registry is empty. dash_prism.init() sets this prop unless you set it
   * yourself. If you set it yourself, init() keeps your value, and only the
   * recorded fingerprint changes. Prism reads the prop one time, when the
   * component mounts.
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
   * The maximum number of tabs in the whole workspace, which counts every
   * panel together and not one panel at a time. A value less than 1 means
   * that Prism applies no limit. The default is 16. A callback can change the
   * limit at any time. Prism keeps the existing tabs and the undo history,
   * and applies the new limit to the next tab action.
   */
  maxTabs?: number;

  /**
   * Maximum number of leaf panels the workspace can be split into. Once
   * reached, the split button and the edge drop zones disappear; 1 disables
   * splitting entirely. Values below 1, and an explicit None, mean unlimited.
   * Default 20.
   */
  maxPanels?: number | null;

  /**
   * Placeholder text shown in the search bar.
   */
  searchBarPlaceholder?: string;

  /**
   * Timeout in seconds for layout loading. Default 30. The browser shows a
   * timeout card if a tab's content has not arrived within this time, and the
   * render callback gives up on layout callbacks that run longer and renders an
   * error tab instead (async layouts in every app; synchronous layouts only in
   * apps created with use_async=True).
   */
  layoutTimeout?: number;

  /**
   * Whether to render the status bar at all. When false the reset, help and
   * undo buttons, the mode/panel/tab read-outs and any `actions` are not shown
   * (keyboard shortcuts keep working). Default true.
   */
  showStatusBar?: boolean;

  /**
   * Position of the status bar relative to the workspace.
   */
  statusBarPosition?: StatusBarPosition;

  /**
   * Which built-in status bar segments to show, in this order: 'reset',
   * 'help', 'undo', 'mode', 'panels', 'tab', 'count', 'updated'. 'updated' is
   * always placed at the far right, after any actions. Unknown names are
   * ignored; an empty list leaves only the actions. Default: all segments.
   */
  statusBarItems?: Array<
    'reset' | 'help' | 'undo' | 'mode' | 'panels' | 'tab' | 'count' | 'updated'
  >;

  /**
   * The current workspace state, which Prism writes for Dash (Prism -> Dash).
   * A callback
   * reads it as an Input or a State, and Prism never reads the prop back.
   * The keys are tabs, panel, panelTabs (the tab order of each panel),
   * activeTabIds, activePanelId, favoriteLayouts and searchBarsHidden.
   * Prism writes the first state immediately. After that, Prism waits until
   * 500 ms after the last change, and then writes the state one time.
   */
  readWorkspace?: Workspace;

  /**
   * The workspace state that Dash pushes into Prism (Dash -> Prism). A callback
   * sets it as an Output. Prism merges a partial update into the current workspace and then
   * heals the result: tab.panelId decides the panel of a tab, and Prism keeps
   * the tab order in panelTabs. A callback that returns readWorkspace without
   * a change costs one round trip and nothing more, because Prism skips a sync
   * of an unchanged workspace. But a callback that returns a different
   * workspace each time makes Prism and the callback send updates to each
   * other without end.
   */
  updateWorkspace?: Partial<Workspace>;

  /**
   * Array of PrismAction components to display in the status bar.
   * Each PrismAction has its own id and n_clicks for individual callbacks.
   */
  actions?: JSX.Element[];

  /**
   * Whether to persist workspace state in the browser. When false (the default)
   * nothing is written to storage and persistence_type is ignored. Read when the
   * component mounts; changing it afterwards remounts the workspace and starts a
   * fresh undo history.
   */
  persistence?: boolean;

  /**
   * Where to persist workspace state when persistence is true: 'local' for
   * localStorage (survives browser restarts), 'session' for sessionStorage
   * (current browser tab only), or 'memory' for no storage. Defaults to 'memory',
   * so set this together with persistence=True. Read when the component mounts;
   * changing it afterwards remounts the workspace and starts a fresh undo history.
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
   * What an empty tab (a tab with no layout selected) shows in its body.
   * 'layouts' (default) shows the grid of registered layouts with favorites first.
   * 'hint' shows a single line pointing the user to the search bar.
   * 'none' shows nothing; users select layouts via the search bar only.
   */
  emptyTabView?: EmptyTabView;

  /**
   * Whether Prism installs its keyboard shortcuts (Ctrl/Cmd+Alt+N, Ctrl/Cmd+D,
   * J, K, O, I, R, Shift+R, Y, B, U and Ctrl+Space). Set to false if they
   * conflict with your application's own shortcuts; the shortcut hints in the
   * context menu, the empty-tab hint and the help dialog are hidden too.
   * Default true.
   */
  enableKeyboardShortcuts?: boolean;

  /**
   * Whether users can copy a share link for a tab from its context menu and
   * whether Prism opens tabs from "#p:" share hashes in the page URL. Set to
   * false for apps that must not expose deep links or that use the URL hash
   * themselves. Default true.
   */
  enableShareLinks?: boolean;

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

  // The store is created exactly once per mount (useState initialiser, not
  // useMemo: React may discard a memo, and a dependency list keyed on props
  // would rebuild the store, dropping the undo history and any debounced sync).
  // Everything the store needs after creation is read through ref getters so
  // later prop changes reach it without a rebuild:
  //  - setProps: Dash hands out a new reference after every sync
  //  - registeredLayouts: injected/updated by dash_prism.init and callbacks
  //  - maxTabs and maxPanels: may be changed from a callback at any time
  // componentId and persistenceType are baked into the persist key/engine, so
  // Prism remounts PrismInner (via `key`) when either changes.
  const setPropsRef = useRef(config.setProps);
  useEffect(() => {
    setPropsRef.current = config.setProps;
  }, [config.setProps]);

  const registeredLayoutsRef = useRef(config.registeredLayouts);
  useEffect(() => {
    registeredLayoutsRef.current = config.registeredLayouts;
  }, [config.registeredLayouts]);

  const maxTabsRef = useRef(config.maxTabs);
  useEffect(() => {
    maxTabsRef.current = config.maxTabs;
  }, [config.maxTabs]);

  const maxPanelsRef = useRef(config.maxPanels);
  useEffect(() => {
    maxPanelsRef.current = config.maxPanels;
  }, [config.maxPanels]);

  const [{ store, persistor, cleanup }] = useState(() =>
    createPrismStore({
      componentId: config.componentId,
      serverSessionId: config.serverSessionId,
      persistenceType: config.persistenceType,
      maxTabs: () => maxTabsRef.current,
      maxPanels: () => maxPanelsRef.current,
      setProps: (props: Record<string, unknown>) => setPropsRef.current?.(props),
      getRegisteredLayouts: () => registeredLayoutsRef.current,
    })
  );

  // Clean up middleware resources on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

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
  const toast = usePrismToast();

  useEffect(() => {
    if (!notice) return;
    const n = notice.closedTabs;
    toast('info', `Closed ${n} tab${n === 1 ? '' : 's'} whose layout is no longer available`);
    dispatch(clearLoadNotice());
  }, [notice, dispatch, toast]);

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
  maxPanels,
  showStatusBar = true,
  statusBarPosition = 'bottom',
  statusBarItems = ['reset', 'help', 'undo', 'mode', 'panels', 'tab', 'count', 'updated'],
  searchBarPlaceholder = 'Search layouts...',
  layoutTimeout = 30,
  actions = [],
  persistence = false,
  persistence_type = 'memory',
  initialLayout,
  newTabOpensDropdown = true,
  emptyTabView = 'layouts',
  enableKeyboardShortcuts = true,
  enableShareLinks = true,
  updateWorkspace,
  className,
  style,
  children,
}: PrismProps) {
  // A fresh array literal arrives on every render (the default above, or a new
  // list from Dash); key it by content so the config context stays referentially
  // stable and consumers do not re-render on every sync. An explicit None from
  // Python arrives as null, which bypasses the destructuring default: treat it
  // (and any non-array) as "all segments".
  const statusBarItemsKey = (
    Array.isArray(statusBarItems) ? statusBarItems : DEFAULT_STATUS_BAR_ITEMS
  ).join('|');
  const stableStatusBarItems = useMemo(
    () => statusBarItemsKey.split('|').filter(Boolean) as StatusBarItem[],
    [statusBarItemsKey]
  );

  // `persistence` is the on/off switch; `persistence_type` only applies when it is on.
  // Resolve once here so every consumer (store, error boundary) sees the same answer.
  const persistenceType = resolvePersistenceType(persistence, persistence_type);

  // Radix portals render into the root element, so they get the theme of this instance.
  // State, not a ref: the provider must re-render once the element exists.
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);

  // Create stable callback for clearing storage from error boundary
  const handleClearStorage = useCallback(() => {
    clearPersistedWorkspace(id, persistenceType);
  }, [persistenceType, id]);

  return (
    <div
      id={id}
      ref={setRootElement}
      className={cn(
        'prism-root',
        theme === 'dark' && 'dark',
        `prism-size-${size}`,
        'tw:text-foreground',
        className
      )}
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
          maxPanels={maxPanels}
          persistence={persistence}
          persistenceType={persistenceType}
          searchBarPlaceholder={searchBarPlaceholder}
          showStatusBar={showStatusBar}
          statusBarPosition={statusBarPosition}
          statusBarItems={stableStatusBarItems}
          initialLayout={initialLayout}
          newTabOpensDropdown={newTabOpensDropdown}
          emptyTabView={emptyTabView}
          enableKeyboardShortcuts={enableKeyboardShortcuts}
          enableShareLinks={enableShareLinks}
          layoutTimeout={layoutTimeout}
          setProps={setProps}
        >
          <PortalContainerProvider value={rootElement}>
            <PrismInner
              key={`${id ?? ''}|${persistenceType}`}
              actions={actions}
              updateWorkspace={updateWorkspace}
            >
              {children}
            </PrismInner>
          </PortalContainerProvider>
        </ConfigProvider>
      </ErrorBoundary>
    </div>
  );
}

Prism.dashChildrenUpdate = true;
