import { createContext, useContext } from 'react';

/**
 * The element that holds the Radix portals of one Prism instance. Prism sets it to its root
 * element. A portal inside the root gets the theme tokens of its own instance. The default is
 * null, and Radix then renders the portal into `document.body`.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext.Provider;

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
