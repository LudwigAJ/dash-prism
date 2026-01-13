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
import { cn } from '@utils/cn';
import type { Theme } from '@types';

// Version can be imported from a constants file or package.json
const VERSION = '0.1.2';

export type HelpModalProps = {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Current theme for portal styling */
  theme?: Theme;
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
export function HelpModal({
  open,
  onOpenChange,
  theme = 'light',
  version = VERSION,
}: HelpModalProps) {
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

  const sectionTitleClass = cn(
    'text-xs font-semibold uppercase tracking-wider text-muted-foreground',
    'mt-6 mb-3 first:mt-0'
  );

  const sectionBoxClass = cn('rounded-lg border border-border bg-card p-3');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col" theme={theme}>
        <DialogHeader className="flex-shrink-0 pb-2">
          <DialogTitle>Prism</DialogTitle>
          <DialogDescription>Version {version}</DialogDescription>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="-mr-2 flex-1 overflow-y-auto pt-2 pr-2">
          <h4 className={sectionTitleClass}>Keyboard Shortcuts</h4>
          <div className={sectionBoxClass}>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">New tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>N</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Close tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>D</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Duplicate tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>⇧</kbd>
                <kbd className={kbdClass}>D</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Undo close</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>Z</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Lock / unlock tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>L</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Rename tab</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>R</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Tab info</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>I</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Toggle search bars</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>H</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Switch tabs</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>⌃</kbd>
                <kbd className={kbdClass}>J</kbd>
                <span className="text-muted-foreground text-xs">/</span>
                <kbd className={kbdClass}>K</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Focus search</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>Tab</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Navigate results</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>↑</kbd>
                <span className="text-muted-foreground text-xs">/</span>
                <kbd className={kbdClass}>↓</kbd>
              </div>
            </div>
            <div className={shortcutRowClass}>
              <span className="text-foreground text-sm">Select layout</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>Enter</kbd>
              </div>
            </div>
            <div className={cn(shortcutRowClass, 'border-b-0')}>
              <span className="text-foreground text-sm">Cancel / Close modal</span>
              <div className="flex items-center gap-1">
                <kbd className={kbdClass}>Esc</kbd>
              </div>
            </div>
          </div>

          <h4 className={sectionTitleClass}>Tab Management</h4>
          <div className={cn(sectionBoxClass, 'space-y-2')}>
            <p className="text-foreground text-sm">
              <strong>Right-click</strong> a tab for context menu options
            </p>
            <p className="text-foreground text-sm">
              <strong>Double-click</strong> a tab to rename it
            </p>
            <p className="text-foreground text-sm">
              <strong>Drag tabs</strong> to reorder them within a panel
            </p>
            <p className="text-foreground text-sm">
              <strong>Locked tabs</strong> cannot be closed or renamed
            </p>
            <p className="text-foreground text-sm">
              <strong>Share</strong> a tab to copy a link that opens the same layout
            </p>
          </div>

          <h4 className={sectionTitleClass}>Panel Management</h4>
          <div className={cn(sectionBoxClass, 'space-y-2')}>
            <p className="text-foreground text-sm">
              <strong>Split panels</strong> by dragging a tab to the edge of another panel
            </p>
            <p className="text-foreground text-sm">
              <strong>Move tabs</strong> between panels by dragging to the tab bar
            </p>
            <p className="text-foreground text-sm">
              <strong>Pin a panel</strong> via context menu to prevent tab changes
            </p>
            <p className="text-foreground text-sm">
              <strong>Close a panel</strong> by closing all its tabs (or drag tabs away)
            </p>
            <p className="text-foreground text-sm">
              <strong>Resize panels</strong> by dragging the divider between them
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
