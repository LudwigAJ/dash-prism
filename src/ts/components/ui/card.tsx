/**
 * @fileoverview Card primitives from shadcn/ui, in the Tailwind 4 form with `data-slot` attributes.
 * Local changes: each utility class has the `tw:` prefix. `CardTitle` renders an `h3` element, so a
 * screen reader announces a card title as a heading. `CardAction` and `CardFooter` stay although
 * Prism does not use them.
 */
import * as React from 'react';
import { cn } from '../../utils/cn';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'tw:flex tw:flex-col tw:gap-6 tw:rounded-xl tw:border tw:bg-card tw:py-6 tw:text-card-foreground tw:shadow-sm',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "tw:@container/card-header tw:grid tw:auto-rows-min tw:grid-rows-[auto_auto] tw:items-start tw:gap-2 tw:px-6 tw:has-data-[slot=card-action]:grid-cols-[1fr_auto] tw:[&[class~='tw:border-b']]:pb-6",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      data-slot="card-title"
      className={cn('tw:leading-none tw:font-semibold', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('tw:text-sm tw:text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'tw:col-start-2 tw:row-span-2 tw:row-start-1 tw:self-start tw:justify-self-end',
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('tw:px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn("tw:flex tw:items-center tw:px-6 tw:[&[class~='tw:border-t']]:pt-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
