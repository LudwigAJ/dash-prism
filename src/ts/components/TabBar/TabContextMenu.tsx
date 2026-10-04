import React, { useRef } from 'react';
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
} from '@components/ui';
import {
  SHORTCUTS,
  formatShortcut,
  isMacPlatform,
  type ShortcutAction,
} from '@constants/shortcuts';
import { TAB_STYLE_LABELS, migrateTabStyle } from '@constants/tab-styles';
import { useConfig } from '@context/ConfigContext';
import { useShareLink } from '@hooks/useShareLinks';
import type { Tab } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectTabCount,
  canAddTab,
  removeTab,
  duplicateTab,
  lockTab,
  unlockTab,
  pinPanel,
  unpinPanel,
  setTabStyle,
  refreshTab,
  openInfoModal,
  openSetIconModal,
} from '@store';
import { canRenameTab } from './useTabRename';

/** Holds the props of `TabContextMenu`. */
interface TabContextMenuProps {
  tab: Tab;
  /** Whether the panel of the tab is pinned. */
  isPinned: boolean;
  onStartRename: (tab: Tab) => void;
}

/**
 * Renders the content of the context menu of a tab. The caller puts it in a `ContextMenu` next to
 * the `ContextMenuTrigger` of the tab.
 */
export function TabContextMenu({ tab, isPinned, onStartRename }: TabContextMenuProps) {
  const dispatch = useAppDispatch();
  const tabCount = useAppSelector(selectTabCount);
  const { maxTabs, enableShareLinks } = useConfig();
  const { shareTab } = useShareLink();
  const isLocked = tab.locked ?? false;
  const tabId = tab.id;

  // After a menu item is selected, Radix moves the focus back to the tab trigger when the menu
  // closes. For Rename, that takes the focus from the rename input. The Rename item sets this
  // ref before the menu closes, and onCloseAutoFocus then keeps the focus where it is.
  const preventFocusRestoreRef = useRef(false);

  return (
    <ContextMenuContent
      className="tw:min-w-36"
      data-testid="prism-context-menu"
      onCloseAutoFocus={(e) => {
        if (preventFocusRestoreRef.current) {
          e.preventDefault();
          preventFocusRestoreRef.current = false;
        }
      }}
    >
      <ContextMenuItem
        data-testid="prism-context-menu-rename"
        disabled={!canRenameTab(tab, isPinned)}
        onSelect={() => {
          preventFocusRestoreRef.current = true;
          onStartRename(tab);
        }}
      >
        Rename
        <MenuShortcut action="renameTab" />
      </ContextMenuItem>

      <ContextMenuItem
        data-testid="prism-context-menu-duplicate"
        disabled={isPinned || !canAddTab(tabCount, maxTabs)}
        onSelect={() => dispatch(duplicateTab({ tabId }))}
      >
        Duplicate
        <MenuShortcut action="duplicateTab" />
      </ContextMenuItem>

      <ContextMenuItem
        data-testid="prism-context-menu-info"
        onSelect={() => dispatch(openInfoModal({ tabId }))}
      >
        Info
      </ContextMenuItem>

      {/* Share needs a layout to share */}
      {enableShareLinks && tab.layoutId && (
        <ContextMenuItem data-testid="prism-context-menu-share" onSelect={() => shareTab(tab)}>
          Share
        </ContextMenuItem>
      )}

      {/* Refresh fetches the layout from the server again */}
      {tab.layoutId && (
        <ContextMenuItem
          data-testid="prism-context-menu-refresh"
          onSelect={() => dispatch(refreshTab({ tabId }))}
        >
          Refresh
          <MenuShortcut action="refreshTab" />
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem
        data-testid="prism-context-menu-icon"
        onSelect={() => dispatch(openSetIconModal({ tabId }))}
      >
        {tab.icon ? 'Change Icon' : 'Add Icon'}
      </ContextMenuItem>

      <ContextMenuSub>
        <ContextMenuSubTrigger>Style</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuRadioGroup value={migrateTabStyle(tab.style)}>
            {Object.entries(TAB_STYLE_LABELS).map(([style, label]) => (
              <ContextMenuRadioItem
                key={style}
                value={style}
                data-testid={`prism-context-menu-style-${style}`}
                onSelect={() => dispatch(setTabStyle({ tabId, style }))}
              >
                {label}
              </ContextMenuRadioItem>
            ))}
          </ContextMenuRadioGroup>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSeparator />

      {tab.layoutId && !isLocked && !isPinned && (
        <ContextMenuItem
          data-testid="prism-context-menu-lock"
          onSelect={() => dispatch(lockTab({ tabId }))}
        >
          Lock Tab
          <MenuShortcut action="toggleLock" />
        </ContextMenuItem>
      )}
      {isLocked && !isPinned && (
        <ContextMenuItem
          data-testid="prism-context-menu-unlock"
          onSelect={() => dispatch(unlockTab({ tabId }))}
        >
          Unlock Tab
          <MenuShortcut action="toggleLock" />
        </ContextMenuItem>
      )}

      {isPinned ? (
        <ContextMenuItem
          data-testid="prism-context-menu-unpin"
          onSelect={() => dispatch(unpinPanel({ panelId: tab.panelId }))}
        >
          Unpin Panel
          <MenuShortcut action="togglePin" />
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          data-testid="prism-context-menu-pin"
          onSelect={() => dispatch(pinPanel({ panelId: tab.panelId }))}
        >
          Pin Panel
          <MenuShortcut action="togglePin" />
        </ContextMenuItem>
      )}

      <ContextMenuSeparator />

      <ContextMenuItem
        data-testid="prism-context-menu-close"
        variant="destructive"
        disabled={isLocked || isPinned}
        onSelect={() => dispatch(removeTab({ tabId }))}
      >
        Close Tab
        <MenuShortcut action="closeTab" />
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

/** Holds the props of `MenuShortcut`. */
interface MenuShortcutProps {
  action: ShortcutAction;
}

/** Renders the keys of the shortcut of a menu item, when the keyboard shortcuts are on. */
function MenuShortcut({ action }: MenuShortcutProps) {
  const { enableKeyboardShortcuts } = useConfig();
  if (!enableKeyboardShortcuts) return null;
  return (
    <ContextMenuShortcut>{formatShortcut(SHORTCUTS[action], isMacPlatform())}</ContextMenuShortcut>
  );
}
