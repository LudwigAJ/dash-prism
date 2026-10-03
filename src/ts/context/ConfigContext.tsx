import React, { createContext, useContext, useMemo } from 'react';
import { resolveMaxPanels } from '@store/workspaceSlice';
import { DEFAULT_STATUS_BAR_ITEMS } from '@constants/statusBar';
import type {
  RegisteredLayouts,
  Theme,
  Size,
  StatusBarPosition,
  PersistenceType,
  EmptyTabView,
  StatusBarItem,
} from '@types';

// =============================================================================
// Context
// =============================================================================

type ConfigContextValue = {
  /** Component ID for namespacing persistence storage */
  componentId?: string;
  /**
   * Fingerprint of the server's layout registry, stored with the persisted
   * workspace; read once when the store is created (see reconcileWithServer).
   */
  serverSessionId?: string;
  registeredLayouts: RegisteredLayouts;
  /** Tab content specs from Dash callback - keyed by tab ID */
  theme: Theme;
  size: Size;
  maxTabs: number;
  /** Maximum number of leaf panels (default: 20; below 1 = unlimited) */
  maxPanels: number;
  persistence: boolean;
  persistenceType: PersistenceType;
  searchBarPlaceholder: string;
  /** Whether the status bar is rendered at all (default: true) */
  showStatusBar: boolean;
  statusBarPosition: StatusBarPosition;
  /** Built-in status bar segments to show, in order (default: all) */
  statusBarItems: readonly StatusBarItem[];
  /** Layout ID to load in the first tab on initial load */
  initialLayout?: string;
  /** Whether new tabs auto-focus SearchBar and open dropdown (default: true) */
  newTabOpensDropdown: boolean;
  /** What an empty tab renders in its body (default: 'layouts') */
  emptyTabView: EmptyTabView;
  /** Whether Prism's keyboard shortcuts are installed (default: true) */
  enableKeyboardShortcuts: boolean;
  /** Whether share links can be created and are read from the URL hash (default: true) */
  enableShareLinks: boolean;
  /** Timeout in seconds for layout loading (default: 30) */
  layoutTimeout: number;
  /** Dash setProps callback for syncing state to Dash */
  setProps?: (props: Record<string, unknown>) => void;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

type ConfigProviderProps = {
  children: React.ReactNode;
  componentId?: string;
  serverSessionId?: string;
  registeredLayouts: RegisteredLayouts;
  theme?: Theme;
  size?: Size;
  maxTabs?: number;
  /** The default limit applies when the prop is omitted. A null (Python None) means no limit. */
  maxPanels?: number | null;
  persistence?: boolean;
  persistenceType?: PersistenceType;
  searchBarPlaceholder?: string;
  showStatusBar?: boolean;
  statusBarPosition?: StatusBarPosition;
  statusBarItems?: readonly StatusBarItem[];
  initialLayout?: string;
  newTabOpensDropdown?: boolean;
  emptyTabView?: EmptyTabView;
  enableKeyboardShortcuts?: boolean;
  enableShareLinks?: boolean;
  layoutTimeout?: number;
  setProps?: (props: Record<string, unknown>) => void;
};

export function ConfigProvider({
  children,
  componentId,
  serverSessionId,
  registeredLayouts,
  theme = 'light',
  size = 'md',
  maxTabs = 16,
  maxPanels,
  searchBarPlaceholder = 'Search layouts...',
  showStatusBar = true,
  statusBarPosition = 'bottom',
  statusBarItems = DEFAULT_STATUS_BAR_ITEMS,
  persistence = false,
  persistenceType = 'memory',
  initialLayout,
  newTabOpensDropdown = true,
  emptyTabView = 'layouts',
  enableKeyboardShortcuts = true,
  enableShareLinks = true,
  layoutTimeout = 30,
  setProps,
}: ConfigProviderProps) {
  const resolvedMaxPanels = resolveMaxPanels(maxPanels);

  const value = useMemo(
    () => ({
      componentId,
      serverSessionId,
      registeredLayouts,
      theme,
      size,
      maxTabs,
      maxPanels: resolvedMaxPanels,
      searchBarPlaceholder: searchBarPlaceholder,
      showStatusBar,
      statusBarPosition: statusBarPosition,
      statusBarItems,
      persistence,
      persistenceType,
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
      persistence,
      persistenceType,
      theme,
      size,
      maxTabs,
      resolvedMaxPanels,
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

// =============================================================================
// Hook
// =============================================================================

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
}
