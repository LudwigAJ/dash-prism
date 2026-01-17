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

export type InfoModalProps = {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Tab data to display */
  tab: Tab | null;
};

/**
 * InfoModal - Displays detailed information about a tab
 *
 * Uses Radix Dialog for accessible modal behavior.
 * Shows tab name, ID, creation date, layout, lock status, and parameters.
 *
 * Note: Modal state is managed via local useState in PrismView,
 * NOT in Redux (see Reversibility Philosophy section).
 */
export function InfoModal({ open, onOpenChange, tab }: InfoModalProps) {
  const rowClass = cn(
    'flex items-center justify-between gap-4 py-2.5',
    'border-b border-border/50 last:border-0'
  );

  const labelClass = 'text-sm text-muted-foreground';
  const valueClass = 'text-sm font-medium text-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tab Information</DialogTitle>
        </DialogHeader>

        {tab && (
          <div className="border-border bg-card mt-4 rounded-lg border p-4">
            <div className={rowClass}>
              <span className={labelClass}>Name</span>
              <span className={valueClass}>{tab.name}</span>
            </div>
            <div className={rowClass}>
              <span className={labelClass}>ID</span>
              <span className="text-muted-foreground font-mono text-xs">{tab.id}</span>
            </div>
            <div className={rowClass}>
              <span className={labelClass}>Panel ID</span>
              <span className="text-muted-foreground font-mono text-xs">
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
              <div className={cn(rowClass, 'flex-col items-start gap-2 border-b-0')}>
                <span className={labelClass}>Parameters</span>
                <pre className="text-muted-foreground bg-muted w-full overflow-x-auto rounded-md p-2 font-mono text-xs">
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

export default InfoModal;
