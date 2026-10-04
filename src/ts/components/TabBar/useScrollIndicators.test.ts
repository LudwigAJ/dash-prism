import { describe, it, expect } from 'vitest';
import { getScrollIndicators } from './useScrollIndicators';

describe('getScrollIndicators', () => {
  it('shows no indicator when all tabs fit', () => {
    expect(getScrollIndicators({ scrollLeft: 0, clientWidth: 500, scrollWidth: 500 })).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
    });
  });

  it('shows the right indicator at the start of an overflowing bar', () => {
    expect(getScrollIndicators({ scrollLeft: 0, clientWidth: 500, scrollWidth: 900 })).toEqual({
      canScrollLeft: false,
      canScrollRight: true,
    });
  });

  it('shows both indicators in the middle', () => {
    expect(getScrollIndicators({ scrollLeft: 150, clientWidth: 500, scrollWidth: 900 })).toEqual({
      canScrollLeft: true,
      canScrollRight: true,
    });
  });

  it('shows the left indicator at the end', () => {
    expect(getScrollIndicators({ scrollLeft: 400, clientWidth: 500, scrollWidth: 900 })).toEqual({
      canScrollLeft: true,
      canScrollRight: false,
    });
  });

  it('ignores one pixel of sub-pixel rounding at the end', () => {
    const { canScrollRight } = getScrollIndicators({
      scrollLeft: 399,
      clientWidth: 500,
      scrollWidth: 900,
    });
    expect(canScrollRight).toBe(false);
  });
});
