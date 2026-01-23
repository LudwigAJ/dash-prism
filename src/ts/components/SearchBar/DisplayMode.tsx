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
    <div
      className={cn('prism-searchbar prism-searchbar-display')}
      onClick={onDisplayClick}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="button"
    >
      <span className="prism-searchbar-layout-name">{currentLayoutName}</span>
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
};

DisplayMode.displayName = 'DisplayMode';
