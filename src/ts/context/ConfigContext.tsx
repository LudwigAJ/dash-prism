import React, { createContext, useContext, useMemo } from 'react';
import { resolveMaxPanels } from '@constants/panels';
import type {
  RegisteredLayouts,
  Theme,
  Size,
  StatusBarPosition,
  PersistenceType,
  EmptyTabViewKind,
  StatusBarItem,
} from '@types';

/**
 * Holds the Dash props of a Prism component that its views read. Prism resolves each value before
 * it puts it here: the defaults, the panel limit and the list of status bar segments.
 */
interface ConfigContextValue {
  /**
   * The Dash id of Prism, or a default id when Prism has none. It names the Dash component paths,
   * the toaster and the storage key.
   */
  componentId: string;
  /** The `serverSessionId` prop of Prism. The store reads it one time, when it is created. */
  serverSessionId?: string;
  registeredLayouts: RegisteredLayouts;
  theme: Theme;
  size: Size;
  maxTabs: number;
  /** Maximum number of leaf panels (below 1 = unlimited) */
  maxPanels: number;
  persistenceType: PersistenceType;
  searchBarPlaceholder: string;
  /** Whether the status bar is rendered at all */
  showStatusBar: boolean;
  statusBarPosition: StatusBarPosition;
  /** Built-in status bar segments to show, in order, without unknown names */
  statusBarItems: readonly StatusBarItem[];
  /** Layout ID to load in the first tab on initial load */
  initialLayout?: string;
  /** Whether new tabs auto-focus SearchBar and open dropdown */
  newTabOpensDropdown: boolean;
  /** What an empty tab renders in its body */
  emptyTabView: EmptyTabViewKind;
  /** Whether Prism's keyboard shortcuts are installed */
  enableKeyboardShortcuts: boolean;
  /** Whether share links can be created and are read from the URL hash */
  enableShareLinks: boolean;
  /** Timeout in seconds for layout loading */
  layoutTimeout: number;
  /** Dash setProps callback for syncing state to Dash */
  setProps?: (props: Record<string, unknown>) => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

/**
 * Holds the props of `ConfigProvider`. They are the fields of the context, except that the panel
 * limit arrives as the raw prop. The provider sets no defaults: the destructured props of Prism
 * hold them, because the generated Python docstring reads them from there.
 */
interface ConfigProviderProps {
  children: React.ReactNode;
  componentId: string;
  serverSessionId?: string;
  registeredLayouts: RegisteredLayouts;
  theme: Theme;
  size: Size;
  maxTabs: number;
  /** The default limit applies when the prop is omitted. A null (Python None) means no limit. */
  maxPanels?: number | null;
  persistenceType: PersistenceType;
  searchBarPlaceholder: string;
  showStatusBar: boolean;
  statusBarPosition: StatusBarPosition;
  statusBarItems: readonly StatusBarItem[];
  initialLayout?: string;
  newTabOpensDropdown: boolean;
  emptyTabView: EmptyTabViewKind;
  enableKeyboardShortcuts: boolean;
  enableShareLinks: boolean;
  layoutTimeout: number;
  setProps?: (props: Record<string, unknown>) => void;
}

/** Provides the resolved Prism config to the views of one Prism component. */
export function ConfigProvider({
  children,
  componentId,
  serverSessionId,
  registeredLayouts,
  theme,
  size,
  maxTabs,
  maxPanels,
  persistenceType,
  searchBarPlaceholder,
  showStatusBar,
  statusBarPosition,
  statusBarItems,
  initialLayout,
  newTabOpensDropdown,
  emptyTabView,
  enableKeyboardShortcuts,
  enableShareLinks,
  layoutTimeout,
  setProps,
}: ConfigProviderProps) {
  const resolvedMaxPanels = resolveMaxPanels(maxPanels);

  const value = useMemo(
    (): ConfigContextValue => ({
      componentId,
      serverSessionId,
      registeredLayouts,
      theme,
      size,
      maxTabs,
      maxPanels: resolvedMaxPanels,
      persistenceType,
      searchBarPlaceholder,
      showStatusBar,
      statusBarPosition,
      statusBarItems,
      initialLayout,
      newTabOpensDropdown,
      emptyTabView,
      enableKeyboardShortcuts,
      enableShareLinks,
      layoutTimeout,
      setProps,
    }),
    [
      componentId,
      serverSessionId,
      registeredLayouts,
      theme,
      size,
      maxTabs,
      resolvedMaxPanels,
      persistenceType,
      searchBarPlaceholder,
      showStatusBar,
      statusBarPosition,
      statusBarItems,
      initialLayout,
      newTabOpensDropdown,
      emptyTabView,
      enableKeyboardShortcuts,
      enableShareLinks,
      layoutTimeout,
      setProps,
    ]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/** Gives the config of the Prism component around the caller. */
export function useConfig(): ConfigContextValue {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
}
