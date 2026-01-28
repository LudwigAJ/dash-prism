import { useState, useCallback, useEffect, useRef } from 'react';

const DEFAULT_DROPDOWN_HEIGHT = 300;
const MIN_DROPDOWN_HEIGHT = 120;
const MAX_DROPDOWN_HEIGHT = 600;

/**
 * Hook to manage dropdown resize functionality.
 * Handles mouse drag events to resize the dropdown vertically.
 */
export function useDropdownResize(initialHeight: number = DEFAULT_DROPDOWN_HEIGHT) {
  const [height, setHeight] = useState(initialHeight);
  const isResizingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(initialHeight);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = height;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [height]
  );

  // Mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaY = e.clientY - startYRef.current;
      const newHeight = startHeightRef.current + deltaY;
      // Clamp to min/max
      const clampedHeight = Math.min(MAX_DROPDOWN_HEIGHT, Math.max(MIN_DROPDOWN_HEIGHT, newHeight));
      setHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // CRITICAL: Always cleanup body styles on unmount
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return { height, handleResizeStart };
}
