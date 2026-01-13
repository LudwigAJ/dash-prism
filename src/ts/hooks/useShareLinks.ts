import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import type { Tab, ShareData } from '@types';

/**
 * useShareLinks - URL hash-based tab sharing
 *
 * - generateShareLink: Pure function (tab → URL string)
 * - shareTab: Side effect (clipboard + toast)
 * - processShareHash: Side effect → Redux action
 */
export function useShareLinks() {
  const { state, dispatch } = usePrism();
  const { registeredLayouts, maxTabs } = useConfig();

  // =========================================================================
  // Generate Share Link (Pure Function - no state change)
  // =========================================================================
  const generateShareLink = useCallback((tab: Tab): string | null => {
    if (!tab.layoutId) return null;

    const shareData: ShareData = {
      layoutId: tab.layoutId,
      name: tab.name,
    };

    // Include params if present
    if (tab.layoutParams) {
      shareData.layoutParams = tab.layoutParams as Record<string, string>;
    }
    if (tab.layoutOption) {
      shareData.layoutOption = tab.layoutOption;
    }

    // Encode as base64 JSON
    const encoded = btoa(JSON.stringify(shareData));
    const currentUrl = window.location.href.split('#')[0];
    return `${currentUrl}#p:${encoded}`;
  }, []);

  // =========================================================================
  // Share Tab (Side Effect - clipboard + toast, NOT Redux)
  // =========================================================================
  const shareTab = useCallback(
    (tab: Tab | null) => {
      if (!tab) return;

      if (!tab.layoutId) {
        toast.error('Cannot share a tab without a layout');
        return;
      }

      const shareLink = generateShareLink(tab);
      if (shareLink) {
        navigator.clipboard
          .writeText(shareLink)
          .then(() => toast.success('Link copied to clipboard'))
          .catch(() => toast.error('Failed to copy link'));
      }
    },
    [generateShareLink]
  );

  // =========================================================================
  // Spawn Shared Tab (Redux Action - reversible!)
  // =========================================================================
  const spawnSharedTab = useCallback(
    (shareData: ShareData): boolean => {
      const { layoutId, name, layoutParams, layoutOption } = shareData;

      // Validate layout exists
      if (!registeredLayouts?.[layoutId]) {
        toast.error(`Layout "${layoutId}" not found`);
        return false;
      }

      const layoutInfo = registeredLayouts[layoutId];

      // Check allowMultiple constraint
      if (!layoutInfo.allowMultiple) {
        const existing = state.tabs.find((t) => t.layoutId === layoutId);
        if (existing) {
          toast.info(`Layout "${layoutInfo.name}" already open. Switching to it.`);
          dispatch({
            type: 'SELECT_TAB',
            payload: { tabId: existing.id, panelId: existing.panelId },
          });
          return false;
        }
      }

      // Check maxTabs limit
      if (maxTabs && maxTabs > 0 && state.tabs.length >= maxTabs) {
        toast.error(`Max tabs (${maxTabs}) reached`);
        return false;
      }

      // Dispatch Redux action - THIS IS THE REVERSIBLE PART
      // User can close the tab to "undo" opening the share link
      dispatch({
        type: 'ADD_TAB',
        payload: {
          panelId: state.activePanelId,
          name: name || layoutInfo.name || 'Shared Tab',
          layoutId,
          params: layoutParams || undefined,
          option: layoutOption || undefined,
        },
      });

      toast.success(`Opened shared tab: ${name || layoutInfo.name}`);
      return true;
    },
    [registeredLayouts, state.tabs, state.activePanelId, maxTabs, dispatch]
  );

  // =========================================================================
  // Process URL Hash (Side Effect - reads URL, dispatches Redux action)
  // =========================================================================
  const processShareHash = useCallback(() => {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#p:')) return;

    const encoded = hash.slice(3); // Remove '#p:'

    try {
      const decoded = atob(encoded);
      const shareData = JSON.parse(decoded) as ShareData;

      if (!shareData.layoutId) {
        toast.error('Invalid share link: missing layout');
        return;
      }

      spawnSharedTab(shareData);
    } catch {
      toast.error('Invalid share link');
    } finally {
      // Clear hash from URL (side effect, not Redux)
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [spawnSharedTab]);

  // =========================================================================
  // URL Hash Listeners (Side Effects)
  // =========================================================================

  // Listen for hash changes (user pastes link while app is open)
  useEffect(() => {
    const handleHashChange = () => processShareHash();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [processShareHash]);

  // Process hash on mount (user opens share link directly)
  useEffect(() => {
    const timer = setTimeout(processShareHash, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  return {
    generateShareLink,
    shareTab,
    spawnSharedTab,
    processShareHash,
  };
}
