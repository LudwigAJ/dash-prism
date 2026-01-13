import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '../../utils/cn';

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

export type TooltipContentProps = React.ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
> & {
  theme?: 'light' | 'dark';
};

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, theme = 'light', ...props }, ref) => {
  const themeClass = theme === 'dark' ? 'prism-theme-dark' : 'prism-theme-light';
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          themeClass,
          'border-border bg-popover text-popover-foreground z-50 overflow-hidden rounded-md border px-3 py-1.5 text-xs shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = 'TooltipContent';

// Convenience wrapper
export type TooltipProps = {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
  theme?: 'light' | 'dark';
};

const Tooltip = ({
  children,
  content,
  side = 'top',
  delayDuration = 200,
  theme = 'light',
}: TooltipProps) => (
  <TooltipProvider delayDuration={delayDuration}>
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} theme={theme}>
        {content}
      </TooltipContent>
    </TooltipRoot>
  </TooltipProvider>
);

export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent };
