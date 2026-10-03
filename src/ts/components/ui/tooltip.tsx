import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { usePortalContainer } from '../../context/PortalContainerContext';
import { cn } from '../../utils/cn';

function TooltipProvider({
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

const TooltipRoot = TooltipPrimitive.Root;

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

export { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent, TooltipRoot };
