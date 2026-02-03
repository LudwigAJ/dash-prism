// src/ts/context/PortalContext.tsx
import React, { createContext, useContext, useCallback, useRef, useMemo, useEffect } from 'react';
import { createHtmlPortalNode, HtmlPortalNode } from 'react-reverse-portal';
import { useAppSelector } from '@store/hooks';
import { selectTabs } from '@store/selectors';
import type { TabId } from '@types';

// =============================================================================
// Types
// =============================================================================

type PortalMap = Map<TabId, HtmlPortalNode>;

type PortalContextValue = {
  /**
   * Get or create a portal node for a tab.
   * Returns the same node on subsequent calls for the same tabId.
   */
  getPortalNode: (tabId: TabId) => HtmlPortalNode;

  /**
   * Remove a portal node when a tab is closed.
   * Should be called when a tab is permanently removed.
   */
  removePortalNode: (tabId: TabId) => void;

  /**
   * Check if a portal exists for a tab.
   */
  hasPortal: (tabId: TabId) => boolean;
};

// =============================================================================
// Context
// =============================================================================

const PortalContext = createContext<PortalContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

type PortalProviderProps = {
  children: React.ReactNode;
};

/**
 * Provider for managing React portals that preserve Dash component state
 * when tabs are moved between panels.
 *
 * @example
 * ```tsx
 * <PortalProvider>
 *   <WorkspaceView />
 * </PortalProvider>
 * ```
 */
export function PortalProvider({ children }: PortalProviderProps) {
  const portalsRef = useRef<PortalMap>(new Map());
  const tabs = useAppSelector(selectTabs);

  const getPortalNode = useCallback((tabId: TabId): HtmlPortalNode => {
    let node = portalsRef.current.get(tabId);
    if (!node) {
      node = createHtmlPortalNode({
        attributes: {
          class: 'prism-portal-container',
          style: 'height: 100%; width: 100%;',
        },
      });
      portalsRef.current.set(tabId, node);
    }
    return node;
  }, []);

  const removePortalNode = useCallback((tabId: TabId): void => {
    portalsRef.current.delete(tabId);
  }, []);

  const hasPortal = useCallback((tabId: TabId): boolean => {
    return portalsRef.current.has(tabId);
  }, []);

  // Clean up portals for tabs that no longer exist
  useEffect(() => {
    const currentTabIds = new Set(tabs.map((t) => t.id));
    const orphanedPortalIds: TabId[] = [];

    for (const tabId of portalsRef.current.keys()) {
      if (!currentTabIds.has(tabId)) {
        orphanedPortalIds.push(tabId);
      }
    }

    for (const tabId of orphanedPortalIds) {
      portalsRef.current.delete(tabId);
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[PortalProvider] Cleaned up orphaned portal for tab: ${tabId}`);
      }
    }
  }, [tabs]);

  const value = useMemo(
    () => ({ getPortalNode, removePortalNode, hasPortal }),
    [getPortalNode, removePortalNode, hasPortal]
  );

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access portal management functions.
 *
 * @example
 * ```tsx
 * function TabContent({ tabId }: { tabId: TabId }) {
 *   const { getPortalNode } = usePortal();
 *   const portalNode = getPortalNode(tabId);
 *
 *   return <OutPortal node={portalNode} />;
 * }
 * ```
 */
export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error('usePortal must be used within PortalProvider');
  }
  return context;
}
