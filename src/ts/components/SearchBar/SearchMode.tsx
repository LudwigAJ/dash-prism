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
  onResizeStart,
  inputRef,
  commandRef,
}: SearchModeProps) => {
  return (
    <div className={cn('prism-searchbar')} ref={commandRef} data-testid="prism-searchbar">
      <Command shouldFilter={false} className="prism-command flex-1 overflow-visible">
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
            className="bg-popover border-border absolute top-full right-0 left-0 z-[100] border"
            style={{ maxHeight: dropdownHeight }}
          >
            {filteredLayouts.length === 0 ? (
              <CommandEmpty>No layouts found</CommandEmpty>
            ) : (
              <CommandGroup heading="Available Layouts">
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
                          'mr-2 shrink-0 rounded p-0.5 transition-colors',
                          'hover:bg-muted focus-visible:ring-ring focus-visible:ring-1 focus-visible:outline-none',
                          isFavorite ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                        )}
                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star
                          className={cn('h-4 w-4 text-current', isFavorite && 'fill-current')}
                        />
                      </button>
                      <div className="flex flex-1 items-center gap-3 overflow-hidden">
                        <span className="shrink-0 font-medium">{meta.name}</span>
                        {meta.description && (
                          <span className="text-muted-foreground truncate text-sm">
                            {meta.description}
                          </span>
                        )}
                      </div>
                      {hasParams ? (
                        <span className="text-muted-foreground ml-auto text-xs" aria-hidden="true">
                          {'>'}
                        </span>
                      ) : hasOptions ? (
                        <List
                          className="text-muted-foreground ml-auto h-3.5 w-3.5"
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
