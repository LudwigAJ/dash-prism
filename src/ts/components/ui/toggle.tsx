import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@utils/cn';

const toggleVariants = cva(
  'tw:inline-flex tw:items-center tw:justify-center tw:rounded-md tw:p-1.5 tw:transition-colors tw:hover:bg-muted tw:focus-visible:ring-ring tw:focus-visible:ring-2 tw:focus-visible:outline-none tw:disabled:pointer-events-none tw:disabled:opacity-50',
  {
    variants: {
      pressed: {
        true: 'tw:text-primary',
        false: '',
      },
      size: {
        sm: 'tw:p-1',
        md: 'tw:p-1.5',
        lg: 'tw:p-2',
      },
    },
    defaultVariants: {
      pressed: false,
      size: 'md',
    },
  }
);

export type ToggleProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof toggleVariants> & {
    /** Callback when pressed state changes */
    onPressedChange?: (pressed: boolean) => void;
  };

/**
 * A simple toggle button component.
 * Use for boolean on/off states like favorites.
 */
export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, pressed = false, size, onPressedChange, onClick, children, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onPressedChange?.(!pressed);
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={pressed ?? false}
        data-state={pressed ? 'on' : 'off'}
        data-size={size}
        onClick={handleClick}
        className={cn(toggleVariants({ pressed, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Toggle.displayName = 'Toggle';

export { toggleVariants };
