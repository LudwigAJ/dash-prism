import { produce } from 'immer';
import { logger } from '@utils/logger';

/** Names what the search bar shows. `deriveMode` computes it, and no state stores it. */
export type SearchBarMode = 'hidden' | 'display' | 'search' | 'options' | 'params';

/**
 * Holds the local state of one search bar. `deriveMode` reads `selectedLayoutId`,
 * `currentParamIndex` and `isUserSearching`. The other fields hold the input text, the dropdown
 * and the parameter step.
 */
export interface SearchBarState {
  searchQuery: string;
  showDropdown: boolean;
  /** The layout that the user picked, while its parameters or options are still open */
  selectedLayoutId: string | null;
  paramValues: Record<string, string>;
  currentParamIndex: number;
  /** Whether the user started a search on a tab that already has a layout */
  isUserSearching: boolean;
  /** The layout that waits until the hidden search bars show again, to ask for its parameters */
  pendingLayoutId: string | null;
  /** Inline validation message for the current parameter input, if any */
  paramError: string | null;
  /** The choice that the arrow keys marked in the list of an enum parameter, if any */
  activeChoice: string | null;
}

/** Lists the actions of `searchBarReducer`. */
export type SearchBarAction =
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SHOW_DROPDOWN'; show: boolean }
  | { type: 'ENTER_SEARCH_MODE'; initialQuery?: string }
  | { type: 'SELECT_LAYOUT'; layoutId: string }
  | { type: 'SET_PARAM_VALUES'; values: Record<string, string> }
  | { type: 'ADVANCE_PARAM' }
  | { type: 'RESET_PARAMS' }
  | { type: 'SET_PARAM_ERROR'; message: string | null }
  | { type: 'SET_ACTIVE_CHOICE'; choice: string | null }
  | { type: 'SET_PENDING_LAYOUT'; layoutId: string | null }
  | { type: 'LAYOUT_APPLIED'; showDropdown: boolean }
  | { type: 'RETURN_TO_IDLE'; showDropdown: boolean }
  | { type: 'DISMISS'; clearSelection: boolean };

/** Holds the facts outside the local state that `deriveMode` needs. */
export interface ModeContext {
  searchBarsHidden: boolean;
  /** Whether the active tab of the panel shows a registered layout */
  hasCurrentLayout: boolean;
  selectedLayout: { hasParams: boolean; hasOptions: boolean } | null;
}

/**
 * Derives the SearchBar mode from state and context.
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

/**
 * Builds the state of a search bar that shows nothing yet. The dropdown starts closed. An effect
 * of useSearchBarState opens it for a new tab when the `newTabOpensDropdown` prop asks for it.
 */
export function createInitialState(): SearchBarState {
  return {
    searchQuery: '',
    showDropdown: false,
    selectedLayoutId: null,
    paramValues: {},
    currentParamIndex: 0,
    isUserSearching: false,
    pendingLayoutId: null,
    paramError: null,
    activeChoice: null,
  };
}

/** Clears the layout selection and the param state. */
function clearSelection(draft: SearchBarState) {
  draft.selectedLayoutId = null;
  draft.paramValues = {};
  draft.currentParamIndex = 0;
  draft.paramError = null;
  draft.activeChoice = null;
}

/** Applies a search bar action to the local state of one search bar. */
export const searchBarReducer = produce((draft: SearchBarState, action: SearchBarAction) => {
  switch (action.type) {
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
    case 'SET_PARAM_VALUES':
      // Replace rather than merge: callers build the whole map, and a merge
      // silently undid the removal of a parameter the user chose to leave at
      // its default, which then reached the server as an empty string.
      draft.paramValues = { ...action.values };
      // The user is editing, so any inline error from the previous attempt is
      // stale. So is the marked choice, because the list is filtered again.
      draft.paramError = null;
      draft.activeChoice = null;
      break;
    case 'ADVANCE_PARAM':
      draft.currentParamIndex += 1;
      draft.paramError = null;
      draft.activeChoice = null;
      break;
    case 'RESET_PARAMS':
      draft.paramValues = {};
      draft.currentParamIndex = 0;
      draft.paramError = null;
      draft.activeChoice = null;
      break;
    case 'SET_PARAM_ERROR':
      draft.paramError = action.message;
      break;
    case 'SET_ACTIVE_CHOICE':
      draft.activeChoice = action.choice;
      break;
    case 'SET_PENDING_LAYOUT':
      draft.pendingLayoutId = action.layoutId;
      break;
    case 'LAYOUT_APPLIED':
      // The search bar starts again from nothing, with the dropdown as the caller says
      Object.assign(draft, createInitialState());
      draft.showDropdown = action.showDropdown;
      break;
    case 'RETURN_TO_IDLE':
      draft.isUserSearching = false;
      draft.showDropdown = action.showDropdown;
      draft.pendingLayoutId = null;
      break;
    case 'DISMISS':
      draft.showDropdown = false;
      draft.isUserSearching = false;
      draft.pendingLayoutId = null;
      draft.searchQuery = '';
      if (action.clearSelection) {
        clearSelection(draft);
      }
      break;
    default: {
      // A new action type that no case handles fails to compile here.
      const unhandled: never = action;
      logger.debug('Unhandled SearchBar action', unhandled);
      break;
    }
  }
});
