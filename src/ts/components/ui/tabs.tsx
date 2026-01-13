import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../utils/cn';

/**
 * Tabs Root
 *
 * Wraps content in a tab container. Use `value` and `onValueChange` for controlled tabs.
 */
const Tabs = TabsPrimitive.Root;

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
    className={cn('bg-surface text-secondary flex items-stretch', className)}
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
    data-locked={isLocked || undefined}
    data-loading={isLoading || undefined}
    className={cn(
      // Base styles
      'inline-flex items-center justify-center gap-2',
      'px-3 py-1.5 whitespace-nowrap',
      'text-foreground text-xs font-medium',
      'ring-offset-background transition-all',
      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
      'disabled:pointer-events-none disabled:opacity-50',
      // Inactive state
      'bg-surface hover:bg-surface-dim',
      // Active state (Radix sets data-state="active")
      'data-[state=active]:bg-background data-[state=active]:font-semibold',
      // Border styling
      'border-border border-r',
      // Locked state
      'data-[locked=true]:opacity-80',
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
    className={cn(
      'bg-background flex-1 overflow-auto',
      'ring-offset-background',
      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
      // Hide inactive tabs using visibility (not display:none) to keep Dash components mounted
      'data-[state=inactive]:pointer-events-none data-[state=inactive]:invisible data-[state=inactive]:absolute data-[state=inactive]:inset-0',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
