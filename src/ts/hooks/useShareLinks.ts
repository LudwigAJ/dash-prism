import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useConfig } from '@context/ConfigContext';
import { logger } from '@utils/logger';
import type { Tab, ShareData } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectActivePanelId,
  addTab,
  activateTab,
} from '@store';

/**
 * Maximum size for share link data in bytes (~4KB).
 * Base64 encoding adds ~33% overhead, so this keeps URLs reasonable.
 */
const MAX_SHARE_DATA_BYTES = 4096;

/**
 * Encode string to base64 using TextEncoder (modern, UTF-8 safe).
 * Returns null if encoding fails or data exceeds size limit.
 */
function encodeShareData(data: string): string | null {
  try {
    const bytes = new TextEncoder().encode(data);
    if (bytes.length > MAX_SHARE_DATA_BYTES) {
      logger.warn(`Share data exceeds ${MAX_SHARE_DATA_BYTES} bytes (${bytes.length})`);
      return null;
    }
    // Convert Uint8Array to base64
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
    return btoa(binString);
  } catch {
    return null;
  }
}

/**
 * Decode base64 string using TextDecoder (modern, UTF-8 safe).
 * Returns null if decoding fails.
 */
function decodeShareData(encoded: string): string | null {
  try {
    // Validate base64 format (only valid characters)
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      return null;
    }
    const binString = atob(encoded);
    const bytes = Uint8Array.from(binString, (char) => char.codePointAt(0) ?? 0);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Type guard to validate ShareData structure.
 * Ensures required fields exist and have correct types.
 */
function isValidShareData(data: unknown): data is ShareData {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;

  // Required: layoutId must be a non-empty string
  if (typeof obj.layoutId !== 'string' || obj.layoutId.trim() === '') {
    return false;
  }

  // Optional: name must be string if present
  if (obj.name !== undefined && typeof obj.name !== 'string') {
    return false;
  }

  // Optional: layoutParams must be object if present
  if (
    obj.layoutParams !== undefined &&
    (typeof obj.layoutParams !== 'object' || obj.layoutParams === null)
  ) {
    return false;
  }

  // Optional: layoutOption must be string if present
  if (obj.layoutOption !== undefined && typeof obj.layoutOption !== 'string') {
    return false;
  }

  return true;
}

/**
 * useShareLinks - URL hash-based tab sharing
 *
 * - generateShareLink: Pure function (tab → URL string)
 * - shareTab: Side effect (clipboard + toast)
 * - processShareHash: Side effect → Redux action
 */
export function useShareLinks() {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const activePanelId = useAppSelector(selectActivePanelId);
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

    // Encode as base64 JSON (UTF-8 safe, with size limit)
    const jsonStr = JSON.stringify(shareData);
    const encoded = encodeShareData(jsonStr);
    if (!encoded) {
      logger.warn('Share data too large or encoding failed');
      return null;
    }
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
        toast.error('Cannot share a tab without a layout', {
          cancel: { label: 'Dismiss', onClick: () => {} },
        });
        return;
      }

      const shareLink = generateShareLink(tab);
      if (shareLink) {
        navigator.clipboard
          .writeText(shareLink)
          .then(() =>
            toast.success('Link copied to clipboard', {
              cancel: { label: 'Dismiss', onClick: () => {} },
            })
          )
          .catch(() =>
            toast.error('Failed to copy link', {
              cancel: { label: 'Dismiss', onClick: () => {} },
            })
          );
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
        toast.error(`Layout "${layoutId}" not found`, {
          cancel: { label: 'Dismiss', onClick: () => {} },
        });
        return false;
      }

      const layoutInfo = registeredLayouts[layoutId];

      // Check allowMultiple constraint
      if (!layoutInfo.allowMultiple) {
        const existing = tabs?.find((t) => t.layoutId === layoutId);
        if (existing) {
          toast.info(`Layout "${layoutInfo.name}" already open. Switching to it.`, {
            cancel: { label: 'Dismiss', onClick: () => {} },
          });
          dispatch(activateTab({ tabId: existing.id, panelId: existing.panelId }));
          return false;
        }
      }

      // Check maxTabs limit
      if (maxTabs && maxTabs > 0 && (tabs?.length ?? 0) >= maxTabs) {
        toast.error(`Max tabs (${maxTabs}) reached`, {
          cancel: { label: 'Dismiss', onClick: () => {} },
        });
        return false;
      }

      // Dispatch Redux action - THIS IS THE REVERSIBLE PART
      // User can close the tab to "undo" opening the share link
      dispatch(
        addTab({
          panelId: activePanelId,
          name: name || layoutInfo.name || 'Shared Tab',
          layoutId,
          params: layoutParams || undefined,
          option: layoutOption || undefined,
        })
      );

      toast.success(`Opened shared tab: ${name || layoutInfo.name}`, {
        cancel: { label: 'Dismiss', onClick: () => {} },
      });
      return true;
    },
    [registeredLayouts, tabs, activePanelId, maxTabs, dispatch]
  );

  // =========================================================================
  // Process URL Hash (Side Effect - reads URL, dispatches Redux action)
  // =========================================================================
  const processShareHash = useCallback(() => {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#p:')) return;

    const encoded = hash.slice(3); // Remove '#p:'

    // Validate and decode
    const decoded = decodeShareData(encoded);
    if (!decoded) {
      toast.error('Invalid share link: decoding failed', {
        cancel: { label: 'Dismiss', onClick: () => {} },
      });
      return;
    }

    let shareData: unknown;
    try {
      shareData = JSON.parse(decoded);
    } catch {
      toast.error('Invalid share link: malformed data', {
        cancel: { label: 'Dismiss', onClick: () => {} },
      });
      return;
    }

    // Type-safe validation
    if (!isValidShareData(shareData)) {
      toast.error('Invalid share link: missing or invalid fields', {
        cancel: { label: 'Dismiss', onClick: () => {} },
      });
      return;
    }

    try {
      spawnSharedTab(shareData);
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
