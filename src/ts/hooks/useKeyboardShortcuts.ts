import { useEffect, useCallback, type RefObject } from 'react';
import {
  createRootRegistry,
  isEditableTarget,
  isNewTabChord,
  isOverlayOpen,
  originWorkspace,
} from './keyboardChords';
import { useConfig } from '@context/ConfigContext';
import { findPanelById } from '@utils/panels';
import type { PanelId, TabId } from '@types';
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
} from '@store';

/** Which Prism workspace owns the shortcuts; see useKeyboardShortcuts. */
const rootRegistry = createRootRegistry<HTMLElement>();

/**
 * Keyboard shortcuts for one Prism instance.
 *
 * The listener lives on `window` so it works wherever focus is, but it only
 * acts for the instance the user interacted with last (`rootRef`): with two
 * Prism components on a page a shortcut must not fire in both.
 *
 * Shortcuts (Cmd/Ctrl + key):
 * - Alt+N: New tab in active panel (plain Ctrl/Cmd+N is reserved by browsers)
 * - D: Delete (close) active tab (if not locked)
 * - J: Navigate to previous tab
 * - K: Navigate to next tab
 * - O: Toggle lock on active tab
 * - I: Toggle pin on active panel
 * - R: Rename active tab (opens rename dialog)
 * - Shift+R: Refresh active tab (force refetch layout from server)
 * - Y: Toggle search bars visibility
 * - B: Duplicate active tab
 * - U: Undo last change
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

  // ========== Helper: Get active tab ==========
  const getActiveTab = useCallback(() => {
    const activeTabId = activeTabIds[activePanelId];
    if (!activeTabId) return null;
    return tabs?.find((t) => t.id === activeTabId) ?? null;
  }, [activeTabIds, activePanelId, tabs]);

  // ========== Helper: Get tabs in active panel ==========
  const getActivePanelTabs = useCallback(() => {
    const tabIds = panelTabs[activePanelId] ?? [];
    return tabIds.map((id) => tabs?.find((t) => t.id === id)).filter(Boolean);
  }, [panelTabs, activePanelId, tabs]);

  // ========== Action: Create new tab ==========
  const createTab = useCallback(
    (panelId: PanelId) => {
      // Dispatch intent - reducer handles validation and toast feedback
      dispatch(addTab({ panelId }));
    },
    [dispatch]
  );

  // ========== Action: Close active tab ==========
  const closeActiveTab = useCallback(() => {
    const tab = getActiveTab();
    const currentPanel = findPanelById(panel, activePanelId);
    // Don't close if tab is locked OR panel is pinned
    if (tab && !tab.locked && !currentPanel?.pinned) {
      dispatch(removeTab({ tabId: tab.id }));
    }
  }, [getActiveTab, panel, activePanelId, dispatch]);

  // ========== Action: Undo close ==========
  const undoCloseTab = useCallback(() => {
    if (canUndo) {
      dispatch(undo());
    }
  }, [canUndo, dispatch]);

  // ========== Action: Navigate tabs (J = prev, K = next) ==========
  const navigateTab = useCallback(
    (direction: 'prev' | 'next') => {
      const activePanelTabs = getActivePanelTabs();
      if (activePanelTabs.length === 0) return;

      const activeTabId = activeTabIds[activePanelId];
      const currentIndex = activePanelTabs.findIndex((t) => t?.id === activeTabId);
      if (currentIndex === -1) return;

      let newIndex: number;
      if (direction === 'prev') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : activePanelTabs.length - 1;
      } else {
        newIndex = currentIndex < activePanelTabs.length - 1 ? currentIndex + 1 : 0;
      }

      const newTab = activePanelTabs[newIndex];
      if (newTab) {
        dispatch(activateTab({ tabId: newTab.id as TabId, panelId: activePanelId }));
      }
    },
    [getActivePanelTabs, activeTabIds, activePanelId, dispatch]
  );

  // ========== Action: Toggle tab lock ==========
  const toggleTabLockFn = useCallback(() => {
    const tab = getActiveTab();
    if (tab) {
      dispatch(toggleTabLock({ tabId: tab.id }));
    }
  }, [getActiveTab, dispatch]);

  // ========== Action: Toggle panel pin ==========
  const togglePanelPin = useCallback(() => {
    const currentPanel = findPanelById(panel, activePanelId);
    if (!currentPanel) return;

    if (currentPanel.pinned) {
      dispatch(unpinPanel({ panelId: activePanelId }));
    } else {
      dispatch(pinPanel({ panelId: activePanelId }));
    }
  }, [activePanelId, panel, dispatch]);

  // ========== Action: Rename tab ==========
  const renameActiveTab = useCallback(() => {
    const tab = getActiveTab();
    if (!tab || tab.locked) return;

    // Dispatch to trigger inline rename in TabBar via renamingTabId
    dispatch(startRenameTab({ tabId: tab.id }));
  }, [getActiveTab, dispatch]);

  // ========== Action: Toggle search bars ==========
  const toggleSearchBarsFn = useCallback(() => {
    dispatch(toggleSearchBars());
  }, [dispatch]);

  // ========== Action: Duplicate tab ==========
  const duplicateActiveTab = useCallback(() => {
    const tab = getActiveTab();
    if (!tab) return;

    // Dispatch intent - reducer handles validation and toast feedback
    dispatch(duplicateTab({ tabId: tab.id }));
  }, [getActiveTab, dispatch]);

  // ========== Action: Refresh tab (force refetch layout) ==========
  const refreshActiveTab = useCallback(() => {
    const tab = getActiveTab();

    // Guards: tab must exist and have a layout
    if (!tab) return;
    if (!tab.layoutId) return;

    dispatch(refreshTab({ tabId: tab.id }));
  }, [getActiveTab, dispatch]);

  // ========== Instance scoping ==========
  // Track which Prism root the user touched last; only that instance handles
  // shortcuts. The first instance to mount owns them until another is used, and
  // ownership passes to a surviving instance when the owner unmounts. A
  // workspace with shortcuts switched off never registers, so it cannot own the
  // keyboard and silence a sibling that still wants it.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enableKeyboardShortcuts) return undefined;
    const release = rootRegistry.register(root);

    const claim = () => rootRegistry.claim(root);
    root.addEventListener('mousedown', claim);
    root.addEventListener('focusin', claim);
    return () => {
      root.removeEventListener('mousedown', claim);
      root.removeEventListener('focusin', claim);
      release();
    };
  }, [rootRef, enableKeyboardShortcuts]);

  // ========== Keyboard event handler ==========
  useEffect(() => {
    if (!enableKeyboardShortcuts) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
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

      if (isNewTabChord(e)) {
        e.preventDefault();
        createTab(activePanelId);
        return;
      }

      const isCtrlSpace =
        e.ctrlKey && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar');
      if (isCtrlSpace) {
        e.preventDefault();
        if (!searchBarsHidden) {
          window.dispatchEvent(
            new CustomEvent('prism:focus-searchbar', {
              detail: { panelId: activePanelId },
            })
          );
        }
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      switch (e.key.toLowerCase()) {
        case 'd':
          // Delete (close) tab
          e.preventDefault();
          closeActiveTab();
          break;

        case 'j':
          // Navigate to previous tab
          e.preventDefault();
          navigateTab('prev');
          break;

        case 'k':
          // Navigate to next tab
          e.preventDefault();
          navigateTab('next');
          break;

        case 'o':
          // Toggle lock on active tab
          e.preventDefault();
          toggleTabLockFn();
          break;

        case 'i':
          // Toggle pin on active panel
          e.preventDefault();
          togglePanelPin();
          break;

        case 'r':
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl/Cmd + Shift + R: Refresh active tab (force refetch layout)
            refreshActiveTab();
          } else {
            // Ctrl/Cmd + R: Rename active tab
            renameActiveTab();
          }
          break;

        case 'y':
          // Toggle search bars
          e.preventDefault();
          toggleSearchBarsFn();
          break;

        case 'b':
          // Duplicate tab
          e.preventDefault();
          duplicateActiveTab();
          break;

        case 'u':
          // Undo close tab
          e.preventDefault();
          undoCloseTab();
          break;

        default:
          // Not a Prism shortcut. The browser handles the key.
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enableKeyboardShortcuts,
    rootRef,
    activePanelId,
    searchBarsHidden,
    createTab,
    closeActiveTab,
    navigateTab,
    toggleTabLockFn,
    togglePanelPin,
    renameActiveTab,
    refreshActiveTab,
    toggleSearchBarsFn,
    duplicateActiveTab,
    undoCloseTab,
  ]);
}
