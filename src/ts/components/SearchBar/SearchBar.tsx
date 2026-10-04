import React, { memo } from 'react';
import type { PanelId } from '@types';
import { useSearchBarState } from './useSearchBarState';
import { DisplayMode } from './DisplayMode';
import { SearchMode } from './SearchMode';
import { ParamsMode } from './ParamsMode';
import { OptionsMode } from './OptionsMode';

/** Holds the props of `SearchBar`. */
interface SearchBarProps {
  panelId: PanelId;
}

/**
 * Renders the search bar of a panel in the mode that `deriveMode` gives: the name of the current
 * layout, the layout search, the parameter input or the option list. It renders nothing while the
 * search bars are hidden.
 */
export const SearchBar = memo(function SearchBar({ panelId }: SearchBarProps) {
  const { mode, displayProps, paramsProps, optionsProps, searchProps } = useSearchBarState(panelId);

  if (mode === 'hidden') return null;
  if (mode === 'display' && displayProps) return <DisplayMode {...displayProps} />;
  if (mode === 'params' && paramsProps) return <ParamsMode {...paramsProps} />;
  if (mode === 'options' && optionsProps) return <OptionsMode {...optionsProps} />;
  return <SearchMode {...searchProps} />;
});
