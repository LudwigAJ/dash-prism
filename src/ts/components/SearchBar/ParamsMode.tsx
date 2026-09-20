import React from 'react';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@utils/cn';
import type { LayoutParam } from '@types';
import { filterChoices, formatParamHint } from './paramValidation';

export type ParamsModeProps = {
  selectedLayoutName: string;
  currentParam: LayoutParam;
  currentParamIndex: number;
  totalParams: number;
  paramValue: string;
  /** Inline validation message for the current input, if any */
  paramError: string | null;
  onParamValueChange: (value: string) => void;
  /** A choice picked from the list shown for enum params */
  onChoiceSelect: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: (e: React.FocusEvent) => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
};

function formatDefault(value: LayoutParam['default']): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}

export const ParamsMode = ({
  selectedLayoutName,
  currentParam,
  currentParamIndex,
  totalParams,
  paramValue,
  paramError,
  onParamValueChange,
  onChoiceSelect,
  onKeyDown,
  onBlur,
  onCancel,
  inputRef,
}: ParamsModeProps) => {
  // Falsy defaults (0, false, '') are real defaults too.
  const hasDefault =
    currentParam.hasDefault && currentParam.default !== undefined && currentParam.default !== null;
  const showDefaultHint = hasDefault && paramValue === '';
  const hint = formatParamHint(currentParam);
  const isEnum = currentParam.type === 'enum' && (currentParam.choices?.length ?? 0) > 0;
  const choices = isEnum ? filterChoices(currentParam, paramValue) : [];
  const numeric = currentParam.type === 'integer' || currentParam.type === 'number';
  const errorId = `prism-param-error-${currentParam.name}`;

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

      {/* Param label + type hint */}
      <span className="text-muted-foreground text-sm whitespace-nowrap">
        {currentParam.title ?? currentParam.name}:
        {hint && <span className="text-muted-foreground/70 ml-1 text-xs">{hint}</span>}
      </span>

      {/* Input field with inline default hint */}
      <div className="relative ml-2 flex min-w-0 flex-1 items-center">
        <input
          ref={inputRef}
          data-testid="prism-searchbar-param-input"
          className={cn(
            'w-full border-none bg-transparent text-sm outline-none',
            paramError && 'text-destructive'
          )}
          value={paramValue}
          placeholder={
            showDefaultHint ? '' : (currentParam.placeholder ?? currentParam.description ?? '')
          }
          inputMode={numeric ? 'decimal' : undefined}
          aria-invalid={Boolean(paramError)}
          aria-describedby={paramError ? errorId : undefined}
          onChange={(e) => onParamValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          autoFocus
        />
        {showDefaultHint && (
          <span className="text-muted-foreground/60 pointer-events-none absolute left-0 text-sm">
            {formatDefault(currentParam.default)}
          </span>
        )}

        {/* Choice list for enum params */}
        {isEnum && choices.length > 0 && (
          <ul
            role="listbox"
            data-testid="prism-searchbar-param-choices"
            className="bg-popover border-border absolute top-full left-0 z-[100] mt-1 max-h-60 min-w-40 overflow-y-auto rounded-sm border py-1 text-sm shadow-md"
          >
            {choices.map((choice) => (
              <li key={choice} role="option" aria-selected={choice === paramValue}>
                <button
                  type="button"
                  data-testid={`prism-searchbar-param-choice-${choice}`}
                  className="hover:bg-muted w-full px-3 py-1 text-left"
                  // Keep focus in the input so the search bar does not dismiss on blur
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onChoiceSelect(choice)}
                >
                  {choice}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Validation message */}
      {paramError && (
        <span
          id={errorId}
          role="alert"
          data-testid="prism-searchbar-param-error"
          className="text-destructive ml-2 text-xs whitespace-nowrap"
        >
          {paramError}
        </span>
      )}

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
