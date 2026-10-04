import { useCallback, useEffect, useRef, useState } from 'react';

/** Gives the room that the sub-pixel rounding of `scrollWidth` can add. */
const SCROLL_THRESHOLD_PX = 1;

/** Holds the scroll measurements of an element that `getScrollIndicators` reads. */
interface ScrollMetrics {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}

/** Tells on which sides a scroll container has content out of view. */
interface ScrollIndicators {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

/** Computes on which sides the content of a horizontal scroll container is out of view. */
export function getScrollIndicators({
  scrollLeft,
  clientWidth,
  scrollWidth,
}: ScrollMetrics): ScrollIndicators {
  return {
    canScrollLeft: scrollLeft > 0,
    canScrollRight: scrollLeft + clientWidth < scrollWidth - SCROLL_THRESHOLD_PX,
  };
}

/**
 * Tracks on which sides the tabs of a tab bar are out of view. The values update when the
 * container scrolls or resizes, and when the number of tabs changes.
 *
 * @param tabCount - The number of tabs. A change makes the hook measure again.
 * @returns The ref for the scroll container and the two indicators.
 */
export function useScrollIndicators(tabCount: number) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const indicators = getScrollIndicators(el);
    setCanScrollLeft(indicators.canScrollLeft);
    setCanScrollRight(indicators.canScrollRight);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return undefined;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [update, tabCount]);

  return { scrollContainerRef, canScrollLeft, canScrollRight };
}
