import React, { useState, useRef, useMemo, useCallback, useEffect, memo } from 'react';
import { ChevronRight, ArrowLeft, X, Star, List } from 'lucide-react';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { cn } from '@utils/cn';

import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
} from './ui/command';
import type { LayoutParam, LayoutOption } from '@types';

type SearchBarProps = {
  panelId: string;
  /** When true, panel is pinned (informational, SearchBar doesn't need special behavior) */
  isPinned?: boolean;
};

type Mode = 'display' | 'search' | 'options' | 'params' | 'hidden';

export const SearchBar = memo(function SearchBar({ panelId, isPinned = false }: SearchBarProps) {
  const { state, dispatch } = usePrism();
  const { registeredLayouts, searchBarPlaceholder, maxTabs } = useConfig();

  // ================================================================================
  // STATE & DERIVED
  // ================================================================================

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

  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);
  const pendingLayoutRef = useRef<string | null>(null);
  const suppressAutoOpenRef = useRef(false);
  const manualSearchRef = useRef(false);

  // ===== DROPDOWN RESIZE STATE =====
  const DEFAULT_DROPDOWN_HEIGHT = 300;
  const MIN_DROPDOWN_HEIGHT = 120;
  const MAX_DROPDOWN_HEIGHT = 600;
  const [dropdownHeight, setDropdownHeight] = useState(DEFAULT_DROPDOWN_HEIGHT);
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
  const currentParam = allParams[currentParamIndex];

  // ================================================================================
  // HANDLERS
  // ================================================================================

  const resetState = useCallback(() => {
    setSearchQuery('');
    setShowDropdown(false);
    setSelectedLayoutId(null);
    setParamValues({});
    setCurrentParamIndex(0);
    setDropdownHeight(DEFAULT_DROPDOWN_HEIGHT); // Reset dropdown height
  }, []);

  // ===== DROPDOWN RESIZE HANDLERS =====
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

  // Effect for resize drag handling
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
    [activeTabId, dispatch, resetState]
  );

  const handleLayoutSelect = useCallback(
    (layoutId: string) => {
      const layout = registeredLayouts[layoutId];
      if (!layout) return;

      // Check allowMultiple constraint - if layout already open, switch to it instead
      if (!layout.allowMultiple) {
        const existingTab = state.tabs?.find((t) => t.layoutId === layoutId);
        if (existingTab) {
          // TODO: Replace with toast.info when Sonner is integrated
          console.log(`[Prism] Layout "${layout.name}" already open. Switching to existing tab.`);
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

      // A) No params, no options -> apply directly
      if (!hasParams && !hasOptions) {
        applyLayout(layoutId, layout.name);
        return;
      }

      // B) Has params -> collect them one by one
      if (hasParams) {
        setMode('params');
        setParamValues({});
        setCurrentParamIndex(0);
        setSearchQuery('');
        setShowDropdown(false);
        requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
        return;
      }

      // C) Has options only -> show options dropdown
      if (hasOptions) {
        setMode('options');
        setSearchQuery('');
        setShowDropdown(true);
        requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
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
    requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
  }, [DEFAULT_DROPDOWN_HEIGHT]);

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
    requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
  }, [DEFAULT_DROPDOWN_HEIGHT]);

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
        // Cancel any param/options collection on blur
        if (mode === 'params' || mode === 'options') {
          resetState();
        }
        // Return to display mode if we have a layout, otherwise stay in search (without dropdown)
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

  // ================================================================================
  // EFFECTS
  // ================================================================================

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
      requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
      return;
    }
    suppressAutoOpenRef.current = true;
  }, [state.searchBarsHidden, handleLayoutSelect]);

  useEffect(() => {
    if (state.searchBarsHidden) return;

    if (activeTab?.layoutId && currentLayout) {
      if (!(manualSearchRef.current && mode === 'search')) {
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
  }, [activeTab?.layoutId, currentLayout, mode, resetState, state.searchBarsHidden]);

  // Report mode changes to Redux for StatusBar display
  useEffect(() => {
    dispatch({ type: 'SET_SEARCHBAR_MODE', payload: { panelId, mode } });
  }, [mode, panelId, dispatch]);

  // Focus request from global shortcut (handled in useKeyboardShortcuts)
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
      requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
    };

    window.addEventListener('prism:focus-searchbar', handleFocusSearchbar as EventListener);
    return () =>
      window.removeEventListener('prism:focus-searchbar', handleFocusSearchbar as EventListener);
  }, [panelId, state.searchBarsHidden]);

  // ===== CLICK OUTSIDE HANDLER =====
  // Close dropdown when clicking outside the command wrapper
  // This handles cases where blur doesn't fire (e.g., after clicking favorite star)
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

    // Use mousedown to catch clicks before focus changes
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, currentLayout, mode, resetState]);

  // ================================================================================
  // RENDER: HIDDEN
  // ================================================================================

  if (mode === 'hidden') {
    return null;
  }

  // ================================================================================
  // RENDER: DISPLAY MODE
  // ================================================================================

  if (mode === 'display' && currentLayout) {
    // Get params and options from active tab for display
    const params = activeTab?.layoutParams;
    const option = activeTab?.layoutOption;
    const hasParams = params && Object.keys(params).length > 0;
    const hasOption = Boolean(option);

    return (
      <div
        className={cn('prism-searchbar prism-searchbar-display')}
        onClick={handleDisplayClick}
        onKeyDown={(e) => {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            manualSearchRef.current = true;
            setMode('search');
            setSearchQuery(e.key);
            setShowDropdown(true);
            setSelectedLayoutId(null);
            setParamValues({});
            setCurrentParamIndex(0);
            setDropdownHeight(DEFAULT_DROPDOWN_HEIGHT);
            requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
            e.preventDefault();
          }
        }}
        tabIndex={0}
        role="button"
      >
        <span className="prism-searchbar-layout-name">{currentLayout.name}</span>
        {hasOption && (
          <>
            <ChevronRight className="text-muted-foreground mx-1 h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-primary text-sm">{option}</span>
          </>
        )}
        {hasParams &&
          Object.values(params).map((value, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="text-muted-foreground mx-1 h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-primary text-sm">{value}</span>
            </React.Fragment>
          ))}
      </div>
    );
  }

  // ================================================================================
  // RENDER: PARAMS MODE
  // ================================================================================

  if (mode === 'params' && currentParam) {
    const hasDefault = currentParam.hasDefault && currentParam.default;
    const currentValue = paramValues[currentParam.name] ?? '';
    const showDefaultHint = hasDefault && currentValue === '';

    return (
      <div className={cn('prism-searchbar pl-3')}>
        {/* Counter - muted to match surrounding text */}
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          ({currentParamIndex + 1}/{allParams.length})
        </span>

        {/* Layout name */}
        <span className="prism-searchbar-layout-name">{selectedLayout?.name}</span>

        {/* Chevron separator */}
        <ChevronRight className="text-muted-foreground mx-1 h-3.5 w-3.5 flex-shrink-0" />

        {/* Param label */}
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {currentParam.name}:
        </span>

        {/* Input field with inline default hint */}
        <div className="relative ml-2 flex min-w-0 flex-1 items-center">
          <input
            ref={inputRef}
            className="w-full border-none bg-transparent text-sm outline-none"
            value={currentValue}
            onChange={(e) => setParamValues((v) => ({ ...v, [currentParam.name]: e.target.value }))}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            autoFocus
          />
          {showDefaultHint && (
            <span className="text-muted-foreground/60 pointer-events-none absolute left-0 text-sm">
              {currentParam.default}
            </span>
          )}
        </div>

        {/* Cancel X button */}
        <button
          className="text-muted-foreground hover:text-destructive ml-2 flex-shrink-0 p-1 transition-colors"
          onClick={handleBackToLayouts}
          title="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // ================================================================================
  // RENDER: OPTIONS MODE
  // ================================================================================

  if (mode === 'options' && paramOptions) {
    return (
      <div className={cn('prism-searchbar')} ref={commandRef}>
        <Command shouldFilter={false} className="prism-command flex-1 overflow-visible">
          <CommandInput
            ref={inputRef}
            value=""
            placeholder={`Select option for ${selectedLayout?.name}...`}
            readOnly
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => setShowDropdown(true)}
          />

          {showDropdown && (
            <CommandList
              className="bg-popover border-border absolute top-full right-0 left-0 z-[100] border shadow-lg"
              style={{ maxHeight: dropdownHeight }}
            >
              <CommandItem onSelect={handleBackToLayouts}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back to layouts</span>
              </CommandItem>
              <CommandSeparator />
              <CommandGroup heading={`Options for ${selectedLayout?.name}`}>
                {Object.entries(paramOptions).map(([key, option]) => (
                  <CommandItem key={key} value={key} onSelect={() => handleOptionSelect(key)}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key}</span>
                      {option.description && (
                        <span className="text-muted-foreground text-xs">{option.description}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              {/* Resize handle */}
              <div className="prism-searchbar-resize-handle" onMouseDown={handleResizeStart} />
            </CommandList>
          )}
        </Command>
      </div>
    );
  }

  // ================================================================================
  // RENDER: SEARCH MODE (default)
  // ================================================================================

  return (
    <div className={cn('prism-searchbar')} ref={commandRef} data-testid="prism-searchbar">
      <Command shouldFilter={false} className="prism-command flex-1 overflow-visible">
        <CommandInput
          ref={inputRef}
          data-testid="prism-searchbar-input"
          value={searchQuery}
          onValueChange={setSearchQuery}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={searchBarPlaceholder}
          autoFocus={false}
        />

        {showDropdown && (
          <CommandList
            className="bg-popover border-border absolute top-full right-0 left-0 z-[100] border shadow-lg"
            style={{ maxHeight: dropdownHeight }}
          >
            {filteredLayouts.length === 0 ? (
              <CommandEmpty>No layouts found</CommandEmpty>
            ) : (
              <CommandGroup heading="Available Layouts">
                {filteredLayouts.map(([id, meta]) => {
                  const hasOptions = meta.paramOptions && Object.keys(meta.paramOptions).length > 0;
                  const hasParams = meta.params && meta.params.length > 0;
                  const isFavorite = (state.favoriteLayouts ?? []).includes(id);

                  return (
                    <CommandItem
                      key={id}
                      data-testid={`prism-layout-item-${id}`}
                      value={`${meta.name} ${meta.keywords?.join(' ') ?? ''}`}
                      onSelect={() => handleLayoutSelect(id)}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()} // Prevent focus theft from input
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: 'TOGGLE_FAVORITE_LAYOUT', payload: { layoutId: id } });
                        }}
                        className={cn(
                          'mr-2 shrink-0 rounded p-0.5 transition-colors',
                          'hover:bg-muted focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none',
                          isFavorite ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                        )}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star
                          className={cn('h-4 w-4 text-current', isFavorite && 'fill-current')}
                        />
                      </button>
                      <div className="flex flex-1 items-center gap-3 overflow-hidden">
                        <span className="shrink-0 font-medium">{meta.name}</span>
                        {meta.description && (
                          <span className="text-muted-foreground truncate text-sm">
                            {meta.description}
                          </span>
                        )}
                      </div>
                      {hasParams ? (
                        <span className="text-muted-foreground ml-auto text-xs" aria-hidden="true">
                          {'>'}
                        </span>
                      ) : hasOptions ? (
                        <List
                          className="text-muted-foreground ml-auto h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {/* Resize handle */}
            <div className="prism-searchbar-resize-handle" onMouseDown={handleResizeStart} />
          </CommandList>
        )}
      </Command>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
