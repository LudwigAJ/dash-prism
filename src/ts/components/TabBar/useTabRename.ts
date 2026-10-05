import { useCallback, useEffect, useState } from 'react';
import type { Tab, TabId } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectRenamingTabId,
  renameTab,
  clearRenameTab,
} from '@store';

/** Tells if the user can rename a tab. A locked tab and a tab in a pinned panel keep their names. */
export function canRenameTab(tab: Tab, isPinned: boolean): boolean {
  return !tab.locked && !isPinned;
}

/**
 * Holds the inline rename state of one tab bar: the tab whose name is in edit, if any. The input
 * of that tab keeps the edited text, so a key press renders only that tab.
 *
 * The hook also starts a rename that the store requests (the rename shortcut). Each tab bar sees
 * the request. Only the tab bar that holds the tab starts the rename and clears the request.
 */
export function useTabRename(tabs: Tab[], isPinned: boolean) {
  const dispatch = useAppDispatch();
  const renamingTabId = useAppSelector(selectRenamingTabId);
  const [editingTabId, setEditingTabId] = useState<TabId | null>(null);

  const startRename = useCallback(
    (tab: Tab) => {
      if (canRenameTab(tab, isPinned)) setEditingTabId(tab.id);
    },
    [isPinned]
  );

  const commitRename = useCallback(
    (tabId: TabId, name: string) => {
      const trimmed = name.trim();
      if (trimmed) dispatch(renameTab({ tabId, name: trimmed }));
      setEditingTabId(null);
    },
    [dispatch]
  );

  const cancelRename = useCallback(() => {
    setEditingTabId(null);
  }, []);

  useEffect(() => {
    if (!renamingTabId) return;
    const tab = tabs.find((t) => t.id === renamingTabId);
    if (!tab) return;
    startRename(tab);
    dispatch(clearRenameTab());
  }, [renamingTabId, tabs, startRename, dispatch]);

  return { editingTabId, startRename, commitRename, cancelRename };
}
