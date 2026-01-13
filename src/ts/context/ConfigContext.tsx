import React, { createContext, useContext, useMemo } from 'react';
import type { RegisteredLayouts, Theme, Size, StatusBarPosition, PersistenceType } from '@types';

// =============================================================================
// Context
// =============================================================================

type ConfigContextValue = {
  registeredLayouts: RegisteredLayouts;
  /** Tab content specs from Dash callback - keyed by tab ID */
  theme: Theme;
  size: Size;
  maxTabs: number;
  persistence: boolean;
  persistenceType: PersistenceType;
  searchBarPlaceholder?: string;
  statusBarPosition?: StatusBarPosition;
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

type ConfigProviderProps = {
  children: React.ReactNode;
  registeredLayouts: RegisteredLayouts;
  theme?: Theme;
  size?: Size;
  maxTabs?: number;
  persistence?: boolean;
  persistenceType?: PersistenceType;
  searchBarPlaceholder?: string;
  statusBarPosition?: StatusBarPosition;
};

export function ConfigProvider({
  children,
  registeredLayouts,
  theme = 'light',
  size = 'md',
  maxTabs = 16,
  searchBarPlaceholder = 'Search layouts...',
  statusBarPosition = 'bottom',
  persistence = false,
  persistenceType = 'memory',
}: ConfigProviderProps) {
  const value = useMemo(
    () => ({
      registeredLayouts,
      theme,
      size,
      maxTabs,
      searchBarPlaceholder: searchBarPlaceholder,
      statusBarPosition: statusBarPosition,
      persistence,
      persistenceType,
    }),
    [
      registeredLayouts,
      persistence,
      persistenceType,
      theme,
      size,
      maxTabs,
      searchBarPlaceholder,
      statusBarPosition,
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
