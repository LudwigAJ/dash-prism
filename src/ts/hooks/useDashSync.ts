import { useEffect, useRef, useState } from 'react';
import { useAppSelector, selectWorkspaceSnapshot } from '@store';

/**
 * Tracks workspace state changes for StatusBar display.
 *
 * Note: Actual sync to Dash is now handled by dashSyncMiddleware.
 * This hook only tracks lastSyncTime for UI purposes.
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
  const lastSnapshotRef = useRef('');
  const [lastSyncTime, setLastSyncTime] = useState(Date.now);

  // Update lastSyncTime when workspace changes
  // The actual sync is handled by dashSyncMiddleware
  useEffect(() => {
    const serialized = JSON.stringify(workspace);
    if (serialized !== lastSnapshotRef.current) {
      lastSnapshotRef.current = serialized;
      setLastSyncTime(Date.now());
    }
  }, [workspace]);

  return { lastSyncTime };
}
