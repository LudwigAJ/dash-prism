import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../utils/cn';

/**
 * Tabs Root
 *
 * Wraps content in a tab container. Use `value` and `onValueChange` for controlled tabs.
 */
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('tw:flex tw:flex-col tw:gap-2', className)}
      {...props}
    />
  );
}

/**
 * TabsList
 *
 * Container for TabsTrigger elements. Renders as a flexbox row.
 */
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-slot="tabs-list"
    className={cn(
      'tw:inline-flex tw:h-9 tw:w-fit tw:items-center tw:justify-center tw:rounded-none tw:bg-muted tw:p-[3px] tw:text-muted-foreground',
      className
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

/**
 * TabsTrigger
 *
 * Individual tab button. Supports locked and loading states via data attributes.
 */
export type TabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  /** Whether this tab is locked (prevents closing/editing) */
  isLocked?: boolean;
  /** Whether this tab is in a loading state */
  isLoading?: boolean;
};

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, isLocked, isLoading, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-slot="tabs-trigger"
    data-locked={isLocked || undefined}
    data-loading={isLoading || undefined}
    className={cn(
      'tw:inline-flex tw:h-[calc(100%-1px)] tw:flex-1 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-none tw:border tw:border-transparent tw:bg-secondary tw:px-2 tw:py-1 tw:text-sm tw:font-medium tw:whitespace-nowrap tw:text-secondary-foreground tw:transition-[color,box-shadow,opacity] tw:focus-visible:border-ring tw:focus-visible:ring-[3px] tw:focus-visible:ring-ring/50 tw:focus-visible:outline-1 tw:focus-visible:outline-ring tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:data-[state=active]:bg-secondary tw:data-[state=active]:text-secondary-foreground tw:data-[state=active]:opacity-100 tw:data-[state=active]:shadow-sm tw:data-[state=inactive]:opacity-50 tw:dark:data-[state=active]:border-input tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*="size-"])]:size-4',
      'tw:data-[loading=true]:opacity-80 tw:data-[locked=true]:opacity-80',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

/**
 * TabsContent
 *
 * Content panel for each tab. Use `forceMount` to keep content mounted when inactive.
 * Uses visibility instead of display:none so Dash components initialize properly.
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    data-slot="tabs-content"
    className={cn(
      'tw:flex-1 tw:outline-none',
      // Hide inactive tabs with visibility, not with display:none, to keep Dash components mounted.
      // Plotly graphs need a real size to lay out correctly when the tab becomes active.
      // The overflow clip keeps the content of a hidden tab out of the scroll area of the panel.
      'tw:data-[state=inactive]:pointer-events-none tw:data-[state=inactive]:invisible tw:data-[state=inactive]:absolute tw:data-[state=inactive]:inset-0 tw:data-[state=inactive]:overflow-hidden',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
