import { useEffect, useCallback, type RefObject } from 'react';
import {
  createRootRegistry,
  isEditableTarget,
  isOverlayOpen,
  matchShortcut,
  originWorkspace,
} from './keyboardChords';
import type { ShortcutAction } from '@constants/shortcuts';
import { useConfig } from '@context/ConfigContext';
import { findPanelById } from '@utils/panels';
import type { Tab } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectPanel,
  selectPanelTabs,
  selectActiveTabIds,
  selectActivePanelId,
  selectSearchBarsHidden,
  selectCanUndo,
  addTab,
  removeTab,
  activateTab,
  toggleTabLock,
  pinPanel,
  unpinPanel,
  toggleSearchBars,
  duplicateTab,
  refreshTab,
  undo,
  startRenameTab,
  requestSearchFocus,
} from '@store';

/** Which Prism workspace owns the shortcuts; see useKeyboardShortcuts. */
const rootRegistry = createRootRegistry<HTMLElement>();

/**
 * Keyboard shortcuts for one Prism instance. SHORTCUTS in constants/shortcuts.ts lists the keys.
 *
 * The listener lives on `window` so it works wherever focus is, but it only
 * acts for the instance the user interacted with last (`rootRef`): with two
 * Prism components on a page a shortcut must not fire in both.
 *
 * @param rootRef - The element that contains this Prism instance
 */
export function useKeyboardShortcuts(rootRef: RefObject<HTMLElement>) {
  const dispatch = useAppDispatch();
  const { enableKeyboardShortcuts } = useConfig();
  const tabs = useAppSelector(selectTabs);
  const panel = useAppSelector(selectPanel);
  const panelTabs = useAppSelector(selectPanelTabs);
  const activeTabIds = useAppSelector(selectActiveTabIds);
  const activePanelId = useAppSelector(selectActivePanelId);
  const searchBarsHidden = useAppSelector(selectSearchBarsHidden);
  const canUndo = useAppSelector(selectCanUndo);

  const getActiveTab = useCallback(() => {
    const activeTabId = activeTabIds[activePanelId];
    if (!activeTabId) return null;
    return tabs.find((t) => t.id === activeTabId) ?? null;
  }, [activeTabIds, activePanelId, tabs]);

  // Activates the tab before or after the active tab of the active panel, with wrap-around
  const handleNavigateTab = useCallback(
    (step: -1 | 1) => {
      const activePanelTabs = (panelTabs[activePanelId] ?? [])
        .map((id) => tabs.find((t) => t.id === id))
        .filter((t): t is Tab => t !== undefined);
      const currentIndex = activePanelTabs.findIndex((t) => t.id === activeTabIds[activePanelId]);
      if (currentIndex === -1) return;

      const count = activePanelTabs.length;
      const newTab = activePanelTabs[(currentIndex + step + count) % count];
      dispatch(activateTab({ tabId: newTab.id, panelId: activePanelId }));
    },
    [panelTabs, activePanelId, tabs, activeTabIds, dispatch]
  );

  const handleCloseTab = useCallback(() => {
    const tab = getActiveTab();
    const currentPanel = findPanelById(panel, activePanelId);
    // A locked tab and a tab in a pinned panel stay open
    if (tab && !tab.locked && !currentPanel?.pinned) {
      dispatch(removeTab({ tabId: tab.id }));
    }
  }, [getActiveTab, panel, activePanelId, dispatch]);

  const handleTogglePin = useCallback(() => {
    const currentPanel = findPanelById(panel, activePanelId);
    if (!currentPanel) return;
    if (currentPanel.pinned) {
      dispatch(unpinPanel({ panelId: activePanelId }));
    } else {
      dispatch(pinPanel({ panelId: activePanelId }));
    }
  }, [activePanelId, panel, dispatch]);

  // The thunks and the reducers check the limits and show the toasts
  const handleShortcut = useCallback(
    (action: ShortcutAction) => {
      const tab = getActiveTab();
      switch (action) {
        case 'newTab':
          dispatch(addTab({ panelId: activePanelId }));
          break;
        case 'closeTab':
          handleCloseTab();
          break;
        case 'duplicateTab':
          if (tab) dispatch(duplicateTab({ tabId: tab.id }));
          break;
        case 'undo':
          if (canUndo) dispatch(undo());
          break;
        case 'toggleLock':
          if (tab) dispatch(toggleTabLock({ tabId: tab.id }));
          break;
        case 'renameTab':
          // The tab bar that holds the tab starts the inline rename
          if (tab && !tab.locked) dispatch(startRenameTab({ tabId: tab.id }));
          break;
        case 'refreshTab':
          if (tab?.layoutId) dispatch(refreshTab({ tabId: tab.id }));
          break;
        case 'togglePin':
          handleTogglePin();
          break;
        case 'toggleSearchBars':
          dispatch(toggleSearchBars());
          break;
        case 'previousTab':
          handleNavigateTab(-1);
          break;
        case 'nextTab':
          handleNavigateTab(1);
          break;
        case 'focusSearch':
          if (!searchBarsHidden) dispatch(requestSearchFocus({ panelId: activePanelId }));
          break;
        default: {
          const unhandled: never = action;
          throw new Error(`No handler for the shortcut ${String(unhandled)}`);
        }
      }
    },
    [
      getActiveTab,
      dispatch,
      activePanelId,
      handleCloseTab,
      canUndo,
      handleTogglePin,
      handleNavigateTab,
      searchBarsHidden,
    ]
  );

  // Instance scoping
  // Track which Prism root the user touched last; only that instance handles
  // shortcuts. The first instance to mount owns them until another is used, and
  // ownership passes to a surviving instance when the owner unmounts. A
  // workspace with shortcuts switched off never registers, so it cannot own the
  // keyboard and silence a sibling that still wants it.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enableKeyboardShortcuts) return undefined;
    const release = rootRegistry.register(root);

    const claim = () => {
      rootRegistry.claim(root);
    };
    root.addEventListener('mousedown', claim);
    root.addEventListener('focusin', claim);
    return () => {
      root.removeEventListener('mousedown', claim);
      root.removeEventListener('focusin', claim);
      release();
    };
  }, [rootRef, enableKeyboardShortcuts]);

  // Keyboard event handler
  useEffect(() => {
    if (!enableKeyboardShortcuts) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      // A control handled the key already. During a drag the tab trigger stops every key, so a
      // shortcut cannot close or change the tab that the user drags.
      if (e.defaultPrevented) return;

      // Another Prism instance on the page owns the shortcuts right now
      if (rootRef.current && !rootRegistry.owns(rootRef.current)) return;

      // The keystroke happened inside a different workspace (one that may have
      // shortcuts switched off); it is not ours to act on.
      const origin = originWorkspace(e.target);
      if (origin && rootRef.current && origin !== rootRef.current) return;

      // Skip shortcuts when user is typing in editable elements
      if (isEditableTarget(e.target)) return;

      // A context menu or dialog owns the keyboard while it is open
      if (isOverlayOpen(document)) return;

      const action = matchShortcut(e);
      if (action === null) return;
      e.preventDefault();
      handleShortcut(action);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcuts, rootRef, handleShortcut]);
}
