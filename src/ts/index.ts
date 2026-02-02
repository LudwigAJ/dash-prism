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
export { ConfigProvider, useConfig } from './context/ConfigContext';
export { PortalProvider, usePortal } from './context/PortalContext';

// Redux Store
export {
  // Store factory
  createPrismStore,
  // Typed hooks
  useAppDispatch,
  useAppSelector,
  // Undo/redo
  undo,
  redo,
  clearHistory,
  jump,
  // Selectors
  selectTabs,
  selectPanel,
  selectPanelTabs,
  selectActiveTabIds,
  selectActivePanelId,
  selectFavoriteLayouts,
  selectSearchBarsHidden,
  selectCanUndo,
  selectCanRedo,
  selectTabCount,
  selectPanelCount,
  selectWorkspaceSnapshot,
  // Factory selectors
  makeSelectPanelTabs,
  makeSelectActiveTab,
  makeSelectSearchBarMode,
  makeSelectCanCloseTab,
  // UI selectors
  selectRenamingTabId,
  selectInfoModalTabId,
  selectHelpModalOpen,
  selectSetIconModalTabId,
  // Workspace actions
  addTab,
  removeTab,
  selectTab,
  renameTab,
  lockTab,
  unlockTab,
  toggleTabLock,
  updateTabLayout,
  moveTab,
  reorderTab,
  duplicateTab,
  setTabIcon,
  setTabStyle,
  refreshTab,
  setActivePanel,
  resizePanel,
  pinPanel,
  unpinPanel,
  splitPanel,
  collapsePanel,
  toggleSearchBars,
  toggleFavoriteLayout,
  resetWorkspace,
  syncWorkspace,
  // UI actions
  setSearchBarMode,
  startRenameTab,
  clearRenameTab,
  openInfoModal,
  closeInfoModal,
  openHelpModal,
  closeHelpModal,
  openSetIconModal,
  closeSetIconModal,
  // Initial states
  initialWorkspaceState,
  initialUiState,
} from './store';

// Redux store types
export type {
  RootState,
  AppDispatch,
  WorkspaceState,
  UiState,
  SearchBarMode,
  StoreConfig,
  ThunkExtra,
} from './store';

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
