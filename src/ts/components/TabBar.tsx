import React, { useState, useRef, useCallback, useMemo, memo } from 'react';
import { Lock, X, LoaderCircle, Plus } from 'lucide-react';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { useShareLinks } from '@hooks/useShareLinks';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  TabsList,
  TabsTrigger,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  Tooltip,
  Spinner,
} from '@components/ui';
import { TAB_STYLE_VARIANTS, getTabStyleClasses } from '@constants/tab-styles';
import { getTabIcon } from '@constants/tab-icons';
import type { Tab, Theme } from '@types';
import type { Action } from '@context/prismReducer';
import { cn } from '@utils/cn';
import { findTabById } from '@utils/tabs';
import { makeComponentPath } from './Panel';

// =============================================================================
// TabItem - Isolated component for each tab to minimize re-renders
// =============================================================================

type TabItemProps = {
  tab: Tab;
  theme: Theme;
  isPinned: boolean;
  editingTabId: string | null;
  editingName: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onStartRename: (tab: Tab) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onEditingNameChange: (name: string) => void;
  onCloseTab: (tabId: string, e?: React.MouseEvent) => void;
  onDuplicateTab: (tab: Tab) => void;
  onSetTabIcon: (tab: Tab, icon: string | undefined) => void;
  onSetTabStyle: (tab: Tab, style: string) => void;
  onPinPanel: () => void;
  onUnpinPanel: () => void;
  onOpenInfo?: (tab: Tab) => void;
  onShareTab: (tab: Tab) => void;
  dispatch: React.Dispatch<Action>;
};

/**
 * TabItem - Renders a single tab with its own loading state hook.
 *
 * By isolating each tab into its own component:
 * 1. useLoading can be called at the top level (satisfying Rules of Hooks)
 * 2. Only tabs whose loading state changes will re-render (minimizing re-renders)
 */
const TabItem = memo(function TabItem({
  tab,
  theme,
  isPinned,
  editingTabId,
  editingName,
  inputRef,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onEditingNameChange,
  onCloseTab,
  onDuplicateTab,
  onSetTabIcon,
  onSetTabStyle,
  onPinPanel,
  onUnpinPanel,
  onOpenInfo,
  onShareTab,
  dispatch,
}: TabItemProps) {
  // Now useLoading is called at component top-level (not in a loop)
  const ctx = window.dash_component_api?.useDashContext?.();
  // Only depend on tab.id - makeComponentPath only uses tab.id
  const componentPath = useMemo(() => ['prism', 'content', tab.id], [tab.id]);
  const isLoading = ctx?.useLoading({ rawPath: componentPath }) ?? false;

  const TabIcon = tab.icon ? getTabIcon(tab.icon) : null;
  const styleClasses = getTabStyleClasses(tab.style, theme);
  const isLocked = tab.locked ?? false;
  const isEditing = editingTabId === tab.id;

  // Add drag-and-drop functionality
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
    data: {
      type: 'tab',
      tab,
      panelId: tab.panelId,
    },
    disabled: isLocked || isPinned || isLoading,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/* Wrapper div for DnD - TabsTrigger handles selection */}
        <div
          ref={setNodeRef}
          style={style}
          data-testid={`prism-tab-${tab.id}`}
          className={cn(
            'group/tab relative cursor-default self-stretch',
            isDragging && 'z-50 opacity-50'
          )}
          {...listeners}
          {...attributes}
          // onDoubleClick={(e) => {
          //   e.stopPropagation();
          //   if (!isLocked && !isPinned) onStartRename(tab);
          // }}
        >
          {/* Radix TabsTrigger - auto-handles value matching */}
          <TabsTrigger
            value={tab.id}
            isLocked={isLocked}
            isLoading={isLoading}
            title={tab.name}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!isLocked && !isPinned) onStartRename(tab);
            }}
            className={cn('h-full', styleClasses)}
          >
            {/* Tab name (hidden when editing) */}
            <span
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap',
                isEditing && 'invisible'
              )}
            >
              {TabIcon ? <TabIcon className="h-3.5 w-3.5 shrink-0" /> : null}
              {tab.name.length > 24 ? `${tab.name.slice(0, 24)}…` : tab.name}
            </span>

            {/* Rename input overlay */}
            {isEditing && (
              <input
                ref={inputRef}
                data-testid={`prism-tab-rename-${tab.id}`}
                className="prism-tab-rename-input absolute inset-0"
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                onBlur={onCommitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onCommitRename();
                  if (e.key === 'Escape') onCancelRename();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {/* Lock icon or close button or spinner*/}
            {isLocked ? (
              <Tooltip content="Tab is locked">
                <span className="text-secondary flex items-center">
                  <Lock className="h-3.5 w-3.5" />
                </span>
              </Tooltip>
            ) : !isPinned ? (
              <Tooltip content={isLoading ? 'Cancel' : 'Close tab'}>
                <span
                  role="button"
                  tabIndex={0}
                  data-testid={`prism-tab-close-${tab.id}`}
                  className={cn(
                    'text-secondary flex cursor-pointer items-center rounded-sm p-0.5 transition-all',
                    'hover:text-foreground hover:bg-destructive/20',
                    isLoading ? 'opacity-100' : 'opacity-0 group-hover/tab:opacity-100'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }
                  }}
                >
                  {isLoading ? (
                    <Spinner size="sm" className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </span>
              </Tooltip>
            ) : isLoading ? (
              <LoaderCircle className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
            ) : null}
          </TabsTrigger>
        </div>
      </ContextMenuTrigger>

      {/* ===== CONTEXT MENU ===== */}
      <ContextMenuContent className="min-w-36" theme={theme} data-testid="prism-context-menu">
        <ContextMenuItem
          data-testid="prism-context-menu-rename"
          disabled={isLocked || isPinned}
          onSelect={() => onStartRename(tab)}
        >
          Rename
          <ContextMenuShortcut>⌃R</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          data-testid="prism-context-menu-duplicate"
          disabled={isPinned}
          onSelect={() => onDuplicateTab(tab)}
        >
          Duplicate
          <ContextMenuShortcut>⌃⇧D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem data-testid="prism-context-menu-info" onSelect={() => onOpenInfo?.(tab)}>
          Info
          <ContextMenuShortcut>⌃I</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Share - only available if tab has a layoutId */}
        {tab.layoutId && (
          <ContextMenuItem data-testid="prism-context-menu-share" onSelect={() => onShareTab(tab)}>
            Share
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Icon submenu */}
        <ContextMenuItem
          data-testid="prism-context-menu-icon"
          onSelect={() => onSetTabIcon(tab, undefined)}
        >
          {tab.icon ? 'Change Icon' : 'Add Icon'}
        </ContextMenuItem>

        {/* Style submenu */}
        <ContextMenuSub>
          <ContextMenuSubTrigger>Style</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuRadioGroup value={tab.style || 'default'}>
              {Object.keys(TAB_STYLE_VARIANTS).map((styleKey) => (
                <ContextMenuRadioItem
                  key={styleKey}
                  value={styleKey}
                  data-testid={`prism-context-menu-style-${styleKey}`}
                  onSelect={() => onSetTabStyle(tab, styleKey)}
                >
                  {styleKey.charAt(0).toUpperCase() + styleKey.slice(1)}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>

        <ContextMenuSeparator />

        {/* Lock/Unlock */}
        {tab.layoutId && !isLocked && !isPinned && (
          <ContextMenuItem
            data-testid="prism-context-menu-lock"
            onSelect={() => dispatch({ type: 'LOCK_TAB', payload: { tabId: tab.id } })}
          >
            Lock Tab
            <ContextMenuShortcut>⌃L</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {isLocked && !isPinned && (
          <ContextMenuItem
            data-testid="prism-context-menu-unlock"
            onSelect={() => dispatch({ type: 'UNLOCK_TAB', payload: { tabId: tab.id } })}
          >
            Unlock Tab
            <ContextMenuShortcut>⌃L</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {/* Pin/Unpin Panel */}
        {!isPinned && (
          <ContextMenuItem data-testid="prism-context-menu-pin" onSelect={onPinPanel}>
            Pin Panel
          </ContextMenuItem>
        )}
        {isPinned && (
          <ContextMenuItem data-testid="prism-context-menu-unpin" onSelect={onUnpinPanel}>
            Unpin Panel
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          data-testid="prism-context-menu-close"
          variant="destructive"
          disabled={isLocked || isPinned}
          onSelect={() => onCloseTab(tab.id)}
        >
          Close Tab
          <ContextMenuShortcut>⌃D</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

// =============================================================================
// TabBar
// =============================================================================

type TabBarProps = {
  panelId: string;
  tabs: Tab[];
  activeTabId: string | null;
  isPinned?: boolean;
  onOpenInfo?: (tab: Tab) => void;
};

export const TabBar = memo(function TabBar({
  panelId,
  tabs,
  activeTabId,
  isPinned = false,
  onOpenInfo,
}: TabBarProps) {
  const { openInfoModal, openSetIconModal, dispatch } = usePrism();
  const { maxTabs, theme } = useConfig();
  const { shareTab } = useShareLinks();

  // ================================================================================
  // DND DROP ZONE
  // ================================================================================
  const { active } = useDndContext();
  // Only show drop zone if dragging a tab from a DIFFERENT panel AND panel is not pinned
  const isDraggingFromOtherPanel =
    active &&
    active.data.current?.type === 'tab' &&
    active.data.current?.panelId !== panelId &&
    !isPinned;

  const { setNodeRef, isOver } = useDroppable({
    id: `searchbar-drop-${panelId}`,
    data: { panelId, type: 'searchbar' },
    disabled: !isDraggingFromOtherPanel,
  });

  // ================================================================================
  // State
  // ================================================================================

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ================================================================================
  // Handlers
  // ================================================================================

  const closeTab = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const tab = findTabById(tabs, tabId);
      if (tab && !tab.locked) {
        dispatch({ type: 'REMOVE_TAB', payload: { tabId } });
      }
    },
    [tabs, dispatch]
  );

  const startRename = useCallback(
    (tab: Tab) => {
      if (tab.locked || isPinned) return;
      setEditingTabId(tab.id);
      setEditingName(tab.name);
      setTimeout(() => inputRef.current?.select(), 0);
    },
    [isPinned]
  );

  const commitRename = useCallback(() => {
    if (editingTabId && editingName.trim()) {
      dispatch({ type: 'RENAME_TAB', payload: { tabId: editingTabId, name: editingName.trim() } });
    }
    setEditingTabId(null);
    setEditingName('');
  }, [editingTabId, editingName, dispatch]);

  const cancelRename = useCallback(() => {
    setEditingTabId(null);
    setEditingName('');
  }, []);

  const addTab = useCallback(() => {
    if (maxTabs > 0 && tabs.length >= maxTabs) return;
    dispatch({ type: 'ADD_TAB', payload: { panelId } });
  }, [tabs.length, maxTabs, panelId, dispatch]);

  const duplicateTab = useCallback(
    (tab: Tab) => {
      dispatch({ type: 'DUPLICATE_TAB', payload: { tabId: tab.id } });
    },
    [dispatch]
  );

  const setTabIcon = useCallback(
    (tab: Tab, icon: string | undefined) => {
      // If icon is undefined, open the picker modal; otherwise set directly
      if (icon === undefined) {
        openSetIconModal(tab);
      } else {
        dispatch({ type: 'SET_TAB_ICON', payload: { tabId: tab.id, icon } });
      }
    },
    [dispatch, openSetIconModal]
  );

  const setTabStyle = useCallback(
    (tab: Tab, style: string) => {
      dispatch({ type: 'SET_TAB_STYLE', payload: { tabId: tab.id, style } });
    },
    [dispatch]
  );

  const pinPanel = useCallback(() => {
    dispatch({ type: 'PIN_PANEL', payload: { panelId } });
  }, [panelId, dispatch]);

  const unpinPanel = useCallback(() => {
    dispatch({ type: 'UNPIN_PANEL', payload: { panelId } });
  }, [panelId, dispatch]);

  // ================================================================================
  // RENDER
  // ================================================================================

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-surface border-border relative flex w-full shrink-0 items-stretch border-b',
        isPinned && 'prism-tabbar-pinned'
      )}
    >
      {/* Drop zone highlight overlay */}
      {isOver && (
        <div className="ring-primary bg-primary/10 pointer-events-none absolute inset-0 z-10 ring-2 ring-inset" />
      )}
      {/* Radix TabsList - provides keyboard navigation and ARIA */}
      <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
        <TabsList className={cn('flex-0 justify-start gap-0', isPinned && 'prism-tabbar-pinned')}>
          {tabs.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              theme={theme}
              isPinned={isPinned}
              editingTabId={editingTabId}
              editingName={editingName}
              inputRef={inputRef}
              onStartRename={startRename}
              onCommitRename={commitRename}
              onCancelRename={cancelRename}
              onEditingNameChange={setEditingName}
              onCloseTab={closeTab}
              onDuplicateTab={duplicateTab}
              onSetTabIcon={setTabIcon}
              onSetTabStyle={setTabStyle}
              onPinPanel={pinPanel}
              onUnpinPanel={unpinPanel}
              onOpenInfo={openInfoModal}
              onShareTab={shareTab}
              dispatch={dispatch}
            />
          ))}
        </TabsList>
      </SortableContext>

      {/* Add tab button - hidden when pinned */}
      {!isPinned && (
        <Tooltip content={maxTabs > 0 && tabs.length >= maxTabs ? 'Max tabs reached' : 'New tab'}>
          <button
            data-testid="prism-tabbar-add-button"
            className="prism-tabbar-add hover:bg-accent flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
            onClick={addTab}
            disabled={maxTabs > 0 && tabs.length >= maxTabs}
          >
            <Plus className="h-4 w-4" />
          </button>
        </Tooltip>
      )}

      {/* Spacer - double-click to create new tab */}
      {!isPinned && (
        <div
          className="h-full min-w-8 flex-grow cursor-pointer"
          onDoubleClick={addTab}
          title="Double-click to add new tab"
        />
      )}
    </div>
  );
});
