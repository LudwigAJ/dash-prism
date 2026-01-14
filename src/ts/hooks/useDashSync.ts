import { useEffect, useRef, useState, useCallback } from 'react';
import { usePrism } from '@hooks/usePrism';
import type { Workspace } from '@types';

/** Debounce delay for subsequent syncs (ms) */
const DEBOUNCE_MS = 500;

/**
 * Syncs Prism state to Dash via the `readWorkspace` prop.
 *
 * Behavior:
 * - First sync: Immediate (no delay) to ensure initial state is sent
 * - Subsequent syncs: 500ms debounce to prevent rapid updates during user interactions
 * - Deduplication: Only syncs when serialized state actually changes
 * - beforeunload/pagehide: Flushes pending sync to prevent data loss on browser close
 *
 * @returns Object containing `lastSyncTime` timestamp for StatusBar display
 *
 * @example
 * ```tsx
 * function WorkspaceView() {
 *   const { lastSyncTime } = useDashSync();
 *   return <StatusBar lastSyncTime={lastSyncTime} />;
 * }
 * ```
 */
export function useDashSync(): { lastSyncTime: number } {
  const { state, setProps } = usePrism();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSyncRef = useRef('');
  const isFirstSyncRef = useRef(true);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now);
  const pendingWorkspaceRef = useRef<Partial<Workspace> | null>(null);

  // Memoized sync function for reuse in effect and beforeunload
  const doSync = useCallback(
    (workspace: Partial<Workspace>) => {
      if (!setProps) return;
      const serialized = JSON.stringify(workspace);
      if (serialized === lastSyncRef.current) return;
      lastSyncRef.current = serialized;
      setLastSyncTime(Date.now());
      setProps({ readWorkspace: workspace });
      pendingWorkspaceRef.current = null;
    },
    [setProps]
  );

  useEffect(() => {
    if (!setProps) return;

    const workspace: Partial<Workspace> = {
      tabs: state.tabs,
      panel: state.panel,
      panelTabs: state.panelTabs,
      activeTabIds: state.activeTabIds,
      activePanelId: state.activePanelId,
      favoriteLayouts: state.favoriteLayouts,
      searchBarsHidden: state.searchBarsHidden,
    };

    const serialized = JSON.stringify(workspace);
    if (serialized === lastSyncRef.current) return;

    // Clear any pending debounced sync
    clearTimeout(timeoutRef.current);

    if (isFirstSyncRef.current) {
      // First sync is immediate (no delay)
      isFirstSyncRef.current = false;
      doSync(workspace);
    } else {
      // Store pending workspace for beforeunload flush
      pendingWorkspaceRef.current = workspace;
      // Subsequent syncs are debounced
      timeoutRef.current = setTimeout(() => doSync(workspace), DEBOUNCE_MS);
    }

    return () => clearTimeout(timeoutRef.current);
  }, [
    state.tabs,
    state.panel,
    state.panelTabs,
    state.activeTabIds,
    state.activePanelId,
    state.favoriteLayouts,
    state.searchBarsHidden,
    setProps,
    doSync,
  ]);

  // Flush pending sync on page unload to prevent data loss
  useEffect(() => {
    const flushPendingSync = () => {
      if (pendingWorkspaceRef.current) {
        clearTimeout(timeoutRef.current);
        doSync(pendingWorkspaceRef.current);
      }
    };

    // beforeunload for desktop browsers
    window.addEventListener('beforeunload', flushPendingSync);
    // pagehide for mobile browsers (more reliable than beforeunload)
    window.addEventListener('pagehide', flushPendingSync);

    return () => {
      window.removeEventListener('beforeunload', flushPendingSync);
      window.removeEventListener('pagehide', flushPendingSync);
    };
  }, [doSync]);

  return { lastSyncTime };
}
