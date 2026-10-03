import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../../utils/cn';

export type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>;

const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, LabelProps>(
  ({ className, ...props }, ref) => (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        'tw:text-sm tw:leading-none tw:font-medium tw:text-foreground',
        'tw:peer-disabled:cursor-not-allowed tw:peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export { Label };
