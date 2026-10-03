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
import { useConfig } from '@context/ConfigContext';

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
 * Displays keyboard shortcuts and help information.
 *
 * Uses Radix Dialog for accessible modal behavior.
 * Shows version info, keyboard shortcuts, and feature documentation.
 *
 * Note: Modal state is managed via local useState in PrismView,
 * NOT in Redux (see Reversibility Philosophy section).
 */
export function HelpModal({ open, onOpenChange, version = VERSION }: HelpModalProps) {
  const { enableKeyboardShortcuts, enableShareLinks } = useConfig();
  // Platform detection for keyboard shortcuts
  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    []
  );

  const modKeys = useMemo(
    () => ({
      ctrl: isMac ? '⌃' : 'Ctrl',
      alt: isMac ? '⌥' : 'Alt',
      shift: isMac ? '⇧' : 'Shift',
    }),
    [isMac]
  );

  const kbdClass = cn(
    'tw:inline-flex tw:items-center tw:justify-center',
    'tw:px-2 tw:py-1 tw:min-w-[1.5rem] tw:h-6',
    'tw:bg-muted tw:border tw:border-border tw:rounded-md',
    'tw:text-xs tw:font-mono tw:font-medium tw:text-foreground',
    'tw:shadow-sm'
  );

  const shortcutRowClass = cn(
    'tw:flex tw:items-center tw:justify-between tw:gap-4',
    'tw:py-2 tw:border-b tw:border-border/50 tw:last:border-0'
  );

  const shortcutLabelClass = cn('tw:text-foreground tw:text-sm');

  const sectionTitleClass = cn(
    'tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wider tw:text-muted-foreground',
    'tw:mt-6 tw:mb-3 tw:first:mt-0'
  );

  const sectionBoxClass = cn('tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-3');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw:flex tw:max-h-[85vh] tw:max-w-md tw:flex-col">
        <DialogHeader className="tw:flex-shrink-0 tw:pb-2">
          <DialogTitle>Prism</DialogTitle>
          <DialogDescription>Version {version}</DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="tw:-mr-2 tw:flex-1 tw:overflow-y-auto tw:pt-2 tw:pr-2">
          {enableKeyboardShortcuts && (
            <>
              <h4 className={sectionTitleClass}>Keyboard Shortcuts</h4>
              <div className={sectionBoxClass}>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>New tab</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>{modKeys.alt}</kbd>
                    <kbd className={kbdClass}>N</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Close tab</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>D</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Duplicate tab</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>B</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Undo</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>U</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Lock / unlock tab</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>O</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Rename tab</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>R</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Refresh tab</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>{modKeys.shift}</kbd>
                    <kbd className={kbdClass}>R</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Pin / unpin panel</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>I</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Toggle search bars</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>Y</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Previous / next tab</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>J</kbd>
                    <span className="tw:text-xs tw:text-muted-foreground">/</span>
                    <kbd className={kbdClass}>K</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Focus search</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>{modKeys.ctrl}</kbd>
                    <kbd className={kbdClass}>Space</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Navigate results</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>↑</kbd>
                    <span className="tw:text-xs tw:text-muted-foreground">/</span>
                    <kbd className={kbdClass}>↓</kbd>
                  </div>
                </div>
                <div className={shortcutRowClass}>
                  <span className={shortcutLabelClass}>Select layout</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>Enter</kbd>
                  </div>
                </div>
                <div className={cn(shortcutRowClass, 'tw:border-b-0')}>
                  <span className={shortcutLabelClass}>Cancel / Close modal</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={kbdClass}>Esc</kbd>
                  </div>
                </div>
              </div>
            </>
          )}

          <h4 className={sectionTitleClass}>Tab Management</h4>
          <div className={cn(sectionBoxClass, 'tw:space-y-2')}>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Right-click</strong> a tab for context menu
              options
            </p>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Double-click</strong> a tab to rename it
            </p>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Drag tabs</strong> to reorder them within a
              panel
            </p>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Locked tabs</strong> cannot be closed or
              renamed
            </p>
            {enableShareLinks && (
              <p className="tw:text-sm tw:text-muted-foreground">
                <strong className="tw:text-foreground">Share</strong> a tab to copy a link that
                opens the same layout
              </p>
            )}
          </div>

          <h4 className={sectionTitleClass}>Panel Management</h4>
          <div className={cn(sectionBoxClass, 'tw:space-y-2')}>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Split panels</strong> by dragging a tab to the
              edge of another panel
            </p>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Move tabs</strong> between panels by dragging
              to the tab bar
            </p>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Pin a panel</strong> via context menu to
              prevent tab changes
            </p>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Close a panel</strong> by closing all its tabs
              (or drag tabs away)
            </p>
            <p className="tw:text-sm tw:text-muted-foreground">
              <strong className="tw:text-foreground">Resize panels</strong> by dragging the divider
              between them
            </p>
          </div>
        </div>

        <DialogFooter className="tw:mt-4 tw:flex-shrink-0">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
