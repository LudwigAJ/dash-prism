/**
 * Regression tests for the keyboard chord matchers (02 G-1).
 */

import { describe, it, expect } from 'vitest';
import {
  createRootRegistry,
  isEditableTarget,
  isNewTabChord,
  isOverlayOpen,
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

describe('isNewTabChord', () => {
  it('matches Ctrl+Alt+N and Cmd+Option+N', () => {
    expect(isNewTabChord(ev({ ctrlKey: true, altKey: true, code: 'KeyN', key: 'n' }))).toBe(true);
    // macOS reports a dead key in `key` when Option is held; `code` is what counts.
    expect(isNewTabChord(ev({ metaKey: true, altKey: true, code: 'KeyN', key: '˜' }))).toBe(true);
  });

  it('does not match the browser-reserved Ctrl+N or other combinations', () => {
    expect(isNewTabChord(ev({ ctrlKey: true, code: 'KeyN', key: 'n' }))).toBe(false);
    expect(isNewTabChord(ev({ metaKey: true, code: 'KeyN', key: 'n' }))).toBe(false);
    expect(isNewTabChord(ev({ altKey: true, code: 'KeyN', key: 'n' }))).toBe(false);
    expect(isNewTabChord(ev({ ctrlKey: true, altKey: true, shiftKey: true, code: 'KeyN' }))).toBe(
      false
    );
    expect(isNewTabChord(ev({ ctrlKey: true, altKey: true, code: 'KeyM', key: 'm' }))).toBe(false);
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

  it('asks for the overlay content elements Radix portals to the body', () => {
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
