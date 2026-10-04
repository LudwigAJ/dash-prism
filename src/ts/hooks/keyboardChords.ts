/**
 * Pure helpers for Prism's keyboard shortcuts (no React, unit-testable).
 */

import { SHORTCUTS, type Shortcut, type ShortcutAction } from '@constants/shortcuts';

/** The subset of KeyboardEvent the matchers look at. */
export interface KeyChordEvent {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  code: string;
  key: string;
}

/** Tells if a key event is for the key of a shortcut, whatever the modifiers. */
function matchesKey(event: KeyChordEvent, key: string): boolean {
  if (key === 'Space') return event.code === 'Space' || event.key === ' ';
  // With Alt held, macOS gives a dead key such as '˜' in `key`, so an Alt chord reads `code`.
  if (event.altKey) return event.code === `Key${key}`;
  return event.key.toLowerCase() === key.toLowerCase();
}

function matchesShortcut(event: KeyChordEvent, shortcut: Shortcut): boolean {
  const hasControl = shortcut.ctrlOnly ? event.ctrlKey : event.ctrlKey || event.metaKey;
  return (
    hasControl &&
    event.altKey === Boolean(shortcut.alt) &&
    event.shiftKey === Boolean(shortcut.shift) &&
    matchesKey(event, shortcut.key)
  );
}

function isShortcutAction(name: string): name is ShortcutAction {
  return name in SHORTCUTS;
}

/** Finds the action whose shortcut in SHORTCUTS a key event presses, or null. */
export function matchShortcut(event: KeyChordEvent): ShortcutAction | null {
  for (const [action, shortcut] of Object.entries(SHORTCUTS)) {
    if (isShortcutAction(action) && matchesShortcut(event, shortcut)) return action;
  }
  return null;
}

/**
 * The Prism workspace a keystroke came from, or null when it came from outside
 * every workspace (the page around it, or a portalled overlay).
 */
export function originWorkspace(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest('.prism-view-workspace') : null;
}

/** Whether keystrokes on this element belong to text entry and must be left alone. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Selector for the overlays that take over the keyboard while they are open.
 * Radix renders their content into a portal in the Prism root. The portal is
 * next to the workspace element and not inside it. An event target in an overlay
 * is neither editable nor inside the workspace. Without this check it would reach
 * the global shortcuts (right-click a tab, press Ctrl+D, and the tab behind the
 * menu closed).
 */
const OVERLAY_SELECTOR =
  '[data-slot="context-menu-content"],[data-slot="context-menu-sub-content"],[data-slot="dialog-content"]';

/** Whether a context menu or dialog is currently open. */
export function isOverlayOpen(doc: Pick<Document, 'querySelector'>): boolean {
  return doc.querySelector(OVERLAY_SELECTOR) !== null;
}

/**
 * Tracks which Prism workspace owns the keyboard shortcuts when several are
 * rendered on one page: the one the user last interacted with, falling back to
 * the first that mounted. Ownership is handed to another mounted workspace when
 * the owner unmounts, so the survivors never all go silent.
 */
export interface RootRegistry<T> {
  /** Registers a mounted root. The returned function unregisters the root when it unmounts. */
  register(root: T): () => void;
  /** Makes `root` the owner (it must still be mounted). */
  claim(root: T): void;
  /** Whether `root` may handle a shortcut right now. */
  owns(root: T): boolean;
}

/** Builds an empty RootRegistry. The keyboard shortcut hook keeps one for the whole page. */
export function createRootRegistry<T>(): RootRegistry<T> {
  const mounted = new Set<T>();
  let active: T | null = null;

  return {
    register(root) {
      mounted.add(root);
      if (active === null) active = root;
      return () => {
        mounted.delete(root);
        if (active === root) active = mounted.values().next().value ?? null;
      };
    },
    claim(root) {
      if (mounted.has(root)) active = root;
    },
    owns(root) {
      return active === null || active === root;
    },
  };
}
