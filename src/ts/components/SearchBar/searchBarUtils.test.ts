import { describe, it, expect } from 'vitest';
import type { LayoutMeta } from '@types';
import { layoutHasOptions, layoutHasParams } from './searchBarUtils';

const plain: LayoutMeta = { name: 'Plain' };

describe('layoutHasParams', () => {
  it('is false when the layout has no params key or an empty list', () => {
    expect(layoutHasParams(plain)).toBe(false);
    expect(layoutHasParams({ ...plain, params: [] })).toBe(false);
  });

  it('is true when the layout has at least one param', () => {
    const layout: LayoutMeta = { ...plain, params: [{ name: 'n', hasDefault: false }] };
    expect(layoutHasParams(layout)).toBe(true);
  });
});

describe('layoutHasOptions', () => {
  it('is false for an absent, null or empty paramOptions', () => {
    expect(layoutHasOptions(plain)).toBe(false);
    expect(layoutHasOptions({ ...plain, paramOptions: null })).toBe(false);
    expect(layoutHasOptions({ ...plain, paramOptions: {} })).toBe(false);
  });

  it('is true when the layout has at least one option', () => {
    const layout: LayoutMeta = {
      ...plain,
      paramOptions: { weekly: { params: { period: 'week' } } },
    };
    expect(layoutHasOptions(layout)).toBe(true);
  });
});
