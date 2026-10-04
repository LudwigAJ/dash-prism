/**
 * @fileoverview Tooltip primitives from shadcn/ui, built on Radix.
 * Local changes: each utility class has the `tw:` prefix. A tooltip opens after 800 ms instead of
 * at once, and has no side offset. The content renders in the portal container of the Prism root,
 * so that it takes the theme of its own Prism instance. Each `Tooltip` has its own
 * `TooltipProvider`, as in shadcn/ui, so the export of the provider is not needed by Prism. It
 * carries the `@public` tag, so knip does not report it.
 */
import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { usePortalContainer } from '@context/PortalContainerContext';
import { cn } from '@utils/cn';

/** @public */
export function TooltipProvider({
  delayDuration = 800,
  skipDelayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const container = usePortalContainer();
  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'tw:animate-in tw:fade-in-0 tw:zoom-in-95 tw:data-[state=closed]:animate-out tw:data-[state=closed]:fade-out-0 tw:data-[state=closed]:zoom-out-95 tw:data-[side=bottom]:slide-in-from-top-2 tw:data-[side=left]:slide-in-from-right-2 tw:data-[side=right]:slide-in-from-left-2 tw:data-[side=top]:slide-in-from-bottom-2 tw:z-50 tw:w-fit tw:origin-(--radix-tooltip-content-transform-origin) tw:rounded-md tw:bg-foreground tw:px-3 tw:py-1.5 tw:text-xs tw:text-balance tw:text-background',
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="tw:z-50 tw:size-2.5 tw:translate-y-[calc(-50%_-_2px)] tw:rotate-45 tw:rounded-[2px] tw:bg-foreground tw:fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
