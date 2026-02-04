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
  isUserSearching: boolean;
  isPendingLayout: string | null;
};

export type SearchBarAction =
  | { type: 'RESET' }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SHOW_DROPDOWN'; show: boolean }
  | { type: 'ENTER_SEARCH_MODE'; initialQuery?: string }
  | { type: 'SELECT_LAYOUT'; layoutId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_PARAM_VALUE'; paramName: string; value: string }
  | { type: 'SET_PARAM_VALUES'; values: Record<string, string> }
  | { type: 'ADVANCE_PARAM' }
  | { type: 'RESET_PARAMS' }
  | { type: 'SET_PENDING_LAYOUT'; layoutId: string | null }
  | { type: 'RETURN_TO_IDLE'; showDropdown: boolean }
  | { type: 'DISMISS'; clearSelection: boolean };

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

export function createInitialState(_hasCurrentLayout: boolean): SearchBarState {
  // Note: showDropdown starts false - the useSearchBarState effect will open it
  // based on newTabOpensDropdown config when appropriate
  return {
    searchQuery: '',
    showDropdown: false,
    selectedLayoutId: null,
    paramValues: {},
    currentParamIndex: 0,
    isUserSearching: false,
    isPendingLayout: null,
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
    case 'ENTER_SEARCH_MODE':
      draft.isUserSearching = true;
      draft.showDropdown = true;
      draft.searchQuery = action.initialQuery ?? '';
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
    case 'RETURN_TO_IDLE':
      draft.isUserSearching = false;
      draft.showDropdown = action.showDropdown;
      draft.isPendingLayout = null;
      break;
    case 'DISMISS':
      draft.showDropdown = false;
      draft.isUserSearching = false;
      draft.isPendingLayout = null;
      if (action.clearSelection) {
        clearSelection(draft);
      }
      break;
  }
});
