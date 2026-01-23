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
      <Command shouldFilter={false} className="prism-command flex-1 overflow-visible">
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
            className="bg-popover border-border absolute top-full right-0 left-0 z-[100] border shadow-lg"
            style={{ maxHeight: dropdownHeight }}
          >
            <CommandItem onSelect={onBackToLayouts}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span>Back to layouts</span>
            </CommandItem>
            <CommandSeparator />
            <CommandGroup heading={`Options for ${selectedLayoutName}`}>
              {Object.entries(paramOptions).map(([key, option]) => (
                <CommandItem key={key} value={key} onSelect={() => onOptionSelect(key)}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key}</span>
                    {option.description && (
                      <span className="text-muted-foreground text-xs">{option.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {/* Resize handle */}
            <div className="prism-searchbar-resize-handle" onMouseDown={onResizeStart} />
          </CommandList>
        )}
      </Command>
    </div>
  );
};

OptionsMode.displayName = 'OptionsMode';
