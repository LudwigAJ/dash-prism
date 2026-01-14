import React from 'react';
import { ConfigProvider } from '@context/ConfigContext';
import { PrismProvider } from '@context/PrismContext';
import { DndProvider } from '@context/DndProvider';
import { WorkspaceView } from '@components/WorkspaceView';
import type {
  RegisteredLayouts,
  Theme,
  Size,
  Workspace,
  StatusBarPosition,
  PanelId,
  Tab,
  Panel,
  TabId,
  PersistenceType,
} from '@types';
import '../global.css';
import { DashComponentProps } from 'props';

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
   * If to persist workspace state
   */
  persistence: boolean;

  /**
   * Where to persist workspace state: 'local' for localStorage,
   * 'session' for sessionStorage, or 'memory' for no persistence.
   */
  persistence_type: PersistenceType;

  /**
   * Layout ID to automatically load in the first tab on initial load.
   * Must match a registered layout ID. If persistence is enabled and a saved
   * workspace exists, the persisted state takes precedence over initialLayout.
   */
  initialLayout?: string;

  /**
   * Styling props from Dash
   */
  style: Record<string, string>;
} & DashComponentProps;

/**
 * Advanced multi-panel workspace manager for Plotly Dash.
 * Provides dynamic layout management with drag-and-drop tab organization,
 * multi-panel splits, and persistent workspace state across sessions.
 */
export function Prism({
  id,
  setProps,
  registeredLayouts = {},
  theme = 'light',
  size = 'md',
  maxTabs = 8,
  statusBarPosition = 'bottom',
  searchBarPlaceholder = 'Search layouts...',
  layoutTimeout = 30,
  actions = [],
  persistence = false,
  persistence_type = 'memory',
  initialLayout,
  updateWorkspace,
  readWorkspace,
  style,
  children,
}: PrismProps) {
  return (
    <div
      id={id}
      className={`prism-root prism-container prism-theme-${theme} prism-size-${size} bg-background text-foreground`}
      style={style}
    >
      <ConfigProvider
        componentId={id}
        registeredLayouts={registeredLayouts}
        theme={theme}
        size={size}
        maxTabs={maxTabs}
        persistence={persistence}
        persistenceType={persistence_type}
        searchBarPlaceholder={searchBarPlaceholder}
        statusBarPosition={statusBarPosition}
        initialLayout={initialLayout}
      >
        <PrismProvider updateWorkspace={updateWorkspace} setProps={setProps}>
          <DndProvider>
            <WorkspaceView actions={actions}>{children}</WorkspaceView>
          </DndProvider>
        </PrismProvider>
      </ConfigProvider>
    </div>
  );
}

Prism.dashChildrenUpdate = true;
