import React, { createContext, useContext, useMemo } from 'react';
import type {
  RegisteredLayouts,
  Theme,
  Size,
  StatusBarPosition,
  PersistenceType,
  EmptyTabView,
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
  persistence: boolean;
  persistenceType: PersistenceType;
  searchBarPlaceholder: string;
  /** Whether the status bar is rendered at all (default: true) */
  showStatusBar: boolean;
  statusBarPosition: StatusBarPosition;
  /** Layout ID to load in the first tab on initial load */
  initialLayout?: string;
  /** Whether new tabs auto-focus SearchBar and open dropdown (default: true) */
  newTabOpensDropdown: boolean;
  /** What an empty tab renders in its body (default: 'layouts') */
  emptyTabView: EmptyTabView;
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
  persistence?: boolean;
  persistenceType?: PersistenceType;
  searchBarPlaceholder?: string;
  showStatusBar?: boolean;
  statusBarPosition?: StatusBarPosition;
  initialLayout?: string;
  newTabOpensDropdown?: boolean;
  emptyTabView?: EmptyTabView;
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
  searchBarPlaceholder = 'Search layouts...',
  showStatusBar = true,
  statusBarPosition = 'bottom',
  persistence = false,
  persistenceType = 'memory',
  initialLayout,
  newTabOpensDropdown = true,
  emptyTabView = 'layouts',
  layoutTimeout = 30,
  setProps,
}: ConfigProviderProps) {
  const value = useMemo(
    () => ({
      componentId,
      serverSessionId,
      registeredLayouts,
      theme,
      size,
      maxTabs,
      searchBarPlaceholder: searchBarPlaceholder,
      showStatusBar,
      statusBarPosition: statusBarPosition,
      persistence,
      persistenceType,
      initialLayout,
      newTabOpensDropdown,
      emptyTabView,
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
      searchBarPlaceholder,
      showStatusBar,
      statusBarPosition,
      initialLayout,
      newTabOpensDropdown,
      emptyTabView,
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
