import * as React from 'react';
import { Loader2 as Loader2Icon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const spinnerVariants = cva('animate-spin stroke-[2.5]', {
  variants: {
    size: {
      sm: 'size-[1.2em]',
      md: 'size-[1.5em]',
      lg: 'size-[1.75em]',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export type SpinnerProps = React.ComponentProps<'svg'> & VariantProps<typeof spinnerVariants>;

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size, ...props }, ref) => (
    <Loader2Icon
      ref={ref}
      role="status"
      aria-label="Loading"
      data-size={size}
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    />
  )
);
Spinner.displayName = 'Spinner';

export { Spinner, spinnerVariants };
