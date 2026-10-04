/**
 * @fileoverview Spinner from shadcn/ui, a turning Lucide loader icon.
 * Local changes: each utility class has the `tw:` prefix. The size is a `cva` variant in em, so
 * that the spinner scales with the text around it, and the stroke is wider.
 */
import * as React from 'react';
import { Loader2 as Loader2Icon } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@utils/cn';

const spinnerVariants = cva('tw:animate-spin tw:stroke-[2.5]', {
  variants: {
    size: {
      sm: 'tw:size-[1.2em]',
      md: 'tw:size-[1.5em]',
      lg: 'tw:size-[1.75em]',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type SpinnerProps = React.ComponentProps<'svg'> & VariantProps<typeof spinnerVariants>;

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

export { Spinner };
