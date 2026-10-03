import React from 'react';
import { Star, List } from 'lucide-react';
import { cn } from '@utils/cn';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from '../ui/command';
import type { LayoutMeta } from '@types';

export type SearchModeProps = {
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
};

export const SearchMode = ({
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
}: SearchModeProps) => {
  return (
    <div
      className={cn('prism-searchbar')}
      ref={commandRef}
      data-testid="prism-searchbar"
      onClick={onClick}
    >
      <Command shouldFilter={false} className="tw:flex-1 tw:overflow-visible">
        <CommandInput
          ref={inputRef}
          data-testid="prism-searchbar-input"
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
                  const hasOptions = meta.paramOptions && Object.keys(meta.paramOptions).length > 0;
                  const hasParams = meta.params && meta.params.length > 0;
                  const isFavorite = favoriteLayouts.includes(id);

                  return (
                    <CommandItem
                      key={id}
                      data-testid={`prism-layout-item-${id}`}
                      value={`${meta.name} ${meta.keywords?.join(' ') ?? ''}`}
                      onSelect={() => onLayoutSelect(id)}
                    >
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(id);
                        }}
                        className={cn(
                          'tw:mr-2 tw:shrink-0 tw:rounded tw:p-0.5 tw:transition-colors',
                          'tw:hover:bg-muted tw:focus-visible:ring-1 tw:focus-visible:ring-ring tw:focus-visible:outline-none',
                          isFavorite
                            ? 'tw:text-primary'
                            : 'tw:text-muted-foreground tw:hover:text-primary'
                        )}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star
                          className={cn(
                            'tw:size-[1em] tw:text-current',
                            isFavorite && 'tw:fill-current'
                          )}
                        />
                      </button>
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
            {/* Resize handle */}
            <div className="prism-searchbar-resize-handle" onMouseDown={onResizeStart} />
          </CommandList>
        )}
      </Command>
    </div>
  );
};

SearchMode.displayName = 'SearchMode';
