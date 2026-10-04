/**
 * Regression tests for the keyboard chord matchers.
 */

import { describe, it, expect } from 'vitest';
import {
  createRootRegistry,
  isEditableTarget,
  isOverlayOpen,
  matchShortcut,
  originWorkspace,
  type KeyChordEvent,
} from './keyboardChords';

function ev(overrides: Partial<KeyChordEvent>): KeyChordEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    code: '',
    key: '',
    ...overrides,
  };
}

describe('matchShortcut', () => {
  it('matches New tab on Ctrl+Alt+N and Cmd+Option+N', () => {
    expect(matchShortcut(ev({ ctrlKey: true, altKey: true, code: 'KeyN', key: 'n' }))).toBe(
      'newTab'
    );
    // macOS reports a dead key in `key` when Option is held; `code` is what counts.
    expect(matchShortcut(ev({ metaKey: true, altKey: true, code: 'KeyN', key: '˜' }))).toBe(
      'newTab'
    );
  });

  it('does not match the browser-reserved Ctrl+N or other New tab variants', () => {
    expect(matchShortcut(ev({ ctrlKey: true, code: 'KeyN', key: 'n' }))).toBeNull();
    expect(matchShortcut(ev({ metaKey: true, code: 'KeyN', key: 'n' }))).toBeNull();
    expect(matchShortcut(ev({ altKey: true, code: 'KeyN', key: 'n' }))).toBeNull();
    expect(
      matchShortcut(ev({ ctrlKey: true, altKey: true, shiftKey: true, code: 'KeyN' }))
    ).toBeNull();
    expect(matchShortcut(ev({ ctrlKey: true, altKey: true, code: 'KeyM', key: 'm' }))).toBeNull();
  });

  it('matches a letter with Ctrl or Cmd, whatever its case', () => {
    expect(matchShortcut(ev({ ctrlKey: true, code: 'KeyD', key: 'd' }))).toBe('closeTab');
    expect(matchShortcut(ev({ metaKey: true, code: 'KeyD', key: 'd' }))).toBe('closeTab');
    expect(matchShortcut(ev({ ctrlKey: true, code: 'KeyJ', key: 'J' }))).toBe('previousTab');
  });

  it('tells Rename from Refresh by Shift', () => {
    expect(matchShortcut(ev({ ctrlKey: true, code: 'KeyR', key: 'r' }))).toBe('renameTab');
    expect(matchShortcut(ev({ ctrlKey: true, shiftKey: true, code: 'KeyR', key: 'R' }))).toBe(
      'refreshTab'
    );
  });

  it('matches a letter on `key`, so a shortcut follows the keyboard layout', () => {
    // On a German QWERTZ keyboard, the key in the QWERTY position of Z gives 'y'.
    expect(matchShortcut(ev({ ctrlKey: true, code: 'KeyZ', key: 'y' }))).toBe('toggleSearchBars');
    expect(matchShortcut(ev({ ctrlKey: true, code: 'KeyY', key: 'z' }))).toBeNull();
  });

  it('does not match a letter without Ctrl or Cmd, or with an extra modifier', () => {
    expect(matchShortcut(ev({ code: 'KeyD', key: 'd' }))).toBeNull();
    expect(matchShortcut(ev({ ctrlKey: true, shiftKey: true, code: 'KeyD', key: 'D' }))).toBeNull();
    expect(matchShortcut(ev({ ctrlKey: true, altKey: true, code: 'KeyD', key: '∂' }))).toBeNull();
  });

  it('matches Focus search on Ctrl+Space only', () => {
    expect(matchShortcut(ev({ ctrlKey: true, code: 'Space', key: ' ' }))).toBe('focusSearch');
    expect(matchShortcut(ev({ metaKey: true, code: 'Space', key: ' ' }))).toBeNull();
    expect(matchShortcut(ev({ code: 'Space', key: ' ' }))).toBeNull();
  });

  it('ignores keys that are not shortcuts', () => {
    expect(matchShortcut(ev({ ctrlKey: true, code: 'KeyC', key: 'c' }))).toBeNull();
    expect(matchShortcut(ev({ ctrlKey: true, code: 'ControlLeft', key: 'Control' }))).toBeNull();
  });
});

describe('isEditableTarget', () => {
  it('recognises text-entry elements and content-editable nodes', () => {
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(
      isEditableTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)
    ).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('isOverlayOpen', () => {
  function fakeDoc(match: boolean) {
    return { querySelector: () => (match ? ({} as Element) : null) };
  }

  it('reports an open context menu or dialog', () => {
    expect(isOverlayOpen(fakeDoc(true))).toBe(true);
  });

  it('reports nothing open when no overlay is rendered', () => {
    expect(isOverlayOpen(fakeDoc(false))).toBe(false);
  });

  it('asks for the overlay content elements Radix portals into the Prism root', () => {
    const selectors: string[] = [];
    isOverlayOpen({
      querySelector: (selector: string) => {
        selectors.push(selector);
        return null;
      },
    });
    expect(selectors).toHaveLength(1);
    expect(selectors[0]).toContain('context-menu-content');
    expect(selectors[0]).toContain('dialog-content');
  });
});

describe('createRootRegistry', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };

  it('gives ownership to the first root that mounts', () => {
    const registry = createRootRegistry<object>();
    registry.register(a);
    registry.register(b);

    expect(registry.owns(a)).toBe(true);
    expect(registry.owns(b)).toBe(false);
  });

  it('hands ownership to the root the user interacts with', () => {
    const registry = createRootRegistry<object>();
    registry.register(a);
    registry.register(b);

    registry.claim(b);

    expect(registry.owns(b)).toBe(true);
    expect(registry.owns(a)).toBe(false);
  });

  it('passes ownership to a surviving root when the owner unmounts', () => {
    const registry = createRootRegistry<object>();
    const releaseA = registry.register(a);
    registry.register(b);

    releaseA();

    // Without the hand-over every remaining instance would ignore shortcuts.
    expect(registry.owns(b)).toBe(true);
  });

  it('lets a lone root act again after every other root unmounted', () => {
    const registry = createRootRegistry<object>();
    const releaseA = registry.register(a);
    const releaseB = registry.register(b);

    releaseA();
    releaseB();

    expect(registry.owns(a)).toBe(true);
    expect(registry.owns(b)).toBe(true);
  });

  it('ignores a claim from a root that has already unmounted', () => {
    const registry = createRootRegistry<object>();
    registry.register(a);
    const releaseB = registry.register(b);

    releaseB();
    registry.claim(b);

    expect(registry.owns(a)).toBe(true);
  });
});

describe('originWorkspace', () => {
  function target(match: Element | null) {
    return { closest: () => match } as unknown as EventTarget;
  }

  it('returns the workspace the keystroke came from', () => {
    const workspace = {} as Element;
    expect(originWorkspace(target(workspace))).toBe(workspace);
  });

  it('returns null for a keystroke outside every workspace', () => {
    expect(originWorkspace(target(null))).toBeNull();
    expect(originWorkspace(null)).toBeNull();
  });

  it('tolerates a target without closest (document, window)', () => {
    expect(originWorkspace({} as EventTarget)).toBeNull();
  });
});
