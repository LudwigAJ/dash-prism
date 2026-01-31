import { useReducer, useRef, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { logger } from '@utils/logger';
import {
  searchBarReducer,
  createInitialState,
  deriveMode,
  type ModeContext,
} from './searchBarReducer';
import { filterLayouts } from './searchBarUtils';
import { useDropdownResize } from './useDropdownResize';

/**
 * SearchBar state management hook.
 * Now uses a local reducer with derived mode instead of scattered useState calls.
 */
export function useSearchBarState(panelId: string) {
  const { state: globalState, dispatch: globalDispatch } = usePrism();
  const { registeredLayouts, searchBarPlaceholder } = useConfig();

  // ===== DERIVED GLOBAL STATE =====
  const activeTabId = globalState.activeTabIds[panelId];
  const activeTab = useMemo(
    () => globalState.tabs?.find((t) => t.id === activeTabId) ?? null,
    [globalState.tabs, activeTabId]
  );

  const currentLayout = useMemo(() => {
    if (!activeTab?.layoutId) return null;
    const layout = registeredLayouts[activeTab.layoutId];
    return layout ? { id: activeTab.layoutId, name: layout.name } : null;
  }, [activeTab, registeredLayouts]);

  // ===== LOCAL REDUCER STATE =====
  const [state, dispatch] = useReducer(
    searchBarReducer,
    currentLayout !== null,
    createInitialState
  );

  // ===== REFS (only for DOM) =====
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  // Track which tabs we've seen to distinguish new tabs from existing ones
  const seenTabsRef = useRef(new Set<string>());

  // ===== RESIZE LOGIC =====
  const { height: dropdownHeight, handleResizeStart } = useDropdownResize();

  // ===== DERIVED MODE =====
  const selectedLayout = state.selectedLayoutId ? registeredLayouts[state.selectedLayoutId] : null;

  const modeContext: ModeContext = {
    searchBarsHidden: globalState.searchBarsHidden ?? false,
    hasCurrentLayout: currentLayout !== null,
    selectedLayout: selectedLayout
      ? {
          hasParams: (selectedLayout.params?.length ?? 0) > 0,
          hasOptions:
            (selectedLayout.paramOptions && Object.keys(selectedLayout.paramOptions).length > 0) ??
            false,
        }
      : null,
  };

  const mode = deriveMode(state, modeContext);

  // ===== DERIVED DATA =====
  const layoutEntries = useMemo(() => Object.entries(registeredLayouts), [registeredLayouts]);

  const filteredLayouts = useMemo(
    () => filterLayouts(layoutEntries, state.searchQuery),
    [layoutEntries, state.searchQuery]
  );

  const paramOptions = selectedLayout?.paramOptions;
  const allParams = selectedLayout?.params ?? [];
  const currentParam = allParams[state.currentParamIndex];

  // ===== FOCUS HELPER =====
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // ===== HANDLERS =====
  const applyLayout = useCallback(
    (layoutId: string, name: string, params?: Record<string, string>, option?: string) => {
      // Read fresh activeTabId to avoid stale closure
      const currentActiveTabId = globalState.activeTabIds[panelId];
      if (!currentActiveTabId) {
        logger.error('Cannot apply layout: no active tab in panel', { panelId, layoutId });
        toast.error('Unable to apply layout: no active tab');
        return;
      }

      // Validate layout still exists
      if (!registeredLayouts[layoutId]) {
        logger.error('Cannot apply layout: layout no longer exists', { panelId, layoutId });
        toast.error('Layout is no longer available');
        dispatch({ type: 'RESET' });
        dispatch({ type: 'RETURN_TO_IDLE', showDropdown: currentLayout === null });
        return;
      }

      globalDispatch({
        type: 'UPDATE_TAB_LAYOUT',
        payload: { tabId: currentActiveTabId, layoutId, name, params, option },
      });

      dispatch({ type: 'RESET' });
      dispatch({ type: 'RETURN_TO_IDLE', showDropdown: false });
    },
    [globalState.activeTabIds, panelId, globalDispatch, registeredLayouts, currentLayout]
  );

  const handleLayoutSelect = useCallback(
    (layoutId: string) => {
      const layout = registeredLayouts[layoutId];
      if (!layout) return;

      // Check allowMultiple constraint
      if (!layout.allowMultiple) {
        const existingTab = globalState.tabs?.find((t) => t.layoutId === layoutId);
        if (existingTab) {
          logger.info(`Layout "${layout.name}" already open. Switching to existing tab.`);
          toast.info(`Layout "${layout.name}" is already open. Switching to it.`, {
            cancel: { label: 'Dismiss', onClick: () => {} },
          });
          globalDispatch({
            type: 'SELECT_TAB',
            payload: { tabId: existingTab.id, panelId: existingTab.panelId },
          });
          dispatch({ type: 'RESET' });
          dispatch({ type: 'RETURN_TO_IDLE', showDropdown: false });
          return;
        }
      }

      dispatch({ type: 'SELECT_LAYOUT', layoutId });

      const hasParams = layout.params && layout.params.length > 0;
      const hasOptions = layout.paramOptions && Object.keys(layout.paramOptions).length > 0;

      // No params, no options -> apply directly
      if (!hasParams && !hasOptions) {
        applyLayout(layoutId, layout.name);
        return;
      }

      // Mode will be derived as 'params' or 'options' based on layout metadata
      if (hasParams) {
        dispatch({ type: 'RESET_PARAMS' });
        focusInput();
      } else if (hasOptions) {
        focusInput();
      }
    },
    [registeredLayouts, globalState.tabs, globalDispatch, applyLayout, focusInput]
  );

  const handleOptionSelect = useCallback(
    (optionKey: string) => {
      if (!state.selectedLayoutId || !paramOptions?.[optionKey]) return;
      const layout = registeredLayouts[state.selectedLayoutId];
      applyLayout(
        state.selectedLayoutId,
        layout?.name ?? state.selectedLayoutId,
        undefined,
        optionKey
      );
    },
    [state.selectedLayoutId, paramOptions, registeredLayouts, applyLayout]
  );

  const handleBackToLayouts = useCallback(() => {
    dispatch({ type: 'ENTER_SEARCH_MODE' });
    focusInput();
  }, [focusInput]);

  const handleParamSubmit = useCallback(() => {
    if (!currentParam || !state.selectedLayoutId) return;

    const inputValue = state.paramValues[currentParam.name]?.trim();
    const value = inputValue || currentParam.default || '';

    if (!value) return;

    const newParamValues = { ...state.paramValues, [currentParam.name]: value };
    dispatch({ type: 'SET_PARAM_VALUE', paramName: currentParam.name, value });

    if (state.currentParamIndex < allParams.length - 1) {
      dispatch({ type: 'ADVANCE_PARAM' });
    } else {
      const layout = registeredLayouts[state.selectedLayoutId];
      applyLayout(state.selectedLayoutId, layout?.name ?? state.selectedLayoutId, newParamValues);
    }
  }, [
    currentParam,
    state.selectedLayoutId,
    state.paramValues,
    state.currentParamIndex,
    allParams.length,
    registeredLayouts,
    applyLayout,
  ]);

  const handleDisplayClick = useCallback(() => {
    dispatch({ type: 'ENTER_SEARCH_MODE' });
    focusInput();
  }, [focusInput]);

  const handleDisplayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        dispatch({ type: 'ENTER_SEARCH_MODE', initialQuery: e.key });
        focusInput();
        e.preventDefault();
      }
    },
    [focusInput]
  );

  const handleFocus = useCallback(() => {
    if (mode !== 'display') {
      dispatch({ type: 'SET_SHOW_DROPDOWN', show: true });
      focusInput();
    }
  }, [mode]);

  /**
   * Helper to dismiss the searchbar dropdown and return to idle state.
   * Consolidates the repeated dismiss logic used across blur, escape, etc.
   */
  const handleDismiss = useCallback(() => {
    const clearSelection = mode === 'params' || mode === 'options';
    dispatch({ type: 'DISMISS', clearSelection });
  }, [mode]);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!commandRef.current?.contains(relatedTarget)) {
        handleDismiss();
      }
    },
    [handleDismiss]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (mode === 'params') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleParamSubmit();
        } else if (e.key === 'Escape') {
          handleBackToLayouts();
        }
      } else if (mode === 'options' && e.key === 'Escape') {
        handleBackToLayouts();
      } else if (e.key === 'Escape') {
        handleDismiss();
      }
    },
    [mode, handleParamSubmit, handleBackToLayouts, handleDismiss]
  );

  // ===== EFFECTS =====

  // Layout selection from external events
  const handleLayoutSelection = useCallback(
    (e: CustomEvent) => {
      // Read fresh activeTabId to avoid stale closure
      const currentActiveTabId = globalState.activeTabIds[panelId];
      if (e.detail.tabId !== currentActiveTabId) return;

      const layout = registeredLayouts[e.detail.layoutId];
      if (!layout) return;

      const hasParams = layout.params && layout.params.length > 0;
      const hasOptions = layout.paramOptions && Object.keys(layout.paramOptions).length > 0;

      if (globalState.searchBarsHidden && (hasParams || hasOptions)) {
        dispatch({ type: 'SET_PENDING_LAYOUT', layoutId: e.detail.layoutId });
        globalDispatch({ type: 'TOGGLE_SEARCH_BARS' });
        return;
      }

      handleLayoutSelect(e.detail.layoutId);
    },
    [
      globalState.activeTabIds,
      panelId,
      handleLayoutSelect,
      registeredLayouts,
      globalState.searchBarsHidden,
      globalDispatch,
    ]
  );

  useEffect(() => {
    window.addEventListener('prism:select-layout', handleLayoutSelection as EventListener);
    return () =>
      window.removeEventListener('prism:select-layout', handleLayoutSelection as EventListener);
  }, [handleLayoutSelection]);

  // Handle searchBarsHidden state changes
  useEffect(() => {
    if (globalState.searchBarsHidden) {
      // Mode will be derived as 'hidden'
      dispatch({ type: 'SET_SHOW_DROPDOWN', show: false });
      return;
    }

    if (state.isPendingLayout) {
      const pendingLayoutId = state.isPendingLayout;
      dispatch({ type: 'SET_PENDING_LAYOUT', layoutId: null });
      handleLayoutSelect(pendingLayoutId);
      focusInput();
    }
  }, [globalState.searchBarsHidden, state.isPendingLayout, handleLayoutSelect, focusInput]);

  // Handle active tab layout changes
  useEffect(() => {
    if (globalState.searchBarsHidden) return;

    const isNewTab = activeTabId && !seenTabsRef.current.has(activeTabId);

    // Track this tab as seen
    if (activeTabId) {
      seenTabsRef.current.add(activeTabId);
    }

    if (activeTab?.layoutId && currentLayout) {
      // Tab now has a layout. Close dropdown.
      dispatch({ type: 'RETURN_TO_IDLE', showDropdown: false });
    } else if (!activeTab?.layoutId && isNewTab) {
      // Only auto-open dropdown for newly created tabs without layouts
      dispatch({ type: 'RETURN_TO_IDLE', showDropdown: true });
      focusInput();
    }
  }, [activeTab?.layoutId, currentLayout, globalState.searchBarsHidden, activeTabId]);

  // Report mode changes to Redux for StatusBar display
  useEffect(() => {
    globalDispatch({ type: 'SET_SEARCHBAR_MODE', payload: { panelId, mode } });
  }, [mode, panelId, globalDispatch]);

  // Focus request from global shortcut
  const handleFocusSearchbar = useCallback(
    (event: Event) => {
      const customEvent = event as CustomEvent<{ panelId?: string }>;
      if (customEvent.detail?.panelId !== panelId) return;
      if (globalState.searchBarsHidden) return;

      dispatch({ type: 'ENTER_SEARCH_MODE' });
      focusInput();
    },
    [panelId, globalState.searchBarsHidden, focusInput]
  );

  useEffect(() => {
    window.addEventListener('prism:focus-searchbar', handleFocusSearchbar as EventListener);
    return () =>
      window.removeEventListener('prism:focus-searchbar', handleFocusSearchbar as EventListener);
  }, [handleFocusSearchbar]);

  // Click outside handler
  useEffect(() => {
    if (!state.showDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (commandRef.current && !commandRef.current.contains(e.target as Node)) {
        handleDismiss();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleDismiss]);

  // ===== PUBLIC API =====
  return {
    // Derived state
    mode,
    activeTab,
    currentLayout,
    filteredLayouts,
    selectedLayout,
    paramOptions,
    allParams,
    currentParam,
    favoriteLayouts: globalState.favoriteLayouts ?? [],
    searchBarPlaceholder,

    // Local state
    searchQuery: state.searchQuery,
    showDropdown: state.showDropdown,
    dropdownHeight,
    paramValues: state.paramValues,
    currentParamIndex: state.currentParamIndex,
    selectedLayoutId: state.selectedLayoutId,

    // Refs
    inputRef,
    commandRef,

    // Handlers
    setSearchQuery: (query: string) => dispatch({ type: 'SET_SEARCH_QUERY', query }),
    setParamValues: (setter: (prev: Record<string, string>) => Record<string, string>) => {
      const newValues = setter(state.paramValues);
      dispatch({ type: 'SET_PARAM_VALUES', values: newValues });
    },
    handleLayoutSelect,
    handleOptionSelect,
    handleBackToLayouts,
    handleParamSubmit,
    handleDisplayClick,
    handleDisplayKeyDown,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleResizeStart,
    handleToggleFavorite: (layoutId: string) =>
      globalDispatch({ type: 'TOGGLE_FAVORITE_LAYOUT', payload: { layoutId } }),
  };
}
