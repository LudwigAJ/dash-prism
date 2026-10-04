import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { TabInfoRows } from '@components/TabInfoRows';
import type { Tab } from '@types';

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw:max-w-md">
        <DialogHeader>
          <DialogTitle>Tab Information</DialogTitle>
        </DialogHeader>

        {tab && (
          <div className="tw:mt-4 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-4">
            <TabInfoRows tab={tab} variant="modal" />
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
