import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * Gives a ref that holds the latest value. A callback that lives longer than one render, such as
 * a getter that the store keeps, reads the ref and so sees the current value without a rebuild.
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
