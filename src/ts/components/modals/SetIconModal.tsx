import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { TAB_ICON_NAMES, getTabIcon, getIconLabel } from '@constants/tab-icons';
import { cn } from '@utils/cn';
import type { Tab } from '@types';

export type SetIconModalProps = {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Tab to set icon for */
  tab: Tab | null;
  /** Callback when an icon is selected */
  onSelectIcon: (tabId: string, icon: string | undefined) => void;
};

/**
 * SetIconModal - Displays a scrollable grid of icons for tab customization
 *
 * Uses Radix Dialog for accessible modal behavior.
 * Shows all available Lucide icons from TAB_ICONS constant.
 * Includes "Remove Icon" option if tab already has an icon.
 */
export function SetIconModal({ open, onOpenChange, tab, onSelectIcon }: SetIconModalProps) {
  if (!tab) return null;

  const handleSelectIcon = (iconName: string) => {
    onSelectIcon(tab.id, iconName);
    onOpenChange(false);
  };

  const handleRemoveIcon = () => {
    onSelectIcon(tab.id, undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Icon</DialogTitle>
        </DialogHeader>

        {/* Scrollable icon grid */}
        <div className="mt-4 max-h-[300px] overflow-y-auto">
          <div className="grid grid-cols-6 gap-2 p-1">
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
                    'flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                    'hover:bg-muted focus:ring-ring focus:ring-2 focus:outline-none',
                    isSelected && 'bg-primary/20 ring-primary ring-2'
                  )}
                >
                  <Icon className="size-[1.25em]" />
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="mt-4 flex gap-2">
          {tab.icon && (
            <Button variant="outline" onClick={handleRemoveIcon}>
              Remove Icon
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SetIconModal;
