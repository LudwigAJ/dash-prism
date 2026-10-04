import React from 'react';
import { List } from 'lucide-react';
import { FavoriteStar } from '@components/FavoriteStar';
import { cn } from '@utils/cn';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from '@components/ui/command';
import type { LayoutMeta } from '@types';
import { layoutHasOptions, layoutHasParams } from './searchBarUtils';

/** Holds the props of `SearchMode`. */
export interface SearchModeProps {
  searchQuery: string;
  filteredLayouts: Array<[string, LayoutMeta]>;
  favoriteLayouts: string[];
  showDropdown: boolean;
  dropdownHeight: number;
  searchBarPlaceholder: string;
  onSearchQueryChange: (value: string) => void;
  onLayoutSelect: (layoutId: string) => void;
  onToggleFavorite: (layoutId: string) => void;
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClick: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  commandRef: React.RefObject<HTMLDivElement>;
}

/** Renders the search bar with the layout search and its dropdown of layouts. */
export function SearchMode({
  searchQuery,
  filteredLayouts,
  favoriteLayouts,
  showDropdown,
  dropdownHeight,
  searchBarPlaceholder,
  onSearchQueryChange,
  onLayoutSelect,
  onToggleFavorite,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onResizeStart,
  inputRef,
  commandRef,
}: SearchModeProps) {
  return (
    // The input opens the dropdown on focus, so a keyboard user needs no key handler here.
    <div
      className={cn('prism-search-bar')}
      ref={commandRef}
      role="presentation"
      data-testid="prism-search-bar"
      onClick={onClick}
    >
      <Command
        shouldFilter={false}
        label="Search layouts"
        className="tw:flex-1 tw:overflow-visible"
      >
        <CommandInput
          ref={inputRef}
          data-testid="prism-search-bar-input"
          value={searchQuery}
          onValueChange={onSearchQueryChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          placeholder={searchBarPlaceholder}
          autoFocus={true}
        />

        {showDropdown && (
          <CommandList
            className="tw:absolute tw:top-full tw:right-0 tw:left-0 tw:z-[100] tw:border tw:border-border tw:bg-popover"
            style={{ maxHeight: dropdownHeight }}
          >
            {filteredLayouts.length === 0 ? (
              <CommandEmpty>No layouts found</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredLayouts.map(([id, meta]) => {
                  const hasOptions = layoutHasOptions(meta);
                  const hasParams = layoutHasParams(meta);

                  return (
                    <CommandItem
                      key={id}
                      data-testid={`prism-layout-item-${id}`}
                      value={`${meta.name} ${meta.keywords?.join(' ') ?? ''}`}
                      onSelect={() => onLayoutSelect(id)}
                    >
                      <FavoriteStar
                        layoutName={meta.name}
                        isFavorite={favoriteLayouts.includes(id)}
                        onToggle={() => onToggleFavorite(id)}
                        className="tw:mr-2 tw:shrink-0 tw:rounded tw:p-0.5 tw:focus-visible:ring-1"
                      />
                      <div className="tw:flex tw:flex-1 tw:items-center tw:gap-3 tw:overflow-hidden">
                        <span className="tw:shrink-0 tw:font-medium">{meta.name}</span>
                        {meta.description && (
                          <span className="tw:truncate tw:text-sm tw:text-muted-foreground">
                            {meta.description}
                          </span>
                        )}
                      </div>
                      {hasParams ? (
                        <span
                          className="tw:ml-auto tw:text-xs tw:text-muted-foreground"
                          aria-hidden="true"
                        >
                          {'>'}
                        </span>
                      ) : hasOptions ? (
                        <List
                          className="tw:ml-auto tw:size-[1em] tw:text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {/* Resize handle. It works with the mouse only, so assistive technology skips it. */}
            <div
              className="prism-search-bar-resize-handle"
              aria-hidden="true"
              onMouseDown={onResizeStart}
            />
          </CommandList>
        )}
      </Command>
    </div>
  );
}
