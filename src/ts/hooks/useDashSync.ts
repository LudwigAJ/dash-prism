import { useEffect, useRef, useState } from 'react';
import { useAppSelector, selectWorkspaceSnapshot } from '@store';
import type { Workspace } from '@types';

/**
 * Tracks workspace state changes for StatusBar display.
 *
 * Note: Actual sync to Dash is now handled by dashSyncMiddleware.
 * This hook only tracks lastSyncTime for UI purposes.
 *
 * Uses reference equality instead of JSON serialization for change detection,
 * since Redux returns new references when state changes.
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
  const workspace = useAppSelector(selectWorkspaceSnapshot);
  const lastWorkspaceRef = useRef<Partial<Workspace> | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now);

  // Update lastSyncTime when workspace reference changes
  // The actual sync is handled by dashSyncMiddleware
  useEffect(() => {
    if (workspace !== lastWorkspaceRef.current) {
      lastWorkspaceRef.current = workspace;
      setLastSyncTime(Date.now());
    }
  }, [workspace]);

  return { lastSyncTime };
}
