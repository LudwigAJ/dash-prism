import React, { createContext, useContext, useMemo } from 'react';
import type { RegisteredLayouts, Theme, Size, StatusBarPosition, PersistenceType } from '@types';

// =============================================================================
// Context
// =============================================================================

type ConfigContextValue = {
  /** Component ID for namespacing persistence storage */
  componentId?: string;
  /** Server session fingerprint to invalidate stale persistence */
  serverSessionId?: string;
  registeredLayouts: RegisteredLayouts;
  /** Tab content specs from Dash callback - keyed by tab ID */
  theme: Theme;
  size: Size;
  maxTabs: number;
  persistence: boolean;
  persistenceType: PersistenceType;
  searchBarPlaceholder?: string;
  statusBarPosition?: StatusBarPosition;
  /** Layout ID to load in the first tab on initial load */
  initialLayout?: string;
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
  statusBarPosition?: StatusBarPosition;
  initialLayout?: string;
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
  statusBarPosition = 'bottom',
  persistence = false,
  persistenceType = 'memory',
  initialLayout,
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
      statusBarPosition: statusBarPosition,
      persistence,
      persistenceType,
      initialLayout,
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
      statusBarPosition,
      initialLayout,
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
