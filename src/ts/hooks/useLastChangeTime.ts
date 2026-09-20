import { useEffect, useRef, useState } from 'react';
import { useAppSelector, selectWorkspaceSnapshot } from '@store';
import type { Workspace } from '@types';

/**
 * Tracks when the workspace state last changed, for the StatusBar "Updated"
 * read-out. It does NOT know when the debounced sync to Dash happened (that is
 * dashSyncMiddleware's business, up to 500 ms later); hence the name.
 *
 * Uses reference equality instead of JSON serialization for change detection,
 * since Redux returns new references when state changes.
 *
 * @returns Object containing `lastSyncTime` timestamp for StatusBar display
 *
 * @example
 * ```tsx
 * function WorkspaceView() {
 *   const { lastSyncTime } = useLastChangeTime();
 *   return <StatusBar lastSyncTime={lastSyncTime} />;
 * }
 * ```
 */
export function useLastChangeTime(): { lastSyncTime: number } {
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
