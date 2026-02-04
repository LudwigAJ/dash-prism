// src/ts/components/SearchBar/searchBarReducer.test.ts
import { describe, it, expect } from 'vitest';
import {
  searchBarReducer,
  createInitialState,
  deriveMode,
  type SearchBarAction,
  type SearchBarState,
  type ModeContext,
} from './searchBarReducer';

describe('deriveMode', () => {
  const baseState: SearchBarState = {
    searchQuery: '',
    showDropdown: false,
    selectedLayoutId: null,
    paramValues: {},
    currentParamIndex: 0,
    isUserSearching: false,
    isPendingLayout: null,
  };

  const baseContext: ModeContext = {
    searchBarsHidden: false,
    hasCurrentLayout: false,
    selectedLayout: null,
  };

  it('returns hidden when searchBarsHidden is true', () => {
    const mode = deriveMode(baseState, { ...baseContext, searchBarsHidden: true });
    expect(mode).toBe('hidden');
  });

  it('returns display when current layout exists and not searching', () => {
    const mode = deriveMode(baseState, { ...baseContext, hasCurrentLayout: true });
    expect(mode).toBe('display');
  });

  it('returns search when no current layout', () => {
    const mode = deriveMode(baseState, baseContext);
    expect(mode).toBe('search');
  });

  it('returns params when layout selected with params', () => {
    const state = { ...baseState, selectedLayoutId: 'chart', currentParamIndex: 0 };
    const context = { ...baseContext, selectedLayout: { hasParams: true, hasOptions: false } };
    expect(deriveMode(state, context)).toBe('params');
  });

  it('returns options when layout selected with options only', () => {
    const state = { ...baseState, selectedLayoutId: 'chart' };
    const context = { ...baseContext, selectedLayout: { hasParams: false, hasOptions: true } };
    expect(deriveMode(state, context)).toBe('options');
  });

  it('returns search when isUserSearching is true', () => {
    const state = { ...baseState, isUserSearching: true };
    const context = { ...baseContext, hasCurrentLayout: true };
    expect(deriveMode(state, context)).toBe('search');
  });

  it('prioritizes hidden over all other modes', () => {
    const state = { ...baseState, isUserSearching: true, selectedLayoutId: 'chart' };
    const context = {
      searchBarsHidden: true,
      hasCurrentLayout: true,
      selectedLayout: { hasParams: true, hasOptions: false },
    };
    expect(deriveMode(state, context)).toBe('hidden');
  });

  it('prioritizes params over options when both exist', () => {
    const state = { ...baseState, selectedLayoutId: 'chart', currentParamIndex: 0 };
    const context = {
      ...baseContext,
      selectedLayout: { hasParams: true, hasOptions: true },
    };
    expect(deriveMode(state, context)).toBe('params');
  });
});

describe('searchBarReducer', () => {
  it('RESET clears all state', () => {
    const state = {
      ...createInitialState(false),
      searchQuery: 'test',
      selectedLayoutId: 'chart',
      isUserSearching: true,
    };
    const action: SearchBarAction = { type: 'RESET' };
    const newState = searchBarReducer(state, action);

    expect(newState.searchQuery).toBe('');
    expect(newState.selectedLayoutId).toBeNull();
    expect(newState.isUserSearching).toBe(false);
  });

  it('ENTER_SEARCH_MODE sets isUserSearching and opens dropdown', () => {
    const state = createInitialState(true);
    const action: SearchBarAction = { type: 'ENTER_SEARCH_MODE', initialQuery: 'ch' };
    const newState = searchBarReducer(state, action);

    expect(newState.isUserSearching).toBe(true);
    expect(newState.showDropdown).toBe(true);
    expect(newState.searchQuery).toBe('ch');
  });

  it('ENTER_SEARCH_MODE clears selected layout and params', () => {
    const state = {
      ...createInitialState(false),
      selectedLayoutId: 'chart',
      paramValues: { type: 'bar' },
      currentParamIndex: 1,
    };
    const action: SearchBarAction = { type: 'ENTER_SEARCH_MODE' };
    const newState = searchBarReducer(state, action);

    expect(newState.selectedLayoutId).toBeNull();
    expect(newState.paramValues).toEqual({});
    expect(newState.currentParamIndex).toBe(0);
  });

  it('SELECT_LAYOUT sets selectedLayoutId and clears query', () => {
    const state = { ...createInitialState(false), searchQuery: 'chart' };
    const action: SearchBarAction = { type: 'SELECT_LAYOUT', layoutId: 'chart-view' };
    const newState = searchBarReducer(state, action);

    expect(newState.selectedLayoutId).toBe('chart-view');
    expect(newState.searchQuery).toBe('');
  });

  it('ADVANCE_PARAM increments currentParamIndex', () => {
    const state = { ...createInitialState(false), currentParamIndex: 0 };
    const action: SearchBarAction = { type: 'ADVANCE_PARAM' };
    const newState = searchBarReducer(state, action);

    expect(newState.currentParamIndex).toBe(1);
  });

  it('RETURN_TO_IDLE clears isUserSearching but preserves selection', () => {
    const state = {
      ...createInitialState(false),
      isUserSearching: true,
      selectedLayoutId: 'chart',
      paramValues: { type: 'bar' },
    };
    const action: SearchBarAction = { type: 'RETURN_TO_IDLE', showDropdown: false };
    const newState = searchBarReducer(state, action);

    expect(newState.isUserSearching).toBe(false);
    expect(newState.selectedLayoutId).toBe('chart'); // Preserved
    expect(newState.paramValues).toEqual({ type: 'bar' }); // Preserved
  });

  it('SET_SEARCH_QUERY updates query', () => {
    const state = createInitialState(false);
    const action: SearchBarAction = { type: 'SET_SEARCH_QUERY', query: 'dashboard' };
    const newState = searchBarReducer(state, action);

    expect(newState.searchQuery).toBe('dashboard');
  });

  it('SET_SHOW_DROPDOWN updates dropdown visibility', () => {
    const state = createInitialState(false);
    const show = searchBarReducer(state, { type: 'SET_SHOW_DROPDOWN', show: true });
    expect(show.showDropdown).toBe(true);

    const hide = searchBarReducer(state, { type: 'SET_SHOW_DROPDOWN', show: false });
    expect(hide.showDropdown).toBe(false);
  });

  it('CLEAR_SELECTION clears selectedLayoutId and params', () => {
    const state = {
      ...createInitialState(false),
      selectedLayoutId: 'chart',
      paramValues: { type: 'bar' },
      currentParamIndex: 1,
    };
    const action: SearchBarAction = { type: 'CLEAR_SELECTION' };
    const newState = searchBarReducer(state, action);

    expect(newState.selectedLayoutId).toBeNull();
    expect(newState.paramValues).toEqual({});
    expect(newState.currentParamIndex).toBe(0);
  });

  it('SET_PARAM_VALUE updates paramValues', () => {
    const state = createInitialState(false);
    const action: SearchBarAction = { type: 'SET_PARAM_VALUE', paramName: 'type', value: 'bar' };
    const newState = searchBarReducer(state, action);

    expect(newState.paramValues).toEqual({ type: 'bar' });
  });

  it('RESET_PARAMS clears all param values and index', () => {
    const state = {
      ...createInitialState(false),
      paramValues: { type: 'bar', size: 'large' },
      currentParamIndex: 2,
    };
    const action: SearchBarAction = { type: 'RESET_PARAMS' };
    const newState = searchBarReducer(state, action);

    expect(newState.paramValues).toEqual({});
    expect(newState.currentParamIndex).toBe(0);
  });

  it('SET_PENDING_LAYOUT updates isPendingLayout', () => {
    const state = createInitialState(false);
    const set = searchBarReducer(state, { type: 'SET_PENDING_LAYOUT', layoutId: 'chart' });
    expect(set.isPendingLayout).toBe('chart');

    const clear = searchBarReducer(set, { type: 'SET_PENDING_LAYOUT', layoutId: null });
    expect(clear.isPendingLayout).toBeNull();
  });

  it('RETURN_TO_IDLE sets dropdown visibility explicitly', () => {
    const state = { ...createInitialState(false), showDropdown: true };

    const close = searchBarReducer(state, { type: 'RETURN_TO_IDLE', showDropdown: false });
    expect(close.showDropdown).toBe(false);

    const open = searchBarReducer(state, { type: 'RETURN_TO_IDLE', showDropdown: true });
    expect(open.showDropdown).toBe(true);
  });
});

describe('createInitialState', () => {
  it('creates initial state with dropdown closed (effect controls opening)', () => {
    // showDropdown always starts false - the useSearchBarState effect decides
    // whether to open it based on newTabOpensDropdown config
    const state = createInitialState(false);
    expect(state.showDropdown).toBe(false);
  });

  it('creates initial state with dropdown closed regardless of hasCurrentLayout', () => {
    const state = createInitialState(true);
    expect(state.showDropdown).toBe(false);
  });

  it('initializes all fields correctly', () => {
    const state = createInitialState(false);
    expect(state.searchQuery).toBe('');
    expect(state.selectedLayoutId).toBeNull();
    expect(state.paramValues).toEqual({});
    expect(state.currentParamIndex).toBe(0);
    expect(state.isUserSearching).toBe(false);
    expect(state.isPendingLayout).toBeNull();
  });
});

describe('DISMISS action', () => {
  it('closes dropdown and returns to idle', () => {
    const state = {
      ...createInitialState(false),
      showDropdown: true,
      isUserSearching: true,
    };
    const action: SearchBarAction = { type: 'DISMISS', clearSelection: false };
    const newState = searchBarReducer(state, action);

    expect(newState.showDropdown).toBe(false);
    expect(newState.isUserSearching).toBe(false);
  });

  it('clears selection when clearSelection is true', () => {
    const state = {
      ...createInitialState(false),
      selectedLayoutId: 'chart',
      paramValues: { type: 'bar' },
      currentParamIndex: 1,
    };
    const action: SearchBarAction = { type: 'DISMISS', clearSelection: true };
    const newState = searchBarReducer(state, action);

    expect(newState.selectedLayoutId).toBeNull();
    expect(newState.paramValues).toEqual({});
    expect(newState.currentParamIndex).toBe(0);
  });

  it('preserves selection when clearSelection is false', () => {
    const state = {
      ...createInitialState(false),
      selectedLayoutId: 'chart',
      paramValues: { type: 'bar' },
      currentParamIndex: 1,
    };
    const action: SearchBarAction = { type: 'DISMISS', clearSelection: false };
    const newState = searchBarReducer(state, action);

    expect(newState.selectedLayoutId).toBe('chart');
    expect(newState.paramValues).toEqual({ type: 'bar' });
    expect(newState.currentParamIndex).toBe(1);
  });

  it('clears pending layout', () => {
    const state = {
      ...createInitialState(false),
      isPendingLayout: 'chart',
    };
    const action: SearchBarAction = { type: 'DISMISS', clearSelection: false };
    const newState = searchBarReducer(state, action);

    expect(newState.isPendingLayout).toBeNull();
  });
});
