import { useEffect, useRef, useState } from 'react';
import { useAppSelector, selectWorkspaceSnapshot } from '@store';
import type { Workspace } from '@types';

/**
 * Gives the time of the last workspace change, in ms since the epoch, for the "Updated" read-out
 * of the status bar. The debounced sync to Dash follows up to 500 ms later, so the hook does not
 * give the time of the sync.
 *
 * A new workspace object marks a change, because the store gives a new object for each change.
 */
export function useLastChangeTime(): { lastChangeTime: number } {
  const workspace = useAppSelector(selectWorkspaceSnapshot);
  const lastWorkspaceRef = useRef<Partial<Workspace> | null>(null);
  const [lastChangeTime, setLastChangeTime] = useState(Date.now);

  useEffect(() => {
    if (workspace !== lastWorkspaceRef.current) {
      lastWorkspaceRef.current = workspace;
      setLastChangeTime(Date.now());
    }
  }, [workspace]);

  return { lastChangeTime };
}
