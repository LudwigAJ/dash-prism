/**
 * Pure helpers for Prism's keyboard shortcuts (no React, unit-testable).
 */

/** The subset of KeyboardEvent the matchers look at. */
export type KeyChordEvent = {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  code: string;
  key: string;
};

/**
 * New tab: Ctrl+Alt+N (Cmd+Option+N on macOS).
 *
 * Plain Ctrl/Cmd+N is a browser-reserved shortcut ("new window") that Chrome,
 * Edge and Safari never deliver to the page, so the new-tab binding is a
 * three-key chord instead. It is matched on `code` because with Alt held macOS
 * reports a dead key ('˜') in `key` rather than 'n'.
 */
export function isNewTabChord(event: KeyChordEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) && event.altKey && !event.shiftKey && event.code === 'KeyN'
  );
}

/**
 * The Prism workspace a keystroke came from, or null when it came from outside
 * every workspace (the page around it, or a portalled overlay).
 */
export function originWorkspace(target: EventTarget | null): Element | null {
  const el = target as Element | null;
  return el?.closest?.('.prism-view-workspace') ?? null;
}

/** Whether keystrokes on this element belong to text entry and must be left alone. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
}

/**
 * Selector for the overlays that take over the keyboard while they are open.
 * Radix renders their content into a portal on `document.body`, i.e. outside
 * every Prism root, so an event target inside one is neither editable nor
 * contained in the workspace and would otherwise reach the global shortcuts
 * (right-click a tab, press Ctrl+D, and the tab behind the menu closed).
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
export type RootRegistry<T> = {
  /** Registers a mounted root. The returned function unregisters the root when it unmounts. */
  register(root: T): () => void;
  /** Makes `root` the owner (it must still be mounted). */
  claim(root: T): void;
  /** Whether `root` may handle a shortcut right now. */
  owns(root: T): boolean;
};

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
