import React, { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react';
import { Lock, X, Plus, Columns2 } from 'lucide-react';
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
  TooltipContent,
  TooltipTrigger,
  Spinner,
} from '@components/ui';
import { TAB_STYLE_LABELS, tabStyleVariants, migrateTabStyle } from '@constants/tab-styles';
import { getTabIcon } from '@constants/tab-icons';
import type { Tab, Theme } from '@types';
import type { AppDispatch } from '@store';
import { MAX_TAB_NAME_LENGTH, MAX_LEAF_PANELS } from '@store/workspaceSlice';
import { cn } from '@utils/cn';
import { findTabById } from '@utils/tabs';
import { makeComponentPath } from './Panel';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectRenamingTabId,
  addTab,
  removeTab,
  renameTab,
  duplicateTab,
  lockTab,
  unlockTab,
  pinPanel,
  unpinPanel,
  setTabIcon,
  setTabStyle,
  refreshTab,
  clearRenameTab,
  splitPanel,
  selectPanelCount,
} from '@store';

// =============================================================================
// TabItem - Isolated component for each tab to minimize re-renders
// =============================================================================

type TabItemProps = {
  tab: Tab;
  theme: Theme;
  isPinned: boolean;
  isActiveTab: boolean;
  isPanelActive: boolean;
  isMaxTabsReached: boolean;
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
  dispatch: AppDispatch;
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
  isActiveTab,
  isPanelActive,
  isMaxTabsReached,
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
  const { componentId = 'prism' } = useConfig();
  // Use componentId from config instead of hard-coded 'prism'
  const componentPath = useMemo(
    () => makeComponentPath(componentId, tab.id),
    [componentId, tab.id]
  );
  const isLoading = ctx?.useLoading({ rawPath: componentPath }) ?? false;

  const TabIcon = tab.icon ? getTabIcon(tab.icon) : null;
  const styleColor = migrateTabStyle(tab.style);
  const styleClasses = tabStyleVariants({ color: styleColor, theme });
  const isDefaultStyle = styleColor === 'default';
  const isLocked = tab.locked ?? false;
  const isEditing = editingTabId === tab.id;

  // When rename is triggered via context menu, Radix restores focus to the tab
  // trigger after the menu closes — stealing focus from the rename input. This
  // ref is set synchronously in the rename onSelect (before the close animation)
  // and checked in onCloseAutoFocus to prevent that focus restoration.
  const preventFocusRestoreRef = useRef(false);

  // Add drag-and-drop functionality
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id,
    data: {
      type: 'tab',
      tab,
      panelId: tab.panelId,
    },
    disabled: isLocked || isPinned || isLoading || isEditing,
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
            isDragging && 'z-50 opacity-50',
            isPinned && 'flex flex-1'
          )}
          {...listeners}
          {...attributes}
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
            className={cn(
              'h-full border-none shadow-none data-[state=active]:shadow-none',
              styleClasses,
              isPinned && 'flex-1',
              isDefaultStyle && 'prism-tab-default'
            )}
            data-default-style={isDefaultStyle || undefined}
            data-tab-style={styleColor}
          >
            {/* Content wrapper — dims text/icons in inactive panels without affecting tab background */}
            <span className={cn('flex items-center gap-1.5', !isPanelActive && 'opacity-65')}>
              {/* Tab name (hidden when editing) */}
              <span
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap',
                  isEditing && 'invisible'
                )}
              >
                {TabIcon ? <TabIcon className="size-[1.1em] shrink-0" /> : null}
                {tab.name.length > MAX_TAB_NAME_LENGTH
                  ? `${tab.name.slice(0, MAX_TAB_NAME_LENGTH)}…`
                  : tab.name}
              </span>

              {/* Lock icon or close button or spinner*/}
              {isLocked ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground flex items-center">
                      <Lock className="size-[0.85em]" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Tab is locked</TooltipContent>
                </Tooltip>
              ) : !isPinned ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Close ${tab.name} tab`}
                      data-testid={`prism-tab-close-${tab.id}`}
                      className={cn(
                        'group/close text-muted-foreground flex cursor-pointer items-center rounded-sm p-0.5 transition-all',
                        'hover:text-foreground hover:bg-muted/70',
                        isLoading || isActiveTab
                          ? 'opacity-100'
                          : 'opacity-0 group-hover/tab:opacity-100'
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
                      {/* Show spinner when loading, but X on hover to allow cancellation */}
                      {isLoading ? (
                        <>
                          <Spinner size="sm" className="shrink-0 group-hover/close:hidden" />
                          <X className="hidden size-[1.2em] stroke-[2.5] group-hover/close:block" />
                        </>
                      ) : (
                        <X className="size-[1.2em] stroke-[2.5]" />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{isLoading ? 'Cancel' : 'Close tab'}</TooltipContent>
                </Tooltip>
              ) : isLoading ? (
                <Spinner size="sm" className="text-muted-foreground" />
              ) : null}
            </span>

            {/* Rename input overlay — outside content wrapper (absolutely positioned) */}
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
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                autoFocus
              />
            )}
          </TabsTrigger>
        </div>
      </ContextMenuTrigger>

      {/* ===== CONTEXT MENU ===== */}
      <ContextMenuContent
        className="min-w-36"
        theme={theme}
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
          disabled={isLocked || isPinned}
          onSelect={() => {
            preventFocusRestoreRef.current = true;
            onStartRename(tab);
          }}
        >
          Rename
          <ContextMenuShortcut>⌃R</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          data-testid="prism-context-menu-duplicate"
          disabled={isPinned || isMaxTabsReached}
          onSelect={() => onDuplicateTab(tab)}
        >
          Duplicate
          <ContextMenuShortcut>⌃B</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem data-testid="prism-context-menu-info" onSelect={() => onOpenInfo?.(tab)}>
          Info
        </ContextMenuItem>

        {/* Share - only available if tab has a layoutId */}
        {tab.layoutId && (
          <ContextMenuItem data-testid="prism-context-menu-share" onSelect={() => onShareTab(tab)}>
            Share
          </ContextMenuItem>
        )}

        {/* Refresh - force refetch layout from server */}
        {tab.layoutId && (
          <ContextMenuItem
            data-testid="prism-context-menu-refresh"
            onSelect={() => dispatch(refreshTab({ tabId: tab.id }))}
          >
            Refresh
            <ContextMenuShortcut>⌃⇧R</ContextMenuShortcut>
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
          <ContextMenuSubContent theme={theme}>
            <ContextMenuRadioGroup value={styleColor}>
              {Object.entries(TAB_STYLE_LABELS).map(([styleKey, label]) => (
                <ContextMenuRadioItem
                  key={styleKey}
                  value={styleKey}
                  data-testid={`prism-context-menu-style-${styleKey}`}
                  onSelect={() => onSetTabStyle(tab, styleKey)}
                >
                  {label}
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
            onSelect={() => dispatch(lockTab({ tabId: tab.id }))}
          >
            Lock Tab
            <ContextMenuShortcut>⌃O</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {isLocked && !isPinned && (
          <ContextMenuItem
            data-testid="prism-context-menu-unlock"
            onSelect={() => dispatch(unlockTab({ tabId: tab.id }))}
          >
            Unlock Tab
            <ContextMenuShortcut>⌃O</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {/* Pin/Unpin Panel */}
        {!isPinned && (
          <ContextMenuItem data-testid="prism-context-menu-pin" onSelect={onPinPanel}>
            Pin Panel
            <ContextMenuShortcut>⌃I</ContextMenuShortcut>
          </ContextMenuItem>
        )}
        {isPinned && (
          <ContextMenuItem data-testid="prism-context-menu-unpin" onSelect={onUnpinPanel}>
            Unpin Panel
            <ContextMenuShortcut>⌃I</ContextMenuShortcut>
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
  isActive?: boolean;
  onOpenInfo?: (tab: Tab) => void;
};

export const TabBar = memo(function TabBar({
  panelId,
  tabs,
  activeTabId,
  isPinned = false,
  isActive = false,
  onOpenInfo,
}: TabBarProps) {
  const dispatch = useAppDispatch();
  const allTabs = useAppSelector(selectTabs);
  const renamingTabId = useAppSelector(selectRenamingTabId);
  const { openInfoModal, openSetIconModal } = usePrism();
  const { maxTabs, theme } = useConfig();
  const { shareTab } = useShareLinks();
  const totalTabCount = allTabs.length;
  const isMaxTabsReached = maxTabs >= 1 && totalTabCount >= maxTabs;

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // ================================================================================
  // Scroll Indicators
  // ================================================================================

  const updateScrollIndicators = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Threshold accounts for sub-pixel rounding in scrollWidth
    const SCROLL_THRESHOLD = 1;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - SCROLL_THRESHOLD);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollIndicators();
    el.addEventListener('scroll', updateScrollIndicators, { passive: true });
    const observer = new ResizeObserver(updateScrollIndicators);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollIndicators);
      observer.disconnect();
    };
  }, [updateScrollIndicators, tabs.length]);

  // ================================================================================
  // Handlers
  // ================================================================================

  const closeTab = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      // Don't allow closing tabs in pinned panels
      if (isPinned) return;
      const tab = findTabById(tabs, tabId);
      if (tab && !tab.locked) {
        dispatch(removeTab({ tabId }));
      }
    },
    [tabs, dispatch, isPinned]
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
      dispatch(renameTab({ tabId: editingTabId, name: editingName.trim() }));
    }
    setEditingTabId(null);
    setEditingName('');
  }, [editingTabId, editingName, dispatch]);

  const cancelRename = useCallback(() => {
    setEditingTabId(null);
    setEditingName('');
    dispatch(clearRenameTab());
  }, [dispatch]);

  const handleAddTab = useCallback(() => {
    if (isMaxTabsReached) return;
    dispatch(addTab({ panelId }));
  }, [isMaxTabsReached, panelId, dispatch]);

  const panelCount = useAppSelector(selectPanelCount);
  const isMaxPanelsReached = panelCount >= MAX_LEAF_PANELS;

  const handleSplitPanel = useCallback(async () => {
    if (isMaxPanelsReached || isMaxTabsReached) return;
    const result = await dispatch(addTab({ panelId }));
    if (addTab.fulfilled.match(result)) {
      dispatch(
        splitPanel({
          panelId,
          direction: 'horizontal',
          tabId: result.payload.tab.id,
          position: 'after',
        })
      );
    }
  }, [dispatch, panelId, isMaxPanelsReached, isMaxTabsReached]);

  // Listen for keyboard-triggered rename via renamingTabId
  useEffect(() => {
    if (!renamingTabId) return;

    // Only handle if the tab belongs to this panel
    const tab = tabs.find((t) => t.id === renamingTabId);
    if (tab && !tab.locked && !isPinned) {
      startRename(tab);
    }
    // Clear the rename trigger after handling
    dispatch(clearRenameTab());
  }, [renamingTabId, tabs, isPinned, startRename, dispatch]);

  const handleDuplicateTab = useCallback(
    (tab: Tab) => {
      if (isMaxTabsReached) return;
      dispatch(duplicateTab({ tabId: tab.id }));
    },
    [dispatch, isMaxTabsReached]
  );

  const handleSetTabIcon = useCallback(
    (tab: Tab, icon: string | undefined) => {
      // If icon is undefined, open the picker modal; otherwise set directly
      if (icon === undefined) {
        openSetIconModal(tab);
      } else {
        dispatch(setTabIcon({ tabId: tab.id, icon }));
      }
    },
    [dispatch, openSetIconModal]
  );

  const handleSetTabStyle = useCallback(
    (tab: Tab, style: string) => {
      dispatch(setTabStyle({ tabId: tab.id, style }));
    },
    [dispatch]
  );

  const handlePinPanel = useCallback(() => {
    dispatch(pinPanel({ panelId }));
  }, [panelId, dispatch]);

  const handleUnpinPanel = useCallback(() => {
    dispatch(unpinPanel({ panelId }));
  }, [panelId, dispatch]);

  // ================================================================================
  // RENDER
  // ================================================================================

  return (
    <div
      ref={setNodeRef}
      className="prism-tabbar border-border relative flex w-full shrink-0 items-stretch"
    >
      {/* Drop zone highlight overlay */}
      {isOver && <div className="bg-primary/15 pointer-events-none absolute inset-0 z-10" />}
      {/* Scrollable tab container with + button inside, hidden scrollbar */}
      <div
        ref={scrollContainerRef}
        className="prism-tabbar-scroll scrollbar-none flex min-w-0 flex-1 items-stretch overflow-x-scroll overflow-y-hidden"
        data-can-scroll-left={canScrollLeft || undefined}
        data-can-scroll-right={canScrollRight || undefined}
      >
        {/* Radix TabsList - provides keyboard navigation and ARIA */}
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <TabsList
            className={cn(
              'flex-nowrap gap-0 rounded-none bg-transparent p-0',
              isPinned && 'flex-1'
            )}
          >
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                theme={theme}
                isPinned={isPinned}
                isActiveTab={tab.id === activeTabId}
                isPanelActive={isActive}
                isMaxTabsReached={isMaxTabsReached}
                editingTabId={editingTabId}
                editingName={editingName}
                inputRef={inputRef}
                onStartRename={startRename}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
                onEditingNameChange={setEditingName}
                onCloseTab={closeTab}
                onDuplicateTab={handleDuplicateTab}
                onSetTabIcon={handleSetTabIcon}
                onSetTabStyle={handleSetTabStyle}
                onPinPanel={handlePinPanel}
                onUnpinPanel={handleUnpinPanel}
                onOpenInfo={openInfoModal}
                onShareTab={shareTab}
                dispatch={dispatch}
              />
            ))}
          </TabsList>
        </SortableContext>

        {/* Add tab button - inside scroll area, hidden when pinned */}
        {!isPinned && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="prism-tabbar-add-button"
                className="prism-tabbar-add hover:bg-muted flex h-full shrink-0 items-center justify-center transition-colors"
                onClick={handleAddTab}
                disabled={isMaxTabsReached}
              >
                <Plus />
              </button>
            </TooltipTrigger>
            <TooltipContent>{isMaxTabsReached ? 'Max tabs reached' : 'New tab'}</TooltipContent>
          </Tooltip>
        )}
        {!isPinned && (
          <div
            className="h-full min-w-8 flex-1 cursor-pointer"
            onDoubleClick={handleAddTab}
            title="Double-click to add new tab"
          />
        )}
      </div>
      {!isPinned && isActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              data-testid="prism-tabbar-split-button"
              className="prism-tabbar-split flex h-full shrink-0 items-center justify-center transition-colors"
              onClick={handleSplitPanel}
              disabled={isMaxPanelsReached || isMaxTabsReached}
            >
              <Columns2 />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {isMaxPanelsReached
              ? 'Max panels reached'
              : isMaxTabsReached
                ? 'Max tabs reached'
                : 'Split panel'}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
