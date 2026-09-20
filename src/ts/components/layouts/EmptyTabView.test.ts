import { describe, it, expect } from 'vitest';
import { resolveEmptyTabView } from './EmptyTabView';

describe('resolveEmptyTabView', () => {
  it('defaults to layouts', () => {
    expect(resolveEmptyTabView(undefined)).toBe('layouts');
    expect(resolveEmptyTabView('layouts')).toBe('layouts');
  });

  it('passes through hint and none', () => {
    expect(resolveEmptyTabView('hint')).toBe('hint');
    expect(resolveEmptyTabView('none')).toBe('none');
  });

  it('falls back to layouts for unknown values from Dash', () => {
    // Dash props are untyped at runtime; a typo in Python must not blank the tab.
    expect(resolveEmptyTabView('cards' as never)).toBe('layouts');
    expect(resolveEmptyTabView('' as never)).toBe('layouts');
    expect(resolveEmptyTabView(null as never)).toBe('layouts');
  });
});
