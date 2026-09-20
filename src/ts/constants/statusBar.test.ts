import { describe, it, expect } from 'vitest';
import { DEFAULT_STATUS_BAR_ITEMS, resolveStatusBarItems } from './statusBar';

describe('resolveStatusBarItems', () => {
  it('returns every segment in default order when the prop is missing', () => {
    expect(resolveStatusBarItems(undefined)).toEqual([...DEFAULT_STATUS_BAR_ITEMS]);
  });

  it('keeps the caller order and drops unknown names and duplicates', () => {
    expect(resolveStatusBarItems(['count', 'bogus', 'reset', 'count'])).toEqual(['count', 'reset']);
  });

  it('accepts an empty list (nothing but actions)', () => {
    expect(resolveStatusBarItems([])).toEqual([]);
  });

  it('ignores non-string garbage from an untyped Dash prop', () => {
    expect(resolveStatusBarItems([1, null, 'help'] as never)).toEqual(['help']);
    expect(resolveStatusBarItems('help' as never)).toEqual([...DEFAULT_STATUS_BAR_ITEMS]);
  });
});
