import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { cn } from '@utils/cn';

// Version injected at build time from package.json via webpack DefinePlugin
const VERSION = process.env.APP_VERSION ?? '0.0.0';

export type HelpModalProps = {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Version string to display */
  version?: string;
};

/**
 * HelpModal - Displays keyboard shortcuts and help information
 *
 * Uses Radix Dialog for accessible modal behavior.
 * Shows version info, keyboard shortcuts, and feature documentation.
 *
 * Note: Modal state is managed via local useState in PrismView,
 * NOT in Redux (see Reversibility Philosophy section).
 */
export function HelpModal({ open, onOpenChange, version = VERSION }: HelpModalProps) {
  // Platform detection for keyboard shortcuts
  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    []
  );

  const modKeys = useMemo(
    () => ({
      ctrl: isMac ? '⌃' : 'Ctrl',
      shift: isMac ? '⇧' : 'Shift',
    }),
    [isMac]
  );

  const kbdClass = cn(
    'inline-flex items-center justify-center',
    'px-2 py-1 min-w-[1.5rem] h-6',
    'bg-muted border border-border rounded-md',
    'text-xs font-mono font-medium text-foreground',
    'shadow-sm'
  );

  const shortcutRowClass = cn(
    'flex items-center justify-between gap-4',
    'py-2 border-b border-border/50 last:border-0'
  );

  const shortcutLabelClass = cn('text-foreground text-sm');

  const sectionTitleClass = cn(
    'text-xs font-semibold uppercase tracking-wider text-muted-foreground',
    'mt-6 mb-3 first:mt-0'
  );

  const sectionBoxClass = cn('rounded-lg border border-border bg-card p-3');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle>Prism</DialogTitle>
          <DialogDescription>Version {version}</DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="-mr-2 flex-1 overflow-y-auto pt-2 pr-2">
          <h4 className={sectionTitleClass}>Keyboard Shortcuts</h4>
          <div className={sectionBoxClass}>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>New tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>N</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Close tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>D</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Duplicate tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>B</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Undo close</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>U</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Lock / unlock tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>O</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Rename tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>R</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Refresh tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>{modKeys.shift}</kbd>
                <kbd className={kbdClass}>R</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Pin / unpin panel</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>I</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Toggle search bars</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>Y</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Previous / next tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>J</kbd>
                <span className="text-muted-foreground text-xs">/</span>
                <kbd className={kbdClass}>K</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Focus search</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                <kbd className={kbdClass}>Space</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Navigate results</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>↑</kbd>
                <span className="text-muted-foreground text-xs">/</span>
                <kbd className={kbdClass}>↓</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className={shortcutLabelClass}>Select layout</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>Enter</kbd>
              </div>
            </div>
            <div className={cn(shortcutRowClass, 'border-b-0')}>
              <span className={shortcutLabelClass}>Cancel / Close modal</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>Esc</kbd>
              </div>
            </div>
          </div>

          <h4 className={sectionTitleClass}>Tab Management</h4>
          <div className={cn(sectionBoxClass, 'space-y-2')}>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Right-click</strong> a tab for context menu
              options
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Double-click</strong> a tab to rename it
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Drag tabs</strong> to reorder them within a panel
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Locked tabs</strong> cannot be closed or renamed
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Share</strong> a tab to copy a link that opens the
              same layout
            </p>
          </div>

          <h4 className={sectionTitleClass}>Panel Management</h4>
          <div className={cn(sectionBoxClass, 'space-y-2')}>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Split panels</strong> by dragging a tab to the
              edge of another panel
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Move tabs</strong> between panels by dragging to
              the tab bar
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Pin a panel</strong> via context menu to prevent
              tab changes
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Close a panel</strong> by closing all its tabs (or
              drag tabs away)
            </p>
            <p className="text-muted-foreground text-sm">
              <strong className="text-foreground">Resize panels</strong> by dragging the divider
              between them
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HelpModal;
