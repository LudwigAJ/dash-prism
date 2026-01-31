import React from 'react';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@utils/cn';
import type { LayoutParam } from '@types';

export type ParamsModeProps = {
  selectedLayoutName: string;
  currentParam: LayoutParam;
  currentParamIndex: number;
  totalParams: number;
  paramValue: string;
  onParamValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: (e: React.FocusEvent) => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
};

export const ParamsMode = ({
  selectedLayoutName,
  currentParam,
  currentParamIndex,
  totalParams,
  paramValue,
  onParamValueChange,
  onKeyDown,
  onBlur,
  onCancel,
  inputRef,
}: ParamsModeProps) => {
  const hasDefault = currentParam.hasDefault && currentParam.default;
  const showDefaultHint = hasDefault && paramValue === '';

  return (
    <div className={cn('prism-searchbar prism-searchbar-params pl-3')}>
      {/* Counter */}
      <span className="text-muted-foreground text-sm whitespace-nowrap">
        ({currentParamIndex + 1}/{totalParams})
      </span>

      {/* Layout name */}
      <span className="prism-searchbar-layout-name">{selectedLayoutName}</span>

      {/* Chevron separator */}
      <ChevronRight className="text-muted-foreground mx-1 size-[1em] flex-shrink-0" />

      {/* Param label */}
      <span className="text-muted-foreground text-sm whitespace-nowrap">{currentParam.name}:</span>

      {/* Input field with inline default hint */}
      <div className="relative ml-2 flex min-w-0 flex-1 items-center">
        <input
          ref={inputRef}
          className="w-full border-none bg-transparent text-sm outline-none"
          value={paramValue}
          onChange={(e) => onParamValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          autoFocus
        />
        {showDefaultHint && (
          <span className="text-muted-foreground/60 pointer-events-none absolute left-0 text-sm">
            {currentParam.default}
          </span>
        )}
      </div>

      {/* Cancel X button */}
      <button
        className="text-muted-foreground hover:text-destructive ml-2 flex-shrink-0 p-1 transition-colors"
        onClick={onCancel}
        title="Cancel"
      >
        <X className="size-[1em]" />
      </button>
    </div>
  );
};

ParamsMode.displayName = 'ParamsMode';
