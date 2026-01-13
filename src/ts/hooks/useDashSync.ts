import { useEffect, useRef, useState } from 'react';
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

    const doSync = () => {
      lastSyncRef.current = serialized;
      setLastSyncTime(Date.now());
      setProps({ readWorkspace: workspace });
    };

    if (isFirstSyncRef.current) {
      // First sync is immediate (no delay)
      isFirstSyncRef.current = false;
      doSync();
    } else {
      // Subsequent syncs are debounced
      timeoutRef.current = setTimeout(doSync, DEBOUNCE_MS);
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
  ]);

  return { lastSyncTime };
}
