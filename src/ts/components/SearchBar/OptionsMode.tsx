import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@utils/cn';
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandSeparator,
} from '../ui/command';
import type { LayoutOption } from '@types';

export type OptionsModeProps = {
  selectedLayoutName: string;
  paramOptions: Record<string, LayoutOption>;
  showDropdown: boolean;
  dropdownHeight: number;
  onOptionSelect: (optionKey: string) => void;
  onBackToLayouts: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: (e: React.FocusEvent) => void;
  onFocus: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  commandRef: React.RefObject<HTMLDivElement>;
};

export const OptionsMode = ({
  selectedLayoutName,
  paramOptions,
  showDropdown,
  dropdownHeight,
  onOptionSelect,
  onBackToLayouts,
  onKeyDown,
  onBlur,
  onFocus,
  onResizeStart,
  inputRef,
  commandRef,
}: OptionsModeProps) => {
  return (
    <div className={cn('prism-searchbar')} ref={commandRef}>
      <Command shouldFilter={false} className="tw:flex-1 tw:overflow-visible">
        <CommandInput
          ref={inputRef}
          value=""
          placeholder={`Select option for ${selectedLayoutName}...`}
          readOnly
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          onFocus={onFocus}
        />

        {showDropdown && (
          <CommandList
            className="tw:absolute tw:top-full tw:right-0 tw:left-0 tw:z-[100] tw:border tw:border-border tw:bg-popover"
            style={{ maxHeight: dropdownHeight }}
          >
            <CommandItem onSelect={onBackToLayouts}>
              <ArrowLeft className="tw:mr-2 tw:size-[1em]" />
              <span>Back to layouts</span>
            </CommandItem>
            <CommandSeparator />
            <CommandGroup heading={`Options for ${selectedLayoutName}`}>
              {Object.entries(paramOptions).map(([key, option]) => (
                <CommandItem key={key} value={key} onSelect={() => onOptionSelect(key)}>
                  <div className="tw:flex tw:items-center tw:gap-2">
                    <span className="tw:font-medium">{key}</span>
                    {option.description && (
                      <span className="tw:text-xs tw:text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {/* Resize handle. It works with the mouse only, so assistive technology skips it. */}
            <div
              className="prism-searchbar-resize-handle"
              aria-hidden="true"
              onMouseDown={onResizeStart}
            />
          </CommandList>
        )}
      </Command>
    </div>
  );
};

OptionsMode.displayName = 'OptionsMode';
