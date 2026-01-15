// Components
export { Prism, type PrismProps } from './components/PrismComponent';
export { PrismAction } from './components/PrismActionComponent';
export { Panel } from './components/Panel';
export { TabBar } from './components/TabBar';
export { SearchBar } from './components/SearchBar';
export { StatusBar } from './components/StatusBar';
export { PrismContent } from './components/PrismContentComponent';
export { PanelDropZone } from './components/PanelDropzone';

// Layout Components
export { NewLayout } from './components/layouts/NewLayout';

// Error Boundary
export { ErrorBoundary, type ErrorBoundaryLevel } from './components/ErrorBoundary';
/** @deprecated Use ErrorBoundary instead */
export { ErrorBoundary as ErrorLayout } from './components/ErrorBoundary';

// Context
export { PrismProvider, PrismContext } from './context/PrismContext';
export { ConfigProvider, useConfig } from './context/ConfigContext';
export { prismReducer, type PrismState, type Action } from './context/prismReducer';

// Hooks
export { usePrism, useActiveTab, usePanelTabs } from './hooks/usePrism';
export { useTabs, useTabDrag } from './hooks/useTabs';
export { usePanels } from './hooks/usePanels';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export { useDashSync } from './hooks/useDashSync';
export { useShareLinks } from './hooks/useShareLinks';

// Types
export type {
  Tab,
  Panel as PanelType, // avoid name conflict with Panel component
  LayoutMeta,
  LayoutParam,
  RegisteredLayouts,
  Theme,
  Size,
  Workspace,
  StatusBarPosition,
  ShareData,
  DashComponent,
} from './types';

// Utils
export { cn } from './utils/cn';
// Note: generateId, generateTabId, generatePanelId are internal to the reducer
// and NOT exported. Components dispatch actions with intent, the reducer handles
// implementation details like ID generation.
