import { describe, it, expect } from 'vitest';
import { makeTab, PANEL_1, TAB_1 } from '@store/testing';
import { canRenameTab } from './useTabRename';

describe('canRenameTab', () => {
  it('allows a tab that is not locked in a panel that is not pinned', () => {
    expect(canRenameTab(makeTab(TAB_1, PANEL_1), false)).toBe(true);
  });

  it('refuses a locked tab', () => {
    expect(canRenameTab(makeTab(TAB_1, PANEL_1, { locked: true }), false)).toBe(false);
  });

  it('refuses a tab in a pinned panel', () => {
    expect(canRenameTab(makeTab(TAB_1, PANEL_1), true)).toBe(false);
  });
});
