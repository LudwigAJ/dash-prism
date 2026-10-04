import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ContextMenu,
  ContextMenuTrigger,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Spinner,
} from '@components/ui';
import { tabStyleVariants, migrateTabStyle } from '@constants/tab-styles';
import { getTabIcon } from '@constants/tab-icons';
import { useConfig } from '@context/ConfigContext';
import type { Tab, TabId } from '@types';
import { MAX_TAB_NAME_LENGTH } from '@store/workspaceSlice';
import { useAppDispatch, removeTab } from '@store';
import { cn } from '@utils/cn';
import { makeComponentPath } from '@utils/dashSpec';
import { TabContextMenu } from './TabContextMenu';

const ACTIVE_TAB_SELECTOR = '[role="tablist"] [role="tab"][data-state="active"]';

/** Holds the props of `TabItem`. */
interface TabItemProps {
  tab: Tab;
  /** Whether the panel of the tab is pinned. */
  isPinned: boolean;
  isActiveTab: boolean;
  /** Whether the panel of the tab is the active panel. */
  isPanelActive: boolean;
  /** Whether the tab shows the rename input. */
  isEditing: boolean;
  onStartRename: (tab: Tab) => void;
  onCommitRename: (tabId: TabId, name: string) => void;
  onCancelRename: () => void;
}

/**
 * Renders one tab of a tab bar with its context menu. Each tab is its own component, so it can
 * call `useLoading` for its content, and so only a tab whose props or loading state change
 * renders again.
 */
export const TabItem = memo(function TabItem({
  tab,
  isPinned,
  isActiveTab,
  isPanelActive,
  isEditing,
  onStartRename,
  onCommitRename,
  onCancelRename,
}: TabItemProps) {
  const dispatch = useAppDispatch();
  const ctx = window.dash_component_api?.useDashContext?.();
  const { componentId = 'prism', theme } = useConfig();
  const componentPath = useMemo(
    () => makeComponentPath(componentId, tab.id),
    [componentId, tab.id]
  );
  const isLoading = ctx?.useLoading({ rawPath: componentPath }) ?? false;

  const TabIcon = tab.icon ? getTabIcon(tab.icon) : null;
  const styleColor = migrateTabStyle(tab.style);
  const isDefaultStyle = styleColor === 'default';
  const isLocked = tab.locked ?? false;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tab.id,
    data: {
      type: 'tab',
      tab,
      panelId: tab.panelId,
    },
    disabled: isLocked || isPinned || isLoading || isEditing,
  });

  // The close button and the rename input are next to the trigger, because a button cannot hold
  // another control. So the wrapper, and not the trigger, dims an inactive tab, and the close
  // button dims with it.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: (isDragging ? 0.5 : 1) * (isActiveTab ? 1 : 0.5),
  };
  const hasCloseButton = !isLocked && !isPinned;

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Delete closes the focused tab, as in the APG tabs pattern. Backspace is the Delete key of a
    // Mac keyboard.
    if ((e.key !== 'Delete' && e.key !== 'Backspace') || !hasCloseButton) return;
    e.preventDefault();
    const tabList = e.currentTarget.closest('[role="tablist"]');
    const root = e.currentTarget.closest('.prism-root');
    dispatch(removeTab({ tabId: tab.id }));
    // The focused trigger is gone, so the focus moves to the tab that is active now. When the
    // panel closed with its last tab, its tab list is gone too, so another panel takes the focus.
    requestAnimationFrame(() => {
      const scope = tabList?.isConnected ? tabList : root;
      scope?.querySelector<HTMLElement>(ACTIVE_TAB_SELECTOR)?.focus();
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/*
          The wrapper takes the pointer and keyboard listeners of the drag, so a press on the close
          button can also start a drag. The trigger is the activator: the keyboard drag starts only
          when Space on the trigger bubbles up to the wrapper. The trigger handles the key first,
          and the Tabs root uses manual activation, so Space both selects the tab and picks it up.
          Enter only selects it, because the keyboard sensor in DndProvider starts on Space alone.
          The wrapper takes no role and no tab stop, so the tab list has one tab stop, the active
          trigger.
        */}
        <div
          ref={setNodeRef}
          style={style}
          data-testid={`prism-tab-${tab.id}`}
          className={cn(
            'tw:group/tab tw:relative tw:cursor-default tw:self-stretch',
            isDragging && 'tw:z-50',
            isPinned && 'tw:flex tw:flex-1'
          )}
          {...listeners}
        >
          <TabsTrigger
            ref={setActivatorNodeRef}
            aria-describedby={attributes['aria-describedby']}
            value={tab.id}
            isLocked={isLocked}
            isLoading={isLoading}
            title={tab.name}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onStartRename(tab);
            }}
            onKeyDown={handleTriggerKeyDown}
            className={cn(
              'tw:h-full tw:border-none tw:shadow-none tw:data-[state=active]:shadow-none tw:data-[state=inactive]:opacity-100',
              tabStyleVariants({ color: styleColor, theme }),
              isPinned && 'tw:flex-1',
              isDefaultStyle && 'prism-tab-default'
            )}
            data-default-style={isDefaultStyle || undefined}
            data-tab-style={styleColor}
          >
            {/* Dims the text and the icons in an inactive panel, but not the tab background */}
            <span
              className={cn(
                'tw:flex tw:items-center tw:gap-1.5',
                !isPanelActive && 'tw:opacity-65'
              )}
            >
              {/* The rename input covers the name */}
              <span
                className={cn(
                  'tw:flex tw:items-center tw:gap-1.5 tw:whitespace-nowrap',
                  isEditing && 'tw:invisible'
                )}
              >
                {TabIcon ? <TabIcon className="tw:size-[1.1em] tw:shrink-0" /> : null}
                {tab.name.length > MAX_TAB_NAME_LENGTH
                  ? `${tab.name.slice(0, MAX_TAB_NAME_LENGTH)}…`
                  : tab.name}
              </span>

              {isLocked ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="tw:flex tw:items-center tw:text-muted-foreground">
                      <Lock className="tw:size-[0.85em]" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Tab is locked</TooltipContent>
                </Tooltip>
              ) : hasCloseButton ? (
                // Keeps the room of the close button, which covers this spacer
                <span className="tw:box-content tw:size-[1.2em] tw:p-0.5" />
              ) : isLoading ? (
                <Spinner size="sm" className="tw:text-muted-foreground" />
              ) : null}
            </span>
          </TabsTrigger>

          {hasCloseButton && (
            <span className={cn('prism-tab-close', !isPanelActive && 'tw:opacity-65')}>
              <Tooltip>
                <TooltipTrigger asChild>
                  {/* Delete on the trigger closes the tab, so the button is no tab stop */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Close ${tab.name} tab`}
                    data-testid={`prism-tab-close-${tab.id}`}
                    className={cn(
                      'tw:group/close tw:flex tw:cursor-pointer tw:items-center tw:rounded-sm tw:p-0.5 tw:text-muted-foreground tw:transition-all',
                      'tw:hover:bg-muted/70 tw:hover:text-foreground',
                      isLoading || isActiveTab
                        ? 'tw:opacity-100'
                        : 'tw:opacity-0 tw:group-hover/tab:opacity-100'
                    )}
                    onClick={() => dispatch(removeTab({ tabId: tab.id }))}
                  >
                    {/* A loading tab shows a spinner, and an X on hover to cancel the load */}
                    {isLoading ? (
                      <>
                        <Spinner size="sm" className="tw:shrink-0 tw:group-hover/close:hidden" />
                        <X className="tw:hidden tw:size-[1.2em] tw:stroke-[2.5] tw:group-hover/close:block" />
                      </>
                    ) : (
                      <X className="tw:size-[1.2em] tw:stroke-[2.5]" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isLoading ? 'Cancel' : 'Close tab'}</TooltipContent>
              </Tooltip>
            </span>
          )}

          {isEditing && (
            <TabRenameInput tab={tab} onCommit={onCommitRename} onCancel={onCancelRename} />
          )}
        </div>
      </ContextMenuTrigger>

      <TabContextMenu tab={tab} isPinned={isPinned} onStartRename={onStartRename} />
    </ContextMenu>
  );
});

/** Holds the props of `TabRenameInput`. */
interface TabRenameInputProps {
  tab: Tab;
  onCommit: (tabId: TabId, name: string) => void;
  onCancel: () => void;
}

/**
 * Renders the inline rename input of a tab. It mounts when the rename starts, so it starts with
 * the current name selected. Enter and a loss of focus keep the new name. Escape cancels.
 */
function TabRenameInput({ tab, onCommit, onCancel }: TabRenameInputProps) {
  const [name, setName] = useState(tab.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      data-testid={`prism-tab-rename-${tab.id}`}
      aria-label="Tab name"
      className="prism-tab-rename-input"
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => onCommit(tab.id, name)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(tab.id, name);
        if (e.key === 'Escape') onCancel();
      }}
      autoFocus
    />
  );
}
