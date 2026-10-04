import React, { memo, useCallback } from 'react';
import { Plus, Columns2 } from 'lucide-react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { TabsList, Tooltip, TooltipContent, TooltipTrigger } from '@components/ui';
import { useConfig } from '@context/ConfigContext';
import type { Tab, TabId, PanelId } from '@types';
import { cn } from '@utils/cn';
import {
  useAppDispatch,
  useAppSelector,
  selectTabCount,
  selectPanelCount,
  addTab,
  splitPanel,
  canAddTab,
  canAddPanel,
} from '@store';
import { TabItem } from './TabItem';
import { useScrollIndicators } from './useScrollIndicators';
import { useTabRename } from './useTabRename';

/** Holds the props of `TabBar`. */
interface TabBarProps {
  panelId: PanelId;
  /** The tabs of the panel, in their order. */
  tabs: Tab[];
  activeTabId: TabId | null;
  /** Whether the panel is pinned. A pinned panel has no add button and no split button. */
  isPinned?: boolean;
  /** Whether the panel is the active panel. */
  isActive?: boolean;
}

/**
 * Renders the tab bar of a panel: the sortable tabs, the add button and the split button. The
 * tab bar is also the drop target for a tab that the user drags from another panel.
 */
export const TabBar = memo(function TabBar({
  panelId,
  tabs,
  activeTabId,
  isPinned = false,
  isActive = false,
}: TabBarProps) {
  const dispatch = useAppDispatch();
  const tabCount = useAppSelector(selectTabCount);
  const panelCount = useAppSelector(selectPanelCount);
  const { maxTabs, maxPanels } = useConfig();
  const isMaxTabsReached = !canAddTab(tabCount, maxTabs);
  const isMaxPanelsReached = !canAddPanel(panelCount, maxPanels);
  const { editingTabId, startRename, commitRename, cancelRename } = useTabRename(tabs, isPinned);
  const { scrollContainerRef, canScrollLeft, canScrollRight } = useScrollIndicators(tabs.length);

  // A pinned panel takes no tabs, and a tab from this panel is already here
  const { active } = useDndContext();
  const isDraggingFromOtherPanel =
    active?.data.current?.type === 'tab' && active.data.current.panelId !== panelId && !isPinned;
  const { setNodeRef, isOver } = useDroppable({
    id: `tab-bar-drop-${panelId}`,
    data: { panelId, type: 'tab-bar' },
    disabled: !isDraggingFromOtherPanel,
  });

  const handleAddTab = useCallback(() => {
    if (isMaxTabsReached) return;
    dispatch(addTab({ panelId }));
  }, [isMaxTabsReached, panelId, dispatch]);

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

  return (
    <div
      ref={setNodeRef}
      className="prism-tab-bar tw:relative tw:flex tw:w-full tw:shrink-0 tw:items-stretch tw:border-border"
    >
      {isOver && (
        <div className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-10 tw:bg-primary/15" />
      )}
      {/* The tabs and the add button scroll together. The scroll bar is hidden. */}
      <div
        ref={scrollContainerRef}
        className="prism-tab-bar-scroll prism-scroll-bar-none tw:flex tw:min-w-0 tw:flex-1 tw:items-stretch tw:overflow-x-scroll tw:overflow-y-hidden"
        data-can-scroll-left={canScrollLeft || undefined}
        data-can-scroll-right={canScrollRight || undefined}
      >
        {/* TabsList gives the keyboard navigation and the ARIA roles of a tab list */}
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <TabsList
            className={cn(
              'tw:flex-nowrap tw:gap-0 tw:rounded-none tw:bg-transparent tw:p-0',
              isPinned && 'tw:flex-1'
            )}
          >
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isPinned={isPinned}
                isActiveTab={tab.id === activeTabId}
                isPanelActive={isActive}
                isEditing={tab.id === editingTabId}
                onStartRename={startRename}
                onCommitRename={commitRename}
                onCancelRename={cancelRename}
              />
            ))}
          </TabsList>
        </SortableContext>

        {!isPinned && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-testid="prism-tab-bar-add-button"
                aria-label="New tab"
                className="prism-tab-bar-add"
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
            className="tw:h-full tw:min-w-8 tw:flex-1 tw:cursor-pointer"
            onDoubleClick={handleAddTab}
            title="Double-click to add new tab"
          />
        )}
      </div>
      {!isPinned && isActive && !isMaxPanelsReached && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              data-testid="prism-tab-bar-split-button"
              aria-label="Split panel"
              className="prism-tab-bar-split"
              onClick={handleSplitPanel}
              disabled={isMaxTabsReached}
            >
              <Columns2 />
            </button>
          </TooltipTrigger>
          <TooltipContent>{isMaxTabsReached ? 'Max tabs reached' : 'Split panel'}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
