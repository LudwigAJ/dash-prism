import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@utils/cn';
import type { Tab } from '@types';

/** Holds the props of `DisplayMode`. */
export interface DisplayModeProps {
  currentLayoutName: string;
  activeTab: Tab | null;
  onDisplayClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Renders the search bar of a tab that shows a layout: the layout name with its option or
 * parameter values. A click or a typed character starts a new search.
 */
export function DisplayMode({
  currentLayoutName,
  activeTab,
  onDisplayClick,
  onKeyDown,
}: DisplayModeProps) {
  const params = activeTab?.layoutParams;
  const option = activeTab?.layoutOption;
  const hasParams = params && Object.keys(params).length > 0;
  const hasOption = Boolean(option);

  return (
    <button
      type="button"
      data-testid="prism-search-bar-display"
      className={cn('prism-search-bar prism-search-bar-display tw:text-left')}
      onClick={onDisplayClick}
      onKeyDown={onKeyDown}
    >
      <span className="prism-search-bar-layout-name">{currentLayoutName}</span>
      {hasOption && (
        <>
          <ChevronRight className="tw:mx-1 tw:size-[1em] tw:flex-shrink-0 tw:text-muted-foreground" />
          <span className="tw:text-sm tw:text-primary">{option}</span>
        </>
      )}
      {hasParams &&
        Object.values(params).map((value, i) => (
          <React.Fragment key={i}>
            <ChevronRight className="tw:mx-1 tw:size-[1em] tw:flex-shrink-0 tw:text-muted-foreground" />
            <span className="tw:text-sm tw:text-primary">{value}</span>
          </React.Fragment>
        ))}
    </button>
  );
}
