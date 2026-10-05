import { describe, it, expect } from 'vitest';
import { DRAG_KEYS, SHORTCUTS, formatDragKeys, formatKeys, formatShortcut } from './shortcuts';

describe('SHORTCUTS', () => {
  it('gives each key chord to one action only', () => {
    const chords = Object.values(SHORTCUTS).map((shortcut) =>
      formatKeys(shortcut, false).join('+')
    );
    expect(new Set(chords).size).toBe(chords.length);
  });

  it('keeps the order of the help modal', () => {
    expect(Object.values(SHORTCUTS).map((shortcut) => shortcut.label)).toEqual([
      'New tab',
      'Close tab',
      'Duplicate tab',
      'Undo',
      'Lock / unlock tab',
      'Rename tab',
      'Refresh tab',
      'Pin / unpin panel',
      'Toggle search bars',
      'Previous tab',
      'Next tab',
      'Focus search',
    ]);
  });
});

describe('formatKeys', () => {
  it('uses the menu symbols on macOS', () => {
    expect(formatKeys(SHORTCUTS.renameTab, true)).toEqual(['⌃', 'R']);
    expect(formatKeys(SHORTCUTS.refreshTab, true)).toEqual(['⌃', '⇧', 'R']);
    expect(formatKeys(SHORTCUTS.newTab, true)).toEqual(['⌃', '⌥', 'N']);
    expect(formatKeys(SHORTCUTS.focusSearch, true)).toEqual(['⌃', 'Space']);
  });

  it('uses words on the other platforms', () => {
    expect(formatKeys(SHORTCUTS.renameTab, false)).toEqual(['Ctrl', 'R']);
    expect(formatKeys(SHORTCUTS.refreshTab, false)).toEqual(['Ctrl', 'Shift', 'R']);
    expect(formatKeys(SHORTCUTS.newTab, false)).toEqual(['Ctrl', 'Alt', 'N']);
    expect(formatKeys(SHORTCUTS.focusSearch, false)).toEqual(['Ctrl', 'Space']);
  });
});

describe('formatShortcut', () => {
  it('joins the symbols on macOS and the words with + elsewhere', () => {
    expect(formatShortcut(SHORTCUTS.refreshTab, true)).toBe('⌃⇧R');
    expect(formatShortcut(SHORTCUTS.refreshTab, false)).toBe('Ctrl+Shift+R');
  });
});

describe('formatDragKeys', () => {
  it('writes the arrow keys as arrows, and each key name once', () => {
    expect(formatDragKeys(DRAG_KEYS.move)).toEqual(['←', '→', '↑', '↓']);
    expect(formatDragKeys(DRAG_KEYS.cancel)).toEqual(['Esc']);
    expect(formatDragKeys(DRAG_KEYS.drop)).toEqual(['Enter', 'Space']);
  });
});
