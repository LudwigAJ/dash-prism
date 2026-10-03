import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Ban } from 'lucide-react';
import { TAB_ICON_NAMES, getTabIcon, getIconLabel } from '@constants/tab-icons';
import { cn } from '@utils/cn';
import type { Tab, TabId } from '@types';

export type SetIconModalProps = {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Tab to set icon for */
  tab: Tab | null;
  /** Callback when an icon is selected */
  onSelectIcon: (tabId: TabId, icon: string | undefined) => void;
};

/**
 * Displays a scrollable grid of icons for tab customization.
 *
 * Uses Radix Dialog for accessible modal behavior.
 * Shows all available Lucide icons from TAB_ICONS constant.
 * First icon is a "Ban" (no icon) option to remove the current icon.
 */
export function SetIconModal({ open, onOpenChange, tab, onSelectIcon }: SetIconModalProps) {
  if (!tab) return null;

  const handleSelectIcon = (iconName: string | undefined) => {
    onSelectIcon(tab.id, iconName);
    onOpenChange(false);
  };

  const noIconSelected = !tab.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Icon</DialogTitle>
        </DialogHeader>

        {/* Scrollable icon grid */}
        <div className="tw:mt-4 tw:max-h-[300px] tw:overflow-y-auto">
          <div className="tw:grid tw:grid-cols-6 tw:gap-2 tw:p-1">
            {/* No icon option */}
            <button
              type="button"
              onClick={() => handleSelectIcon(undefined)}
              title="No icon"
              className={cn(
                'tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center tw:rounded-md tw:transition-colors',
                'tw:hover:bg-foreground/10 tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:outline-none',
                noIconSelected && 'tw:ring-2 tw:ring-foreground/35'
              )}
            >
              <Ban className="tw:size-[1.25em]" />
            </button>

            {TAB_ICON_NAMES.map((iconName) => {
              const Icon = getTabIcon(iconName);
              if (!Icon) return null;

              const isSelected = tab.icon === iconName;

              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => handleSelectIcon(iconName)}
                  title={getIconLabel(iconName)}
                  className={cn(
                    'tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center tw:rounded-md tw:transition-colors',
                    'tw:hover:bg-foreground/10 tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:outline-none',
                    isSelected && 'tw:ring-2 tw:ring-foreground/35'
                  )}
                >
                  <Icon className="tw:size-[1.25em]" />
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="tw:mt-4 tw:flex tw:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
