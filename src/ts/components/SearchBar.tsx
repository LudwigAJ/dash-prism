import React, { useState, useRef, useMemo, useCallback, useEffect, memo } from 'react';
import { ChevronRight, ArrowLeft, X, Star } from 'lucide-react';
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
    () => state.tabs.find((t) => t.id === activeTabId) ?? null,
    [state.tabs, activeTabId]
  );

  const currentLayout = useMemo(() => {
    if (!activeTab?.layoutId) return null;
    const layout = registeredLayouts[activeTab.layoutId];
    return layout ? { id: activeTab.layoutId, name: layout.name } : null;
  }, [activeTab, registeredLayouts]);

  // ===== LOCAL STATE =====
  const [mode, setMode] = useState<Mode>(currentLayout ? 'display' : 'search');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [currentParamIndex, setCurrentParamIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

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
  }, []);

  const applyLayout = useCallback(
    (layoutId: string, name: string, params: Record<string, string> = {}) => {
      if (activeTabId) {
        dispatch({
          type: 'UPDATE_TAB_LAYOUT',
          payload: { tabId: activeTabId, layoutId, name, params },
        });
      }
      setMode('display');
      resetState();
    },
    [activeTabId, dispatch, resetState]
  );

  const handleLayoutSelect = useCallback(
    (layoutId: string) => {
      const layout = registeredLayouts[layoutId];
      if (!layout) return;

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
        return;
      }

      // C) Has options only -> show options dropdown
      if (hasOptions) {
        setMode('options');
        setSearchQuery('');
        return;
      }
    },
    [registeredLayouts, applyLayout]
  );

  const handleOptionSelect = useCallback(
    (optionKey: string) => {
      if (!selectedLayoutId || !paramOptions?.[optionKey]) return;
      const option = paramOptions[optionKey];
      const layout = registeredLayouts[selectedLayoutId];
      applyLayout(selectedLayoutId, layout?.name ?? selectedLayoutId, option.params);
    },
    [selectedLayoutId, paramOptions, registeredLayouts, applyLayout]
  );

  const handleBackToLayouts = useCallback(() => {
    setMode('search');
    setSelectedLayoutId(null);
    setParamValues({});
    setCurrentParamIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
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
    setMode('search');
    setShowDropdown(true);
    setSearchQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
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
      if (e.detail.tabId === activeTabId) {
        handleLayoutSelect(e.detail.layoutId);
      }
    };
    window.addEventListener('prism:select-layout', handleLayoutSelection as EventListener);
    return () =>
      window.removeEventListener('prism:select-layout', handleLayoutSelection as EventListener);
  }, [activeTabId, handleLayoutSelect]);

  useEffect(() => {
    if (activeTab?.layoutId && currentLayout) {
      setMode('display');
      resetState();
    } else if (!activeTab?.layoutId) {
      setMode('search');
      setShowDropdown(true);
    }
  }, [activeTab?.layoutId, currentLayout, resetState]);

  // Report mode changes to Redux for StatusBar display
  useEffect(() => {
    dispatch({ type: 'SET_SEARCHBAR_MODE', payload: { panelId, mode } });
  }, [mode, panelId, dispatch]);

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
        className="prism-searchbar prism-searchbar-display"
        onClick={handleDisplayClick}
        onKeyDown={(e) => {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            setMode('search');
            setSearchQuery(e.key);
            setShowDropdown(true);
            e.preventDefault();
          }
        }}
        tabIndex={0}
        role="button"
      >
        <span className="prism-searchbar-prompt">{'>'}</span>
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
      <div className="prism-searchbar">
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
      <div className="prism-searchbar" ref={commandRef}>
        <span className="prism-searchbar-prompt">{'>'}</span>

        <Command shouldFilter={false} className="prism-command ml-1.5 flex-1">
          <CommandInput
            ref={inputRef}
            value=""
            placeholder={`Select option for ${selectedLayout?.name}...`}
            showIcon={false}
            readOnly
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={() => setShowDropdown(true)}
          />

          {showDropdown && (
            <CommandList className="prism-searchbar-dropdown">
              <CommandItem onSelect={handleBackToLayouts}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span>Back to layouts</span>
              </CommandItem>
              <CommandSeparator />
              <CommandGroup heading={`Options for ${selectedLayout?.name}`}>
                {Object.entries(paramOptions).map(([key, option]) => (
                  <CommandItem key={key} value={key} onSelect={() => handleOptionSelect(key)}>
                    <span className="flex-1 font-medium">{key}</span>
                    {option.description && (
                      <span className="text-muted-foreground text-xs">{option.description}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
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
    <div className="prism-searchbar" ref={commandRef} data-testid="prism-searchbar">
      <span className="prism-searchbar-prompt">{'>'}</span>

      <Command shouldFilter={false} className="prism-command ml-1.5 flex-1">
        <CommandInput
          ref={inputRef}
          data-testid="prism-searchbar-input"
          value={searchQuery}
          onValueChange={setSearchQuery}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={searchBarPlaceholder}
          showIcon={false}
          autoFocus={!currentLayout}
        />

        {showDropdown && (
          <CommandList className="prism-searchbar-dropdown">
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
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ type: 'TOGGLE_FAVORITE_LAYOUT', payload: { layoutId: id } });
                        }}
                        className={cn(
                          'mr-2 shrink-0 rounded p-0.5 transition-colors',
                          'hover:bg-muted focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none',
                          isFavorite
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star className={cn('h-4 w-4', isFavorite && 'fill-primary')} />
                      </button>
                      <div className="flex flex-1 items-center gap-3 overflow-hidden">
                        <span className="shrink-0 font-medium">{meta.name}</span>
                        {meta.description && (
                          <span className="text-muted-foreground truncate text-sm">
                            {meta.description}
                          </span>
                        )}
                      </div>
                      {hasParams && <ChevronRight className="text-muted-foreground h-4 w-4" />}
                      {hasOptions && !hasParams && (
                        <span className="text-muted-foreground text-xs">options</span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
