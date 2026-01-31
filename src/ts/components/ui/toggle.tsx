import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@utils/cn';

const toggleVariants = cva(
  'inline-flex items-center justify-center rounded-md p-1.5 transition-colors hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      pressed: {
        true: 'text-primary',
        false: '',
      },
      size: {
        sm: 'p-1',
        md: 'p-1.5',
        lg: 'p-2',
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
        aria-checked={pressed}
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
