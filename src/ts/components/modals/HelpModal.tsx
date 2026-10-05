import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import {
  DRAG_KEYS,
  SHORTCUTS,
  formatDragKeys,
  formatKeys,
  isMacPlatform,
} from '@constants/shortcuts';
import { cn } from '@utils/cn';
import { useConfig } from '@context/ConfigContext';

// Version injected at build time from package.json via webpack DefinePlugin
const VERSION = process.env.APP_VERSION ?? '0.0.0';

const KBD_CLASS = cn(
  'tw:inline-flex tw:items-center tw:justify-center',
  'tw:px-2 tw:py-1 tw:min-w-[1.5rem] tw:h-6',
  'tw:bg-muted tw:border tw:border-border tw:rounded-md',
  'tw:text-xs tw:font-mono tw:font-medium tw:text-foreground',
  'tw:shadow-sm'
);

const SHORTCUT_ROW_CLASS = cn(
  'tw:flex tw:items-center tw:justify-between tw:gap-4',
  'tw:py-2 tw:border-b tw:border-border/50 tw:last:border-0'
);

const SHORTCUT_LABEL_CLASS = 'tw:text-foreground tw:text-sm';

const SECTION_TITLE_CLASS = cn(
  'tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wider tw:text-muted-foreground',
  'tw:mt-6 tw:mb-3 tw:first:mt-0'
);

const SECTION_BOX_CLASS = 'tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-3';

/** Holds the props of `HelpModal`. */
interface HelpModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
}

/**
 * Displays keyboard shortcuts and help information.
 *
 * Uses Radix Dialog for accessible modal behavior.
 * Shows version info, keyboard shortcuts, and feature documentation.
 */
export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const { enableKeyboardShortcuts, enableShareLinks } = useConfig();
  const isMac = isMacPlatform();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="tw:flex tw:max-h-[85vh] tw:max-w-md tw:flex-col">
        <DialogHeader className="tw:flex-shrink-0 tw:pb-2">
          <DialogTitle>Prism</DialogTitle>
          <DialogDescription>Version {VERSION}</DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="tw:-mr-2 tw:flex-1 tw:overflow-y-auto tw:pt-2 tw:pr-2">
          {enableKeyboardShortcuts && (
            <>
              <h3 className={SECTION_TITLE_CLASS}>Keyboard Shortcuts</h3>
              <div className={SECTION_BOX_CLASS} data-testid="prism-help-shortcuts">
                {Object.values(SHORTCUTS).map((shortcut) => (
                  <div key={shortcut.label} className={SHORTCUT_ROW_CLASS}>
                    <span className={SHORTCUT_LABEL_CLASS}>{shortcut.label}</span>
                    <div className="tw:flex tw:items-center tw:gap-1">
                      {formatKeys(shortcut, isMac).map((key) => (
                        <kbd key={key} className={KBD_CLASS}>
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
                {/* The focused tab, the search bar list and the dialogs handle these keys */}
                <div className={SHORTCUT_ROW_CLASS}>
                  <span className={SHORTCUT_LABEL_CLASS}>Close focused tab</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={KBD_CLASS}>Delete</kbd>
                  </div>
                </div>
                <div className={SHORTCUT_ROW_CLASS}>
                  <span className={SHORTCUT_LABEL_CLASS}>Navigate results</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={KBD_CLASS}>↑</kbd>
                    <span className="tw:text-xs tw:text-muted-foreground">/</span>
                    <kbd className={KBD_CLASS}>↓</kbd>
                  </div>
                </div>
                <div className={SHORTCUT_ROW_CLASS}>
                  <span className={SHORTCUT_LABEL_CLASS}>Select layout</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={KBD_CLASS}>Enter</kbd>
                  </div>
                </div>
                <div className={SHORTCUT_ROW_CLASS}>
                  <span className={SHORTCUT_LABEL_CLASS}>Cancel / Close modal</span>
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <kbd className={KBD_CLASS}>Esc</kbd>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* The keyboard drag works without the shortcuts, so this section always shows */}
          <h3 className={SECTION_TITLE_CLASS}>Keyboard Drag</h3>
          <div className={SECTION_BOX_CLASS} data-testid="prism-help-drag-keys">
            {Object.values(DRAG_KEYS).map((step) => (
              <div key={step.label} className={SHORTCUT_ROW_CLASS}>
                <span className={SHORTCUT_LABEL_CLASS}>{step.label}</span>
                <div className="tw:flex tw:items-center tw:gap-1">
                  {formatDragKeys(step).map((key) => (
                    <kbd key={key} className={KBD_CLASS}>
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h3 className={SECTION_TITLE_CLASS}>Tab Management</h3>
          <div className={cn(SECTION_BOX_CLASS, 'tw:space-y-2')}>
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

          <h3 className={SECTION_TITLE_CLASS}>Panel Management</h3>
          <div className={cn(SECTION_BOX_CLASS, 'tw:space-y-2')}>
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
