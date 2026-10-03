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
    <div className={cn('prism-searchbar prism-searchbar-params tw:pl-3')}>
      {/* Counter */}
      <span className="tw:text-sm tw:whitespace-nowrap tw:text-muted-foreground">
        ({currentParamIndex + 1}/{totalParams})
      </span>

      {/* Layout name */}
      <span className="prism-searchbar-layout-name">{selectedLayoutName}</span>

      {/* Chevron separator */}
      <ChevronRight className="tw:mx-1 tw:size-[1em] tw:flex-shrink-0 tw:text-muted-foreground" />

      {/* Param label + type hint */}
      <span className="tw:text-sm tw:whitespace-nowrap tw:text-muted-foreground">
        {currentParam.title ?? currentParam.name}:
        {hint && <span className="tw:ml-1 tw:text-xs tw:text-muted-foreground/70">{hint}</span>}
      </span>

      {/* Input field with inline default hint */}
      <div className="tw:relative tw:ml-2 tw:flex tw:min-w-0 tw:flex-1 tw:items-center">
        <input
          ref={inputRef}
          data-testid="prism-searchbar-param-input"
          className={cn(
            'tw:w-full tw:border-none tw:bg-transparent tw:text-sm tw:outline-none',
            paramError && 'tw:text-destructive'
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
          <span className="tw:pointer-events-none tw:absolute tw:left-0 tw:text-sm tw:text-muted-foreground/60">
            {formatDefault(currentParam.default)}
          </span>
        )}

        {/* Choice list for enum params */}
        {isEnum && choices.length > 0 && (
          <ul
            role="listbox"
            data-testid="prism-searchbar-param-choices"
            className="tw:absolute tw:top-full tw:left-0 tw:z-[100] tw:mt-1 tw:max-h-60 tw:min-w-40 tw:overflow-y-auto tw:rounded-sm tw:border tw:border-border tw:bg-popover tw:py-1 tw:text-sm tw:shadow-md"
          >
            {choices.map((choice) => (
              <li key={choice} role="option" aria-selected={choice === paramValue}>
                <button
                  type="button"
                  data-testid={`prism-searchbar-param-choice-${choice}`}
                  className="tw:w-full tw:px-3 tw:py-1 tw:text-left tw:hover:bg-muted"
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
          className="tw:ml-2 tw:text-xs tw:whitespace-nowrap tw:text-destructive"
        >
          {paramError}
        </span>
      )}

      {/* Cancel X button */}
      <button
        className="tw:ml-2 tw:flex-shrink-0 tw:p-1 tw:text-muted-foreground tw:transition-colors tw:hover:text-destructive"
        onClick={onCancel}
        title="Cancel"
      >
        <X className="tw:size-[1em]" />
      </button>
    </div>
  );
};

ParamsMode.displayName = 'ParamsMode';
