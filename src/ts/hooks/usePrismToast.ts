import { useCallback } from 'react';
import { useConfig } from '@context/ConfigContext';
import { prismToast } from '@utils/prismToast';

/**
 * Returns `prismToast` bound to the Toaster of this Prism instance.
 */
export function usePrismToast(): typeof prismToast {
  const { componentId } = useConfig();

  return useCallback(
    (type, message, options = {}) => {
      prismToast(type, message, { ...options, toasterId: componentId });
    },
    [componentId]
  );
}
