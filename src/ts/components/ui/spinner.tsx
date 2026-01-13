import * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

const spinnerSizes = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
  xl: 'size-8',
} as const;

export type SpinnerSize = keyof typeof spinnerSizes;

export type SpinnerProps = React.ComponentProps<'svg'> & {
  size?: SpinnerSize;
};

const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size = 'sm', ...props }, ref) => (
    <LoaderCircle
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cn('text-muted-foreground animate-spin', spinnerSizes[size], className)}
      {...props}
    />
  )
);
Spinner.displayName = 'Spinner';

export { Spinner, spinnerSizes };
