import { useEffect, type Dispatch } from 'react';
import type { PanelId, TabId } from '@types';
import { useConfig } from '@context/ConfigContext';
import {
  useAppDispatch,
  useAppSelector,
  selectSearchBarsHidden,
  selectLayoutSelectionRequest,
  selectSearchFocusPanelId,
  toggleSearchBars,
  clearLayoutSelectionRequest,
  clearSearchFocusRequest,
} from '@store';
import type { SearchBarAction } from './searchBarReducer';
import { layoutHasOptions, layoutHasParams } from './searchBarUtils';

/** Holds what `useSearchBarEvents` needs from the search bar state. */
interface SearchBarEventsOptions {
  panelId: PanelId;
  activeTabId: TabId | undefined;
  pendingLayoutId: string | null;
  dispatch: Dispatch<SearchBarAction>;
  handleLayoutSelect: (layoutId: string) => void;
  focusInput: () => void;
}

/**
 * Handles the requests that reach a search bar from outside it: a layout that the user picked on
 * the empty-tab screen, and the focus request of the Focus search shortcut. The search bar of the
 * panel that the request targets handles it and clears it in the store. A layout with parameters
 * or options waits while the search bars are hidden, until they show again.
 */
export function useSearchBarEvents({
  panelId,
  activeTabId,
  pendingLayoutId,
  dispatch,
  handleLayoutSelect,
  focusInput,
}: SearchBarEventsOptions) {
  const globalDispatch = useAppDispatch();
  const searchBarsHidden = useAppSelector(selectSearchBarsHidden);
  const layoutRequest = useAppSelector(selectLayoutSelectionRequest);
  const searchFocusPanelId = useAppSelector(selectSearchFocusPanelId);
  const { registeredLayouts } = useConfig();

  useEffect(() => {
    if (layoutRequest === null || layoutRequest.tabId !== activeTabId) return;
    globalDispatch(clearLayoutSelectionRequest());

    const layout = registeredLayouts[layoutRequest.layoutId];
    if (!layout) return;

    if (searchBarsHidden && (layoutHasParams(layout) || layoutHasOptions(layout))) {
      dispatch({ type: 'SET_PENDING_LAYOUT', layoutId: layoutRequest.layoutId });
      globalDispatch(toggleSearchBars());
      return;
    }

    handleLayoutSelect(layoutRequest.layoutId);
  }, [
    layoutRequest,
    activeTabId,
    registeredLayouts,
    searchBarsHidden,
    handleLayoutSelect,
    dispatch,
    globalDispatch,
  ]);

  useEffect(() => {
    if (searchBarsHidden) {
      dispatch({ type: 'SET_SHOW_DROPDOWN', show: false });
      return;
    }

    if (pendingLayoutId) {
      dispatch({ type: 'SET_PENDING_LAYOUT', layoutId: null });
      handleLayoutSelect(pendingLayoutId);
      focusInput();
    }
  }, [searchBarsHidden, pendingLayoutId, handleLayoutSelect, focusInput, dispatch]);

  useEffect(() => {
    if (searchFocusPanelId !== panelId) return;
    globalDispatch(clearSearchFocusRequest());
    if (searchBarsHidden) return;

    dispatch({ type: 'ENTER_SEARCH_MODE' });
    focusInput();
  }, [searchFocusPanelId, panelId, searchBarsHidden, focusInput, dispatch, globalDispatch]);
}
