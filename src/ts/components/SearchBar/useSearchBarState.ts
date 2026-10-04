import { useReducer, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  checkParamInput,
  filterChoices,
  resolveEnumInput,
  stepActiveChoice,
  type ParamCheck,
} from './paramValidation';
import type { PanelId } from '@types';
import { useConfig } from '@context/ConfigContext';
import { usePrismToast } from '@hooks/usePrismToast';
import {
  searchBarReducer,
  createInitialState,
  deriveMode,
  type ModeContext,
} from './searchBarReducer';
import { filterLayouts, layoutHasOptions, layoutHasParams } from './searchBarUtils';
import { useDropdownResize } from './useDropdownResize';
import { useSearchBarEvents } from './useSearchBarEvents';
import type { DisplayModeProps } from './DisplayMode';
import type { OptionsModeProps } from './OptionsMode';
import type { ParamsModeProps } from './ParamsMode';
import type { SearchModeProps } from './SearchMode';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectActiveTabIds,
  selectSearchBarsHidden,
  selectFavoriteLayouts,
  updateTabLayout,
  switchToOpenTab,
  toggleFavoriteLayout,
  setSearchBarMode,
} from '@store';

/**
 * Holds the state of the search bar of one panel: a local reducer, the mode that `deriveMode`
 * computes from it, and the handlers. It gives the props of the component of each mode. A mode
 * whose data is missing gets null, and SearchBar then falls back to the search mode.
 */
export function useSearchBarState(panelId: PanelId) {
  const globalDispatch = useAppDispatch();
  const toast = usePrismToast();
  const tabs = useAppSelector(selectTabs);
  const activeTabIds = useAppSelector(selectActiveTabIds);
  const searchBarsHidden = useAppSelector(selectSearchBarsHidden);
  const favoriteLayouts = useAppSelector(selectFavoriteLayouts);
  const { registeredLayouts, searchBarPlaceholder, newTabOpensDropdown } = useConfig();

  // Derived global state
  const activeTabId = activeTabIds[panelId];
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  const currentLayout = useMemo(() => {
    if (!activeTab?.layoutId) return null;
    const layout = registeredLayouts[activeTab.layoutId];
    return layout ? { id: activeTab.layoutId, name: layout.name } : null;
  }, [activeTab, registeredLayouts]);

  // Local reducer state
  const [state, dispatch] = useReducer(searchBarReducer, undefined, createInitialState);

  // Refs (only for the DOM)
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  // Track which tabs we've seen to distinguish new tabs from existing ones
  const seenTabsRef = useRef(new Set<string>());

  // Track if initial auto-focus has happened (to prevent auto-opening dropdown on mount)
  const hasReceivedInitialFocusRef = useRef(false);

  // Resize logic
  const { height: dropdownHeight, handleResizeStart } = useDropdownResize();

  // Derived mode
  const selectedLayout = state.selectedLayoutId ? registeredLayouts[state.selectedLayoutId] : null;

  const modeContext: ModeContext = {
    searchBarsHidden: searchBarsHidden ?? false,
    hasCurrentLayout: currentLayout !== null,
    selectedLayout: selectedLayout
      ? {
          hasParams: layoutHasParams(selectedLayout),
          hasOptions: layoutHasOptions(selectedLayout),
        }
      : null,
  };

  const mode = deriveMode(state, modeContext);

  // Derived data
  const layoutEntries = useMemo(() => Object.entries(registeredLayouts), [registeredLayouts]);

  const filteredLayouts = useMemo(
    () => filterLayouts(layoutEntries, state.searchQuery),
    [layoutEntries, state.searchQuery]
  );

  const paramOptions = selectedLayout?.paramOptions;
  const allParams = selectedLayout?.params ?? [];
  const currentParam = allParams[state.currentParamIndex];
  const currentParamValue = currentParam ? (state.paramValues[currentParam.name] ?? '') : '';
  const paramChoices = useMemo(
    () => (currentParam ? filterChoices(currentParam, currentParamValue) : []),
    [currentParam, currentParamValue]
  );

  // Focus helper
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Handlers
  const applyLayout = useCallback(
    (layoutId: string, name: string, params?: Record<string, string>, option?: string) => {
      // Read fresh activeTabId to avoid stale closure
      const currentActiveTabId = activeTabIds[panelId];
      if (!currentActiveTabId) {
        toast('error', 'Unable to apply layout: no active tab', {
          logDetails: `Cannot apply layout '${layoutId}': no active tab in panel '${panelId}'`,
        });
        return;
      }

      // Validate layout still exists
      if (!registeredLayouts[layoutId]) {
        toast('error', 'Layout is no longer available', {
          logDetails: `Cannot apply layout '${layoutId}' in panel '${panelId}': layout no longer exists`,
        });
        dispatch({ type: 'LAYOUT_APPLIED', showDropdown: currentLayout === null });
        return;
      }

      globalDispatch(
        updateTabLayout({ tabId: currentActiveTabId, layoutId, name, params, option })
      );

      dispatch({ type: 'LAYOUT_APPLIED', showDropdown: false });
    },
    [activeTabIds, panelId, globalDispatch, registeredLayouts, currentLayout, toast]
  );

  const handleLayoutSelect = useCallback(
    (layoutId: string) => {
      const layout = registeredLayouts[layoutId];
      if (!layout) return;

      // Check allowMultiple constraint
      if (globalDispatch(switchToOpenTab(layoutId))) {
        dispatch({ type: 'LAYOUT_APPLIED', showDropdown: false });
        return;
      }

      dispatch({ type: 'SELECT_LAYOUT', layoutId });

      const hasParams = layoutHasParams(layout);
      const hasOptions = layoutHasOptions(layout);

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
    [registeredLayouts, globalDispatch, applyLayout, focusInput]
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

  /**
   * Records a validated value for the current parameter and moves on: to the next
   * parameter, or applies the layout when this was the last one. An omitted value
   * (empty input on a parameter with a default) is left out of the request so
   * the server applies the callback's own default.
   */
  const commitParamValue = useCallback(
    (check: Exclude<ParamCheck, { ok: false }>) => {
      if (!currentParam || !state.selectedLayoutId) return;

      const newParamValues = { ...state.paramValues };
      if ('omit' in check) {
        delete newParamValues[currentParam.name];
      } else {
        newParamValues[currentParam.name] = check.value;
      }
      dispatch({ type: 'SET_PARAM_VALUES', values: newParamValues });

      if (state.currentParamIndex < allParams.length - 1) {
        dispatch({ type: 'ADVANCE_PARAM' });
      } else {
        const layout = registeredLayouts[state.selectedLayoutId];
        applyLayout(state.selectedLayoutId, layout?.name ?? state.selectedLayoutId, newParamValues);
      }
    },
    [
      currentParam,
      state.selectedLayoutId,
      state.paramValues,
      state.currentParamIndex,
      allParams.length,
      registeredLayouts,
      applyLayout,
    ]
  );

  const handleParamSubmit = useCallback(() => {
    if (!currentParam || !state.selectedLayoutId) return;

    const typed = state.paramValues[currentParam.name] ?? '';
    const check = checkParamInput(currentParam, resolveEnumInput(currentParam, typed));
    if (check.ok === false) {
      dispatch({ type: 'SET_PARAM_ERROR', message: check.message });
      return;
    }
    commitParamValue(check);
  }, [currentParam, state.selectedLayoutId, state.paramValues, commitParamValue]);

  /** A choice picked from the enum list: no further validation needed. */
  const handleChoiceSelect = useCallback(
    (value: string) => {
      commitParamValue({ ok: true, value });
    },
    [commitParamValue]
  );

  const handleChoiceHover = useCallback(
    (value: string) => {
      if (value !== state.activeChoice) dispatch({ type: 'SET_ACTIVE_CHOICE', choice: value });
    },
    [state.activeChoice]
  );

  const handleDisplayClick = useCallback(() => {
    dispatch({ type: 'ENTER_SEARCH_MODE' });
    focusInput();
  }, [focusInput]);

  const handleDisplayKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Space activates the button, as Enter does. It does not start a search.
      if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        dispatch({ type: 'ENTER_SEARCH_MODE', initialQuery: e.key });
        focusInput();
        e.preventDefault();
      }
    },
    [focusInput]
  );

  const handleFocus = useCallback(() => {
    // Skip opening dropdown on initial auto-focus from mount
    // The effect will handle opening dropdown if newTabOpensDropdown is true
    if (!hasReceivedInitialFocusRef.current) {
      hasReceivedInitialFocusRef.current = true;
      // Don't open dropdown on initial auto-focus - let the effect decide
      return;
    }

    // User-initiated focus (click, tab navigation) - always open dropdown
    if (mode !== 'display') {
      dispatch({ type: 'SET_SHOW_DROPDOWN', show: true });
    }
  }, [mode]);

  const handleClick = useCallback(() => {
    // User clicked on search bar - always open dropdown (even if already focused)
    if (mode !== 'display') {
      dispatch({ type: 'SET_SHOW_DROPDOWN', show: true });
    }
  }, [mode]);

  /**
   * Dismisses the searchbar dropdown and returns to the idle state.
   * Consolidates the repeated dismiss logic used across blur, escape, etc.
   */
  const handleDismiss = useCallback(() => {
    const clearSelection = mode === 'params' || mode === 'options';
    dispatch({ type: 'DISMISS', clearSelection });
  }, [mode]);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (!commandRef.current?.contains(e.relatedTarget)) {
        handleDismiss();
      }
    },
    [handleDismiss]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (mode === 'params') {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          // Without a choice list the arrow keys keep moving the caret.
          if (paramChoices.length > 0) {
            e.preventDefault();
            const step = e.key === 'ArrowDown' ? 1 : -1;
            dispatch({
              type: 'SET_ACTIVE_CHOICE',
              choice: stepActiveChoice(paramChoices, state.activeChoice, step),
            });
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (state.activeChoice === null) {
            handleParamSubmit();
          } else {
            handleChoiceSelect(state.activeChoice);
          }
        } else if (e.key === 'Escape') {
          // The first Escape only clears the marked choice, as in a combobox popup.
          if (state.activeChoice !== null) {
            dispatch({ type: 'SET_ACTIVE_CHOICE', choice: null });
          } else {
            handleBackToLayouts();
          }
        }
      } else if (mode === 'options' && e.key === 'Escape') {
        handleBackToLayouts();
      } else if (e.key === 'Escape') {
        handleDismiss();
        inputRef.current?.blur();
      }
    },
    [
      mode,
      paramChoices,
      state.activeChoice,
      handleParamSubmit,
      handleChoiceSelect,
      handleBackToLayouts,
      handleDismiss,
    ]
  );

  // Effects

  useSearchBarEvents({
    panelId,
    activeTabId,
    pendingLayoutId: state.pendingLayoutId,
    dispatch,
    handleLayoutSelect,
    focusInput,
  });

  // Handle active tab layout changes
  useEffect(() => {
    if (searchBarsHidden) return;

    const isNewTab = activeTabId && !seenTabsRef.current.has(activeTabId);

    // Track this tab as seen
    if (activeTabId) {
      seenTabsRef.current.add(activeTabId);
    }

    if (activeTab?.layoutId && currentLayout) {
      // Tab now has a layout. Close dropdown.
      dispatch({ type: 'RETURN_TO_IDLE', showDropdown: false });
    } else if (!activeTab?.layoutId && isNewTab && newTabOpensDropdown) {
      // Only auto-open dropdown for newly created tabs without layouts
      // when newTabOpensDropdown is enabled
      dispatch({ type: 'RETURN_TO_IDLE', showDropdown: true });
      focusInput();
    }
  }, [
    activeTab?.layoutId,
    currentLayout,
    searchBarsHidden,
    activeTabId,
    newTabOpensDropdown,
    focusInput,
  ]);

  // Report mode changes to Redux for StatusBar display
  useEffect(() => {
    globalDispatch(setSearchBarMode({ panelId, mode }));
  }, [mode, panelId, globalDispatch]);

  // Click outside handler
  useEffect(() => {
    if (!state.showDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      const command = commandRef.current;
      // The params mode has no command element, so a click there never dismisses
      if (command && e.target instanceof Node && !command.contains(e.target)) {
        handleDismiss();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleDismiss, state.showDropdown]);

  // Props of each mode
  const displayProps: DisplayModeProps | null = currentLayout
    ? {
        currentLayoutName: currentLayout.name,
        activeTab,
        onDisplayClick: handleDisplayClick,
        onKeyDown: handleDisplayKeyDown,
      }
    : null;

  const paramsProps: ParamsModeProps | null = currentParam
    ? {
        selectedLayoutName: selectedLayout?.name ?? '',
        currentParam,
        currentParamIndex: state.currentParamIndex,
        totalParams: allParams.length,
        paramValue: currentParamValue,
        paramError: state.paramError,
        choices: paramChoices,
        activeChoice: state.activeChoice,
        onParamValueChange: (value) => {
          dispatch({
            type: 'SET_PARAM_VALUES',
            values: { ...state.paramValues, [currentParam.name]: value },
          });
        },
        onChoiceSelect: handleChoiceSelect,
        onChoiceHover: handleChoiceHover,
        onKeyDown: handleKeyDown,
        onBlur: handleBlur,
        onCancel: handleBackToLayouts,
        inputRef,
      }
    : null;

  const optionsProps: OptionsModeProps | null = paramOptions
    ? {
        selectedLayoutName: selectedLayout?.name ?? '',
        paramOptions,
        showDropdown: state.showDropdown,
        dropdownHeight,
        onOptionSelect: handleOptionSelect,
        onBackToLayouts: handleBackToLayouts,
        onKeyDown: handleKeyDown,
        onBlur: handleBlur,
        onResizeStart: handleResizeStart,
        inputRef,
        commandRef,
      }
    : null;

  const searchProps: SearchModeProps = {
    searchQuery: state.searchQuery,
    filteredLayouts,
    favoriteLayouts: favoriteLayouts ?? [],
    showDropdown: state.showDropdown,
    dropdownHeight,
    searchBarPlaceholder,
    onSearchQueryChange: (query) => {
      dispatch({ type: 'SET_SEARCH_QUERY', query });
    },
    onLayoutSelect: handleLayoutSelect,
    onToggleFavorite: (layoutId) => {
      globalDispatch(toggleFavoriteLayout({ layoutId }));
    },
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onClick: handleClick,
    onResizeStart: handleResizeStart,
    inputRef,
    commandRef,
  };

  return { mode, displayProps, paramsProps, optionsProps, searchProps };
}
