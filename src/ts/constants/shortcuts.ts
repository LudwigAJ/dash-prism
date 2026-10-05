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

/** Names the direction of an arrow key. */
export type Direction = 'left' | 'right' | 'up' | 'down';

/** Maps the code of each arrow key to its direction. A keyboard drag moves in that direction. */
export const ARROW_DIRECTIONS: Partial<Record<string, Direction>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/** Names a step of the keyboard drag of a tab. */
type DragStep = 'pickUp' | 'move' | 'drop' | 'cancel';

/** Describes the keys of one step of a keyboard drag. These keys need no Control. */
interface DragKeys {
  /** Holds the `KeyboardEvent.code` values of the keys. */
  codes: string[];
  /** Holds the name of the step in the help modal. */
  label: string;
}

/**
 * Holds the keys of the keyboard drag of a tab, in the order of the help modal. The keyboard
 * sensor in DndProvider and the help modal read this table. Space drops the tab too, so Space
 * toggles the drag as in the default of dnd-kit.
 */
export const DRAG_KEYS: Record<DragStep, DragKeys> = {
  pickUp: { codes: ['Space'], label: 'Pick up focused tab' },
  move: { codes: Object.keys(ARROW_DIRECTIONS), label: 'Move tab to next drop target' },
  drop: { codes: ['Enter', 'NumpadEnter', 'Space'], label: 'Drop tab' },
  cancel: { codes: ['Escape'], label: 'Cancel drag' },
};

const KEY_NAMES: Partial<Record<string, string>> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  NumpadEnter: 'Enter',
};

/** Gives the key names of a drag step as the help shows them, each name once. */
export function formatDragKeys(keys: DragKeys): string[] {
  return [...new Set(keys.codes.map((code) => KEY_NAMES[code] ?? code))];
}

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
