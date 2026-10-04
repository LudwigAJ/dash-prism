import React, { useEffect, useId, useRef } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { cn } from '@utils/cn';
import type { LayoutParam } from '@types';
import { formatParamHint } from './paramValidation';

/** Holds the props of `ParamsMode`. */
export interface ParamsModeProps {
  selectedLayoutName: string;
  currentParam: LayoutParam;
  currentParamIndex: number;
  totalParams: number;
  paramValue: string;
  /** Inline validation message for the current input, if any */
  paramError: string | null;
  /** Choices that match the input, for an enum param */
  choices: string[];
  /** The choice that the arrow keys marked, if any */
  activeChoice: string | null;
  onParamValueChange: (value: string) => void;
  /** A choice picked from the list shown for enum params */
  onChoiceSelect: (value: string) => void;
  /** The pointer moved over a choice */
  onChoiceHover: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: (e: React.FocusEvent) => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

function formatDefault(value: LayoutParam['default']): string {
  if (Array.isArray(value)) return value.map(String).join(', ');
  return String(value);
}

/**
 * Renders the search bar while the user types the parameters of the selected layout, one at a
 * time, with the choice list of an enum parameter.
 */
export function ParamsMode({
  selectedLayoutName,
  currentParam,
  currentParamIndex,
  totalParams,
  paramValue,
  paramError,
  choices,
  activeChoice,
  onParamValueChange,
  onChoiceSelect,
  onChoiceHover,
  onKeyDown,
  onBlur,
  onCancel,
  inputRef,
}: ParamsModeProps) {
  // Falsy defaults (0, false, '') are real defaults too.
  const hasDefault =
    currentParam.hasDefault && currentParam.default !== undefined && currentParam.default !== null;
  const showDefaultHint = hasDefault && paramValue === '';
  const hint = formatParamHint(currentParam);
  const isEnum = currentParam.type === 'enum' && (currentParam.choices?.length ?? 0) > 0;
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const optionId = (index: number) => `${listId}-option-${index}`;
  const activeIndex = activeChoice === null ? -1 : choices.indexOf(activeChoice);
  const numeric = currentParam.type === 'integer' || currentParam.type === 'number';
  const errorId = `prism-param-error-${currentParam.name}`;

  // The arrow keys can mark a choice outside the visible part of the list. The list scrolls
  // alone: scrollIntoView would also scroll the panel around it and hide the input.
  useEffect(() => {
    const list = listRef.current;
    const option = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !option) return;
    const optionBottom = option.offsetTop + option.offsetHeight;
    if (option.offsetTop < list.scrollTop) {
      list.scrollTop = option.offsetTop;
    } else if (optionBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = optionBottom - list.clientHeight;
    }
  }, [activeChoice]);

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
          aria-label={currentParam.title ?? currentParam.name}
          className={cn(
            'tw:w-full tw:border-none tw:bg-transparent tw:text-sm tw:outline-none',
            paramError && 'tw:text-destructive'
          )}
          value={paramValue}
          placeholder={
            showDefaultHint ? '' : (currentParam.placeholder ?? currentParam.description ?? '')
          }
          inputMode={numeric ? 'decimal' : undefined}
          role={isEnum ? 'combobox' : undefined}
          aria-autocomplete={isEnum ? 'list' : undefined}
          aria-expanded={isEnum ? choices.length > 0 : undefined}
          aria-controls={isEnum && choices.length > 0 ? listId : undefined}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
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
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={`${currentParam.title ?? currentParam.name} choices`}
            data-testid="prism-searchbar-param-choices"
            className="tw:absolute tw:top-full tw:left-0 tw:z-[100] tw:mt-1 tw:max-h-60 tw:min-w-40 tw:overflow-y-auto tw:rounded-sm tw:border tw:border-border tw:bg-popover tw:py-1 tw:text-sm tw:shadow-md"
          >
            {choices.map((choice, index) => (
              // The input handles the keys of the combobox, so an option needs no key handler.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                key={choice}
                id={optionId(index)}
                role="option"
                tabIndex={-1}
                aria-selected={choice === activeChoice}
                data-testid={`prism-searchbar-param-choice-${choice}`}
                className={cn(
                  'tw:cursor-default tw:px-3 tw:py-1 tw:hover:bg-muted',
                  // The bar and the weight carry the mark where the muted background is faint.
                  'tw:aria-selected:bg-muted tw:aria-selected:font-medium tw:aria-selected:shadow-[inset_2px_0_0_var(--primary)]'
                )}
                // Keep focus in the input so the search bar does not dismiss on blur
                onMouseDown={(e) => e.preventDefault()}
                // Mouse and keyboard mark the same option, so two never look marked at once
                onMouseMove={() => onChoiceHover(choice)}
                onClick={() => onChoiceSelect(choice)}
              >
                {choice}
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
        type="button"
        className="tw:ml-2 tw:flex-shrink-0 tw:p-1 tw:text-muted-foreground tw:transition-colors tw:hover:text-destructive"
        onClick={onCancel}
        aria-label="Cancel"
        title="Cancel"
      >
        <X className="tw:size-[1em]" />
      </button>
    </div>
  );
}
