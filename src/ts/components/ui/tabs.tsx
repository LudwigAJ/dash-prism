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
      className={cn('flex flex-col gap-2', className)}
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
      'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-none p-[3px]',
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
      'bg-secondary text-secondary-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-none border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow,opacity] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:opacity-100 data-[state=active]:shadow-sm data-[state=inactive]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
      'data-[loading=true]:opacity-80 data-[locked=true]:opacity-80',
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
      'flex-1 outline-none',
      // Hide inactive tabs using visibility (not display:none) to keep Dash components mounted
      'data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible data-[state=inactive]:absolute data-[state=inactive]:inset-0',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
