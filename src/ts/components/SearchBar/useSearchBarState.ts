import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import { toast } from 'sonner';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { logger } from '@utils/logger';
import type { LayoutParam } from '@types';

type Mode = 'display' | 'search' | 'options' | 'params' | 'hidden';

const DEFAULT_DROPDOWN_HEIGHT = 300;
const MIN_DROPDOWN_HEIGHT = 120;
const MAX_DROPDOWN_HEIGHT = 600;

/**
 * Focus an element after the next render cycle.
 * Uses double requestAnimationFrame to ensure focus happens after React has
 * finished updating the DOM.
 */
function focusAfterRender(ref: RefObject<HTMLElement>): void {
  requestAnimationFrame(() => requestAnimationFrame(() => ref.current?.focus()));
}

export function useSearchBarState(panelId: string) {
  const { state, dispatch } = usePrism();
  const { registeredLayouts, searchBarPlaceholder, maxTabs } = useConfig();

  // ===== DERIVED STATE =====
  const activeTabId = state.activeTabIds[panelId];
  const activeTab = useMemo(
    () => state.tabs?.find((t) => t.id === activeTabId) ?? null,
    [state.tabs, activeTabId]
  );

  const currentLayout = useMemo(() => {
    if (!activeTab?.layoutId) return null;
    const layout = registeredLayouts[activeTab.layoutId];
    return layout ? { id: activeTab.layoutId, name: layout.name } : null;
  }, [activeTab, registeredLayouts]);

  // ===== LOCAL STATE =====
  const [mode, setMode] = useState<Mode>(() =>
    state.searchBarsHidden ? 'hidden' : currentLayout ? 'display' : 'search'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [currentParamIndex, setCurrentParamIndex] = useState(0);
  const [dropdownHeight, setDropdownHeight] = useState(DEFAULT_DROPDOWN_HEIGHT);

  // ===== REFS =====
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const pendingLayoutRef = useRef<string | null>(null);
  const suppressAutoOpenRef = useRef(false);
  const manualSearchRef = useRef(false);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(DEFAULT_DROPDOWN_HEIGHT);

  // ===== DERIVED FROM SELECTED LAYOUT =====
  const layoutEntries = useMemo(() => Object.entries(registeredLayouts), [registeredLayouts]);

  const filteredLayouts = useMemo(() => {
    if (!searchQuery.trim()) return layoutEntries;
    const query = searchQuery.toLowerCase();
    return layoutEntries.filter(([id, meta]) => {
      return (
        id.toLowerCase().includes(query) ||
        meta.name.toLowerCase().includes(query) ||
        meta.description?.toLowerCase().includes(query) ||
        meta.keywords?.some((k) => k.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, layoutEntries]);

  const selectedLayout = selectedLayoutId ? registeredLayouts[selectedLayoutId] : null;
  const paramOptions = selectedLayout?.paramOptions;
  const allParams = selectedLayout?.params ?? [];
  const currentParam: LayoutParam | undefined = allParams[currentParamIndex];

  // ===== HANDLERS =====
  const resetState = useCallback(() => {
    setSearchQuery('');
    setShowDropdown(false);
    setSelectedLayoutId(null);
    setParamValues({});
    setCurrentParamIndex(0);
    setDropdownHeight(DEFAULT_DROPDOWN_HEIGHT);
  }, []);

  const applyLayout = useCallback(
    (layoutId: string, name: string, params?: Record<string, string>, option?: string) => {
      if (activeTabId) {
        dispatch({
          type: 'UPDATE_TAB_LAYOUT',
          payload: { tabId: activeTabId, layoutId, name, params, option },
        });
      }
      manualSearchRef.current = false;
      setMode('display');
      resetState();
    },
    [activeTabId, activeTab?.layoutId, dispatch, resetState]
  );

  const handleLayoutSelect = useCallback(
    (layoutId: string) => {
      const layout = registeredLayouts[layoutId];
      if (!layout) return;

      // Check allowMultiple constraint
      if (!layout.allowMultiple) {
        const existingTab = state.tabs?.find((t) => t.layoutId === layoutId);
        if (existingTab) {
          logger.info(`Layout "${layout.name}" already open. Switching to existing tab.`);
          toast.info(`Layout "${layout.name}" is already open. Switching to it.`, {
            cancel: { label: 'Dismiss', onClick: () => {} },
          });
          dispatch({
            type: 'SELECT_TAB',
            payload: { tabId: existingTab.id, panelId: existingTab.panelId },
          });
          manualSearchRef.current = false;
          setMode('display');
          resetState();
          return;
        }
      }

      setSelectedLayoutId(layoutId);

      const hasParams = layout.params && layout.params.length > 0;
      const hasOptions = layout.paramOptions && Object.keys(layout.paramOptions).length > 0;

      // No params, no options -> apply directly
      if (!hasParams && !hasOptions) {
        applyLayout(layoutId, layout.name);
        return;
      }

      // Has params -> collect them
      if (hasParams) {
        setMode('params');
        setParamValues({});
        setCurrentParamIndex(0);
        setSearchQuery('');
        setShowDropdown(false);
        focusAfterRender(inputRef);
        return;
      }

      // Has options only -> show options dropdown
      if (hasOptions) {
        setMode('options');
        setSearchQuery('');
        setShowDropdown(true);
        focusAfterRender(inputRef);
        return;
      }
    },
    [registeredLayouts, state.tabs, dispatch, resetState, applyLayout]
  );

  const handleOptionSelect = useCallback(
    (optionKey: string) => {
      if (!selectedLayoutId || !paramOptions?.[optionKey]) return;
      const layout = registeredLayouts[selectedLayoutId];
      applyLayout(selectedLayoutId, layout?.name ?? selectedLayoutId, undefined, optionKey);
    },
    [selectedLayoutId, paramOptions, registeredLayouts, applyLayout]
  );

  const handleBackToLayouts = useCallback(() => {
    manualSearchRef.current = true;
    setMode('search');
    setSelectedLayoutId(null);
    setParamValues({});
    setCurrentParamIndex(0);
    setShowDropdown(true);
    setDropdownHeight(DEFAULT_DROPDOWN_HEIGHT);
    focusAfterRender(inputRef);
  }, []);

  const handleParamSubmit = useCallback(() => {
    if (!currentParam || !selectedLayoutId) return;

    const inputValue = paramValues[currentParam.name]?.trim();
    const value = inputValue || currentParam.default || '';

    if (!value) return;

    const newParamValues = { ...paramValues, [currentParam.name]: value };
    setParamValues(newParamValues);

    if (currentParamIndex < allParams.length - 1) {
      setCurrentParamIndex((i) => i + 1);
    } else {
      const layout = registeredLayouts[selectedLayoutId];
      applyLayout(selectedLayoutId, layout?.name ?? selectedLayoutId, newParamValues);
    }
  }, [
    currentParam,
    selectedLayoutId,
    paramValues,
    currentParamIndex,
    allParams.length,
    registeredLayouts,
    applyLayout,
  ]);

  const handleDisplayClick = useCallback(() => {
    manualSearchRef.current = true;
    setMode('search');
    setShowDropdown(true);
    setSearchQuery('');
    setSelectedLayoutId(null);
    setParamValues({});
    setCurrentParamIndex(0);
    setDropdownHeight(DEFAULT_DROPDOWN_HEIGHT);
    focusAfterRender(inputRef);
  }, []);

  const handleDisplayKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      manualSearchRef.current = true;
      setMode('search');
      setSearchQuery(e.key);
      setShowDropdown(true);
      setSelectedLayoutId(null);
      setParamValues({});
      setCurrentParamIndex(0);
      setDropdownHeight(DEFAULT_DROPDOWN_HEIGHT);
      focusAfterRender(inputRef);
      e.preventDefault();
    }
  }, []);

  const handleFocus = useCallback(() => {
    if (mode !== 'display') {
      setShowDropdown(true);
    }
  }, [mode]);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!commandRef.current?.contains(relatedTarget)) {
        manualSearchRef.current = false;
        setShowDropdown(false);
        if (mode === 'params' || mode === 'options') {
          resetState();
        }
        if (currentLayout) {
          setMode('display');
        } else {
          setMode('search');
        }
      }
    },
    [currentLayout, mode, resetState]
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
        setShowDropdown(false);
        if (currentLayout) {
          setMode('display');
        }
      }
    },
    [mode, handleParamSubmit, handleBackToLayouts, currentLayout]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = dropdownHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [dropdownHeight]
  );

  // ===== EFFECTS =====

  // Resize drag handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaY = e.clientY - startYRef.current;
      const newHeight = Math.min(
        MAX_DROPDOWN_HEIGHT,
        Math.max(MIN_DROPDOWN_HEIGHT, startHeightRef.current + deltaY)
      );
      setDropdownHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Layout selection from external events
  useEffect(() => {
    const handleLayoutSelection = (e: CustomEvent) => {
      if (e.detail.tabId !== activeTabId) return;

      const layout = registeredLayouts[e.detail.layoutId];
      if (!layout) return;

      const hasParams = layout.params && layout.params.length > 0;
      const hasOptions = layout.paramOptions && Object.keys(layout.paramOptions).length > 0;

      if (state.searchBarsHidden && (hasParams || hasOptions)) {
        pendingLayoutRef.current = e.detail.layoutId;
        dispatch({ type: 'TOGGLE_SEARCH_BARS' });
        return;
      }

      handleLayoutSelect(e.detail.layoutId);
    };
    window.addEventListener('prism:select-layout', handleLayoutSelection as EventListener);
    return () =>
      window.removeEventListener('prism:select-layout', handleLayoutSelection as EventListener);
  }, [activeTabId, handleLayoutSelect, registeredLayouts, state.searchBarsHidden, dispatch]);

  // Handle searchBarsHidden state changes
  useEffect(() => {
    if (state.searchBarsHidden) {
      setMode('hidden');
      setShowDropdown(false);
      return;
    }

    if (pendingLayoutRef.current) {
      const pendingLayoutId = pendingLayoutRef.current;
      pendingLayoutRef.current = null;
      suppressAutoOpenRef.current = true;
      handleLayoutSelect(pendingLayoutId);
      focusAfterRender(inputRef);
      return;
    }
    suppressAutoOpenRef.current = true;
  }, [state.searchBarsHidden, handleLayoutSelect]);

  // Handle active tab layout changes
  useEffect(() => {
    if (state.searchBarsHidden) return;

    if (activeTab?.layoutId && currentLayout) {
      if (!(manualSearchRef.current && (mode === 'search' || mode === 'options' || mode === 'params'))) {
        manualSearchRef.current = false;
        setMode('display');
        resetState();
      }
    } else if (!activeTab?.layoutId) {
      if (mode === 'params' || mode === 'options') {
        return;
      }
      setMode('search');
      if (suppressAutoOpenRef.current) {
        setShowDropdown(false);
        suppressAutoOpenRef.current = false;
      } else {
        setShowDropdown(true);
      }
    }
  }, [activeTab?.layoutId, currentLayout, resetState, state.searchBarsHidden]);

  // Report mode changes to Redux for StatusBar display
  useEffect(() => {
    dispatch({ type: 'SET_SEARCHBAR_MODE', payload: { panelId, mode } });
  }, [mode, panelId, dispatch]);

  // Focus request from global shortcut
  useEffect(() => {
    const handleFocusSearchbar = (event: Event) => {
      const customEvent = event as CustomEvent<{ panelId?: string }>;
      if (customEvent.detail?.panelId !== panelId) return;
      if (state.searchBarsHidden) return;

      setMode('search');
      setShowDropdown(true);
      setSearchQuery('');
      setSelectedLayoutId(null);
      setParamValues({});
      setCurrentParamIndex(0);
      manualSearchRef.current = true;
      focusAfterRender(inputRef);
    };

    window.addEventListener('prism:focus-searchbar', handleFocusSearchbar as EventListener);
    return () =>
      window.removeEventListener('prism:focus-searchbar', handleFocusSearchbar as EventListener);
  }, [panelId, state.searchBarsHidden]);

  // Click outside handler
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (commandRef.current && !commandRef.current.contains(e.target as Node)) {
        manualSearchRef.current = false;
        setShowDropdown(false);
        if (mode === 'params' || mode === 'options') {
          resetState();
        }
        if (currentLayout) {
          setMode('display');
        } else {
          setMode('search');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, currentLayout, mode, resetState]);

  return {
    // State
    mode,
    searchQuery,
    showDropdown,
    selectedLayoutId,
    paramValues,
    currentParamIndex,
    dropdownHeight,
    activeTab,
    currentLayout,
    filteredLayouts,
    selectedLayout,
    paramOptions,
    allParams,
    currentParam,
    favoriteLayouts: state.favoriteLayouts ?? [],
    searchBarPlaceholder,

    // Refs
    inputRef,
    commandRef,

    // Handlers
    setSearchQuery,
    setParamValues,
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
      dispatch({ type: 'TOGGLE_FAVORITE_LAYOUT', payload: { layoutId } }),
  };
}
