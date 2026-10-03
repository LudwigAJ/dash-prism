import * as React from 'react';
import { cn } from '../../utils/cn';

export type InputProps = React.ComponentProps<'input'>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          'tw:h-9 tw:w-full tw:min-w-0 tw:rounded-md tw:border tw:border-input tw:bg-transparent tw:px-3 tw:py-1 tw:text-base tw:shadow-xs tw:transition-[color,box-shadow] tw:outline-none tw:selection:bg-primary tw:selection:text-primary-foreground tw:file:inline-flex tw:file:h-7 tw:file:border-0 tw:file:bg-transparent tw:file:text-sm tw:file:font-medium tw:file:text-foreground tw:placeholder:text-muted-foreground tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:md:text-sm tw:dark:bg-input/30',
          'tw:focus-visible:border-ring tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/50',
          'tw:aria-invalid:border-destructive tw:aria-invalid:ring-destructive/20 tw:dark:aria-invalid:ring-destructive/40',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
