// src/ts/components/SearchBar/searchBarReducer.ts
import { produce } from 'immer';

// =============================================================================
// Types
// =============================================================================

export type SearchBarMode = 'hidden' | 'display' | 'search' | 'options' | 'params';

export type SearchBarState = {
  searchQuery: string;
  showDropdown: boolean;
  selectedLayoutId: string | null;
  paramValues: Record<string, string>;
  currentParamIndex: number;
  dropdownHeight: number;
  isUserSearching: boolean;
  isPendingLayout: string | null;
  suppressAutoOpen: boolean;
};

export type SearchBarAction =
  | { type: 'RESET' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SHOW_DROPDOWN'; show: boolean }
  | { type: 'SET_DROPDOWN_HEIGHT'; height: number }
  | { type: 'START_MANUAL_SEARCH'; initialQuery?: string }
  | { type: 'SELECT_LAYOUT'; layoutId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'BACK_TO_SEARCH' }
  | { type: 'SET_PARAM_VALUE'; paramName: string; value: string }
  | { type: 'SET_PARAM_VALUES'; values: Record<string, string> }
  | { type: 'ADVANCE_PARAM' }
  | { type: 'RESET_PARAMS' }
  | { type: 'SET_PENDING_LAYOUT'; layoutId: string | null }
  | { type: 'SUPPRESS_AUTO_OPEN'; suppress: boolean }
  | { type: 'RETURN_TO_IDLE'; hasCurrentLayout: boolean };

export type ModeContext = {
  searchBarsHidden: boolean;
  hasCurrentLayout: boolean;
  selectedLayout: { hasParams: boolean; hasOptions: boolean } | null;
};

// =============================================================================
// Mode Derivation
// =============================================================================

/**
 * Pure function to derive SearchBar mode from state and context.
 * This is the SINGLE SOURCE OF TRUTH for what mode the SearchBar is in.
 */
export function deriveMode(state: SearchBarState, context: ModeContext): SearchBarMode {
  if (context.searchBarsHidden) return 'hidden';
  if (state.selectedLayoutId && context.selectedLayout?.hasParams && state.currentParamIndex >= 0) {
    return 'params';
  }
  if (
    state.selectedLayoutId &&
    context.selectedLayout?.hasOptions &&
    !context.selectedLayout.hasParams
  ) {
    return 'options';
  }
  if (state.isUserSearching) return 'search';
  if (!context.hasCurrentLayout) return 'search';
  return 'display';
}

// =============================================================================
// Reducer
// =============================================================================

const DEFAULT_DROPDOWN_HEIGHT = 300;
const MIN_DROPDOWN_HEIGHT = 120;
const MAX_DROPDOWN_HEIGHT = 600;

export function createInitialState(hasCurrentLayout: boolean): SearchBarState {
  return {
    searchQuery: '',
    showDropdown: !hasCurrentLayout,
    selectedLayoutId: null,
    paramValues: {},
    currentParamIndex: 0,
    dropdownHeight: DEFAULT_DROPDOWN_HEIGHT,
    isUserSearching: false,
    isPendingLayout: null,
    suppressAutoOpen: false,
  };
}

/**
 * Helper function to clear layout selection and param state.
 * Extracted to avoid duplication across multiple actions.
 */
function clearSelection(draft: SearchBarState) {
  draft.selectedLayoutId = null;
  draft.paramValues = {};
  draft.currentParamIndex = 0;
}

export const searchBarReducer = produce((draft: SearchBarState, action: SearchBarAction) => {
  switch (action.type) {
    case 'RESET':
      Object.assign(draft, createInitialState(false));
      break;
    case 'SET_SEARCH_QUERY':
      draft.searchQuery = action.query;
      break;
    case 'SET_SHOW_DROPDOWN':
      draft.showDropdown = action.show;
      break;
    case 'SET_DROPDOWN_HEIGHT':
      draft.dropdownHeight = Math.min(
        MAX_DROPDOWN_HEIGHT,
        Math.max(MIN_DROPDOWN_HEIGHT, action.height)
      );
      break;
    case 'START_MANUAL_SEARCH':
      draft.isUserSearching = true;
      draft.showDropdown = true;
      draft.searchQuery = action.initialQuery ?? '';
      draft.dropdownHeight = DEFAULT_DROPDOWN_HEIGHT;
      clearSelection(draft);
      break;
    case 'SELECT_LAYOUT':
      draft.selectedLayoutId = action.layoutId;
      draft.searchQuery = '';
      draft.showDropdown = true;
      break;
    case 'CLEAR_SELECTION':
      clearSelection(draft);
      break;
    case 'BACK_TO_SEARCH':
      draft.isUserSearching = true;
      draft.showDropdown = true;
      draft.dropdownHeight = DEFAULT_DROPDOWN_HEIGHT;
      clearSelection(draft);
      break;
    case 'SET_PARAM_VALUE':
      draft.paramValues[action.paramName] = action.value;
      break;
    case 'SET_PARAM_VALUES':
      draft.paramValues = { ...draft.paramValues, ...action.values };
      break;
    case 'ADVANCE_PARAM':
      draft.currentParamIndex += 1;
      break;
    case 'RESET_PARAMS':
      draft.paramValues = {};
      draft.currentParamIndex = 0;
      break;
    case 'SET_PENDING_LAYOUT':
      draft.isPendingLayout = action.layoutId;
      break;
    case 'SUPPRESS_AUTO_OPEN':
      draft.suppressAutoOpen = action.suppress;
      break;
    case 'RETURN_TO_IDLE':
      draft.isUserSearching = false;
      draft.showDropdown = action.hasCurrentLayout ? false : !draft.suppressAutoOpen;
      draft.suppressAutoOpen = false;
      draft.isPendingLayout = null;
      break;
  }
});
