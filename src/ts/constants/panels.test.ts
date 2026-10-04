import { describe, it, expect } from 'vitest';
import { MAX_LEAF_PANELS, resolveMaxPanels } from './panels';

describe('resolveMaxPanels', () => {
  it('falls back to the default when the prop is omitted', () => {
    expect(resolveMaxPanels(undefined)).toBe(MAX_LEAF_PANELS);
  });

  it('treats an explicit null (Python None) as unlimited, like maxTabs does', () => {
    // Dash sends null for None, which bypasses every destructuring default.
    // Reading it as the default limit would leave the split button enabled
    // while the reducer refused to split.
    expect(resolveMaxPanels(null)).toBeLessThan(1);
  });

  it('passes a real limit through unchanged', () => {
    expect(resolveMaxPanels(3)).toBe(3);
    expect(resolveMaxPanels(1)).toBe(1);
    expect(resolveMaxPanels(0)).toBe(0);
    expect(resolveMaxPanels(-1)).toBe(-1);
  });
});
