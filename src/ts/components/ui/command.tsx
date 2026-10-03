import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    data-slot="command"
    className={cn(
      'tw:flex tw:h-full tw:w-full tw:flex-col tw:overflow-hidden tw:bg-popover tw:text-popover-foreground',
      className
    )}
    {...props}
  />
));
Command.displayName = 'Command';

type CommandDialogProps = React.ComponentProps<typeof Dialog> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
};

const CommandDialog = ({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  ...props
}: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogHeader className="tw:sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent
        className={cn('tw:overflow-hidden tw:p-0', className)}
        showCloseButton={showCloseButton}
      >
        <Command className="tw:**:data-[slot=command-input-wrapper]:h-12 tw:[&_[cmdk-group-heading]]:px-2 tw:[&_[cmdk-group-heading]]:font-medium tw:[&_[cmdk-group-heading]]:text-muted-foreground tw:[&_[cmdk-group]]:px-2 tw:[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 tw:[&_[cmdk-input-wrapper]_svg]:h-5 tw:[&_[cmdk-input-wrapper]_svg]:w-5 tw:[&_[cmdk-input]]:h-12 tw:[&_[cmdk-item]]:px-2 tw:[&_[cmdk-item]]:py-3 tw:[&_[cmdk-item]_svg]:h-5 tw:[&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};
CommandDialog.displayName = 'CommandDialog';

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    data-slot="command-input-wrapper"
    className="tw:flex tw:h-9 tw:items-center tw:gap-2 tw:px-3"
  >
    <ChevronRight className="tw:size-4 tw:shrink-0 tw:opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      data-slot="command-input"
      className={cn(
        'tw:flex tw:h-10 tw:w-full tw:rounded-md tw:bg-transparent tw:py-3 tw:text-sm tw:outline-hidden tw:placeholder:text-muted-foreground tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = 'CommandInput';

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    data-slot="command-list"
    className={cn(
      'tw:max-h-[300px] tw:scroll-py-1 tw:overflow-x-hidden tw:overflow-y-auto',
      className
    )}
    {...props}
  />
));
CommandList.displayName = 'CommandList';

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    data-slot="command-empty"
    className="tw:py-6 tw:text-center tw:text-sm"
    {...props}
  />
));
CommandEmpty.displayName = 'CommandEmpty';

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    data-slot="command-group"
    className={cn(
      'tw:overflow-hidden tw:p-1 tw:text-foreground tw:[&_[cmdk-group-heading]]:px-2 tw:[&_[cmdk-group-heading]]:py-1.5 tw:[&_[cmdk-group-heading]]:text-xs tw:[&_[cmdk-group-heading]]:font-medium tw:[&_[cmdk-group-heading]]:text-muted-foreground',
      className
    )}
    {...props}
  />
));
CommandGroup.displayName = 'CommandGroup';

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    data-slot="command-separator"
    className={cn('tw:-mx-1 tw:h-px tw:bg-border', className)}
    {...props}
  />
));
CommandSeparator.displayName = 'CommandSeparator';

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    data-slot="command-item"
    className={cn(
      'tw:relative tw:flex tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-sm tw:outline-hidden tw:select-none tw:data-[disabled=true]:pointer-events-none tw:data-[disabled=true]:opacity-50 tw:data-[selected=true]:bg-muted tw:data-[selected=true]:text-foreground tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*="size-"])]:size-4 tw:[&_svg:not([class*="text-"])]:text-muted-foreground',
      className
    )}
    {...props}
  />
));
CommandItem.displayName = 'CommandItem';

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    data-slot="command-shortcut"
    className={cn('tw:ml-auto tw:text-xs tw:tracking-widest tw:text-muted-foreground', className)}
    {...props}
  />
);
CommandShortcut.displayName = 'CommandShortcut';

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
};
