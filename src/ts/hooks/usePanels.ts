import { useState, useCallback, useRef, useEffect } from 'react';
import type { PanelId } from '@types';
import { useAppDispatch, resizePanel } from '@store';

/**
 * Options for the usePanels hook.
 */
type UsePanelsOptions = {
  /** The panel ID being resized */
  panelId: PanelId;
  /** The sibling panel ID (for reference) */
  siblingId: PanelId;
  /** Resize direction: horizontal (left/right) or vertical (up/down) */
  direction: 'horizontal' | 'vertical';
  /** Minimum size as percentage (default: 10) */
  minSize?: number;
  /** Maximum size as percentage (default: 90) */
  maxSize?: number;
};

type ResizeState = {
  isResizing: boolean;
  startPosition: number;
  startSize: number;
};

/**
 * Hook for managing panel resize interactions.
 * Handles mouse drag and keyboard accessibility for resizing split panels.
 *
 * @param options - Configuration for the resize behavior
 * @returns Object with resize state, handlers, and ARIA props
 *
 * @example
 * ```tsx
 * function PanelResizer({ panelId, siblingId }: Props) {
 *   const { isResizing, handleMouseDown, resizerProps } = usePanels({
 *     panelId,
 *     siblingId,
 *     direction: 'horizontal',
 *   });
 *
 *   return (
 *     <div
 *       className={cn('resizer', isResizing && 'active')}
 *       onMouseDown={(e) => handleMouseDown(e, currentSize)}
 *       {...resizerProps}
 *     />
 *   );
 * }
 * ```
 */
export function usePanels({
  panelId,
  siblingId,
  direction,
  minSize = 10,
  maxSize = 90,
}: UsePanelsOptions) {
  const dispatch = useAppDispatch();
  const [isResizing, setIsResizing] = useState(false);
  const stateRef = useRef<ResizeState | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, currentSize: number) => {
      e.preventDefault();
      setIsResizing(true);
      stateRef.current = {
        isResizing: true,
        startPosition: direction === 'horizontal' ? e.clientX : e.clientY,
        startSize: currentSize,
      };
    },
    [direction]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!stateRef.current) return;

      const { startPosition, startSize } = stateRef.current;
      const currentPosition = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPosition - startPosition;

      // Convert pixel delta to percentage (rough estimate)
      const containerSize = direction === 'horizontal' ? window.innerWidth : window.innerHeight;
      const deltaPercent = (delta / containerSize) * 100;

      const newSize = Math.min(maxSize, Math.max(minSize, startSize + deltaPercent));

      dispatch(resizePanel({ panelId, size: newSize }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      stateRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, direction, panelId, minSize, maxSize, dispatch]);

  // Keyboard resize (for accessibility)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentSize: number) => {
      const step = e.shiftKey ? 10 : 2;
      let newSize = currentSize;

      if (direction === 'horizontal') {
        if (e.key === 'ArrowLeft') newSize -= step;
        if (e.key === 'ArrowRight') newSize += step;
      } else {
        if (e.key === 'ArrowUp') newSize -= step;
        if (e.key === 'ArrowDown') newSize += step;
      }

      if (newSize !== currentSize) {
        e.preventDefault();
        newSize = Math.min(maxSize, Math.max(minSize, newSize));
        dispatch(resizePanel({ panelId, size: newSize }));
      }
    },
    [direction, panelId, minSize, maxSize, dispatch]
  );

  return {
    isResizing,
    handleMouseDown,
    handleKeyDown,
    resizerProps: {
      role: 'separator',
      'aria-valuenow': undefined as number | undefined,
      'aria-valuemin': minSize,
      'aria-valuemax': maxSize,
      tabIndex: 0,
    },
  };
}
