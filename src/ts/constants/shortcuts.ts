/** Names a workspace action that has a keyboard shortcut. */
export type ShortcutAction =
  | 'newTab'
  | 'closeTab'
  | 'duplicateTab'
  | 'undo'
  | 'toggleLock'
  | 'renameTab'
  | 'refreshTab'
  | 'togglePin'
  | 'toggleSearchBars'
  | 'previousTab'
  | 'nextTab'
  | 'focusSearch';

/**
 * Describes the key chord of a shortcut. Each chord needs Control or Command (⌘), and the keys
 * that the fields name. A chord matches only when Alt and Shift are as the fields say.
 */
export interface Shortcut {
  /** Holds the key as the help shows it: an upper-case letter, or `Space`. */
  key: string;
  /** Tells that Command does not replace Control in this chord. */
  ctrlOnly?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** Holds the name of the action in the help modal. */
  label: string;
}

/**
 * Holds the shortcuts of the workspace in the order of the help modal. The keyboard hook, the
 * help modal and the tab context menu all read this table.
 *
 * New tab is a three-key chord, because browsers keep Control+N and Command+N ("new window") for
 * themselves and never give them to the page.
 */
export const SHORTCUTS: Record<ShortcutAction, Shortcut> = {
  newTab: { key: 'N', alt: true, label: 'New tab' },
  closeTab: { key: 'D', label: 'Close tab' },
  duplicateTab: { key: 'B', label: 'Duplicate tab' },
  undo: { key: 'U', label: 'Undo' },
  toggleLock: { key: 'O', label: 'Lock / unlock tab' },
  renameTab: { key: 'R', label: 'Rename tab' },
  refreshTab: { key: 'R', shift: true, label: 'Refresh tab' },
  togglePin: { key: 'I', label: 'Pin / unpin panel' },
  toggleSearchBars: { key: 'Y', label: 'Toggle search bars' },
  previousTab: { key: 'J', label: 'Previous tab' },
  nextTab: { key: 'K', label: 'Next tab' },
  focusSearch: { key: 'Space', ctrlOnly: true, label: 'Focus search' },
};

/**
 * Gives the key names of a shortcut in the order to press them. macOS uses the symbols of its
 * menus. The other platforms use words. Control shows on macOS too, because it works there for
 * every shortcut, and Command does not work for Focus search.
 */
export function formatKeys(shortcut: Shortcut, isMac: boolean): string[] {
  const keys = [isMac ? '⌃' : 'Ctrl'];
  if (shortcut.alt) keys.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) keys.push(isMac ? '⇧' : 'Shift');
  keys.push(shortcut.key);
  return keys;
}

/** Writes a shortcut as one string: `⌃⇧R` on macOS, `Ctrl+Shift+R` on the other platforms. */
export function formatShortcut(shortcut: Shortcut, isMac: boolean): string {
  return formatKeys(shortcut, isMac).join(isMac ? '' : '+');
}

/** Tells if the browser runs on macOS or iOS, where the shortcut keys show as symbols. */
export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
}
