import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { cn } from '@utils/cn';
import type { Tab } from 'types';

/** Holds the props of `InfoModal`. */
interface InfoModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Tab data to display */
  tab: Tab | null;
}

/**
 * Displays detailed information about a tab.
 *
 * Uses Radix Dialog for accessible modal behavior.
 * Shows tab name, ID, creation date, layout, lock status, and parameters.
 */
export function InfoModal({ open, onOpenChange, tab }: InfoModalProps) {
  const rowClass = cn(
    'tw:flex tw:items-center tw:justify-between tw:gap-4 tw:py-2.5',
    'tw:border-b tw:border-border/50 tw:last:border-0'
  );

  const labelClass = 'tw:text-sm tw:text-muted-foreground';
  const valueClass = 'tw:text-sm tw:font-medium tw:text-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw:max-w-md">
        <DialogHeader>
          <DialogTitle>Tab Information</DialogTitle>
        </DialogHeader>

        {tab && (
          <div className="tw:mt-4 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4">
            <div className={rowClass}>
              <span className={labelClass}>Name</span>
              <span className={valueClass}>{tab.name}</span>
            </div>
            <div className={rowClass}>
              <span className={labelClass}>ID</span>
              <span className="tw:font-mono tw:text-xs tw:text-muted-foreground">{tab.id}</span>
            </div>
            <div className={rowClass}>
              <span className={labelClass}>Panel ID</span>
              <span className="tw:font-mono tw:text-xs tw:text-muted-foreground">
                {tab.panelId || 'None'}
              </span>
            </div>
            <div className={rowClass}>
              <span className={labelClass}>Created</span>
              <span className={valueClass}>{new Date(tab.createdAt).toLocaleString()}</span>
            </div>
            <div className={rowClass}>
              <span className={labelClass}>Layout</span>
              <span className={valueClass}>{tab.layoutId || 'None'}</span>
            </div>
            <div className={rowClass}>
              <span className={labelClass}>Locked</span>
              <span className={valueClass}>{tab.locked ? 'Yes' : 'No'}</span>
            </div>
            {tab.icon && (
              <div className={rowClass}>
                <span className={labelClass}>Icon</span>
                <span className={valueClass}>{tab.icon}</span>
              </div>
            )}
            {tab.style && tab.style !== 'default' && (
              <div className={rowClass}>
                <span className={labelClass}>Style</span>
                <span className={valueClass}>{tab.style}</span>
              </div>
            )}
            {tab.layoutParams && Object.keys(tab.layoutParams).length > 0 && (
              <div className={cn(rowClass, 'tw:flex-col tw:items-start tw:gap-2 tw:border-b-0')}>
                <span className={labelClass}>Parameters</span>
                <pre className="tw:w-full tw:overflow-x-auto tw:rounded-md tw:bg-muted tw:p-2 tw:font-mono tw:text-xs tw:text-muted-foreground">
                  {JSON.stringify(tab.layoutParams, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
