import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@utils/cn';
import type { Tab } from '@types';

export type DisplayModeProps = {
  currentLayoutName: string;
  activeTab: Tab | null;
  onDisplayClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
};

export const DisplayMode = ({
  currentLayoutName,
  activeTab,
  onDisplayClick,
  onKeyDown,
}: DisplayModeProps) => {
  const params = activeTab?.layoutParams;
  const option = activeTab?.layoutOption;
  const hasParams = params && Object.keys(params).length > 0;
  const hasOption = Boolean(option);

  return (
    <button
      type="button"
      data-testid="prism-searchbar-display"
      className={cn('prism-searchbar prism-searchbar-display tw:text-left')}
      onClick={onDisplayClick}
      onKeyDown={onKeyDown}
    >
      <span className="prism-searchbar-layout-name">{currentLayoutName}</span>
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
};

DisplayMode.displayName = 'DisplayMode';
