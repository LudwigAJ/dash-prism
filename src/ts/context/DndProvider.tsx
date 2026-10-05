import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  type Active,
  type Announcements,
  type DragStartEvent,
  type DragEndEvent,
  type Over,
} from '@dnd-kit/core';
import { useConfig } from '@context/ConfigContext';
import { DRAG_KEYS } from '@constants/shortcuts';
import { getTabIcon } from '@constants/tab-icons';
import { tabStyleVariants, migrateTabStyle } from '@constants/tab-styles';
import { cn } from '@utils/cn';
import { describeDropTarget, dropTargetCoordinates } from '@utils/keyboardDrag';
import { getLeafPanelIds } from '@utils/panels';
import type { Tab, TabId, DropData, TabDragData } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectIsSingleTabMode,
  selectPanel,
  selectPanelTabs,
  splitPanel,
  moveTab,
  reorderTab,
} from '@store';

interface DndProviderProps {
  children: React.ReactNode;
}

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'To move the tab, press Space. Then use the arrow keys to go to a drop target. ' +
    'Press Enter or Space to drop the tab. Press Escape to cancel.',
};

function tabName(active: Active): string {
  // dnd-kit types the data of a draggable as a plain record. Each draggable of Prism sets a
  // TabDragData, but dnd-kit puts an empty record in its place when the tab unmounts during a drag.
  const data = active.data.current as Partial<TabDragData> | undefined;
  return data?.tab?.name ?? String(active.id);
}

/**
 * Puts the focus on the trigger of a tab when the tab is in the DOM. After a split, the split pane
 * renders the new panels some frames later, and the search bar of a new panel takes the focus in
 * its first effects. So the focus moves one frame after the trigger shows.
 */
function focusTabTrigger(root: Element, tabId: TabId, framesLeft = 10): void {
  requestAnimationFrame(() => {
    const trigger = root.querySelector<HTMLElement>(
      `[data-testid="prism-tab-${tabId}"] [role="tab"]`
    );
    if (trigger) {
      requestAnimationFrame(() => trigger.focus());
    } else if (framesLeft > 0) {
      focusTabTrigger(root, tabId, framesLeft - 1);
    }
  });
}

export function DndProvider({ children }: DndProviderProps) {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const panelTabs = useAppSelector(selectPanelTabs);
  const panelIds = getLeafPanelIds(useAppSelector(selectPanel));
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  // Single-tab-single-panel mode allows no DnD operations
  const isSingleTabMode = useAppSelector(selectIsSingleTabMode);

  // Configure sensors (pointer + mouse fallback + keyboard for accessibility)
  // MouseSensor added as fallback for headless Chrome where PointerEvents may not fire reliably
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start drag after 8px movement
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Same constraint for Selenium ActionChains compatibility
      },
    }),
    // Enter only selects a focused tab. Space picks it up, and the arrow keys move it from one
    // drop target to the next.
    useSensor(KeyboardSensor, {
      coordinateGetter: dropTargetCoordinates,
      keyboardCodes: {
        start: DRAG_KEYS.pickUp.codes,
        cancel: DRAG_KEYS.cancel.codes,
        end: DRAG_KEYS.drop.codes,
      },
    })
  );

  // Each droppable of Prism sets a DropData, as in handleDragEnd
  const describeOver = (over: Over | null) =>
    over?.data.current
      ? describeDropTarget(over.data.current as DropData, panelIds, panelTabs)
      : 'none';

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `You picked up tab ${tabName(active)}. Use the arrow keys to move it.`,
    onDragOver: ({ active, over }) => `Tab ${tabName(active)}. Drop target: ${describeOver(over)}.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `You dropped tab ${tabName(active)}. Drop target: ${describeOver(over)}.`
        : `You dropped tab ${tabName(active)}. The tab did not move.`,
    onDragCancel: ({ active }) => `You cancelled the drag. Tab ${tabName(active)} did not move.`,
  };

  // ===== EVENT HANDLERS =====

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const tab = tabs.find((t) => t.id === active.id);

    if (tab?.locked) {
      // Don't allow dragging locked tabs
      return;
    }

    // In single-tab mode, still allow drag start but will no-op on drop
    setActiveTab(tab ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveTab(null);

    // Single-tab mode: no-op, tab returns to origin
    if (isSingleTabMode) {
      return;
    }

    if (!over || !activeTab) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // dnd-kit types the data of a droppable as a plain record. Each droppable of Prism sets a
    // DropData.
    const dropData = over.data.current as DropData | undefined;

    // Case 1: Dropped on a panel edge drop zone (split)
    if (dropData && 'edge' in dropData) {
      const { edge } = dropData;
      const direction = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
      // 'before' = left/top (new panel first), 'after' = right/bottom (new panel second)
      const position = edge === 'left' || edge === 'top' ? 'before' : 'after';

      const split = dispatch(
        splitPanel({
          panelId: dropData.panelId,
          direction,
          tabId: activeId,
          position,
        })
      );
      // The moved tab mounts in its new panel after the focus restore of dnd-kit. So after a
      // keyboard drop, this handler gives the focus back to the moved tab, as after the other
      // drops. A mouse drop keeps the focus where the new panel puts it.
      const trigger = event.activatorEvent?.target;
      const root = trigger instanceof Element ? trigger.closest('.prism-root') : null;
      if (event.activatorEvent instanceof KeyboardEvent && root) {
        void split.then(() => {
          focusTabTrigger(root, activeId);
        });
      }
      return;
    }

    // Case 2: Dropped on the tab bar of a panel (cross-panel move)
    if (dropData?.type === 'tab-bar') {
      const targetPanelId = dropData.panelId;
      if (activeTab.panelId !== targetPanelId) {
        dispatch(moveTab({ tabId: activeId, targetPanelId }));
      }
      return;
    }

    // Case 3: Dropped on another tab (reorder within panel or cross-panel)
    const overTab = tabs.find((t) => t.id === overId);
    if (!overTab) return;

    if (activeTab.panelId === overTab.panelId) {
      // Same panel: reorder
      const panelTabIds = panelTabs[activeTab.panelId] || [];
      const oldIndex = panelTabIds.indexOf(activeId);
      const newIndex = panelTabIds.indexOf(overId);

      if (oldIndex !== newIndex) {
        dispatch(
          reorderTab({
            panelId: activeTab.panelId,
            fromIndex: oldIndex,
            toIndex: newIndex,
          })
        );
      }
    } else {
      // Different panel: move to target panel at drop position
      const targetPanelTabIds = panelTabs[overTab.panelId] || [];
      const targetIndex = targetPanelTabIds.indexOf(overId);

      dispatch(
        moveTab({
          tabId: activeId,
          targetPanelId: overTab.panelId,
          targetIndex: targetIndex >= 0 ? targetIndex : undefined,
        })
      );
    }
  };

  const handleDragCancel = () => {
    setActiveTab(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
    >
      {children}

      {/* Drag overlay - renders the dragged tab preview */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeTab && <DraggedTabPreview tab={activeTab} />}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * Renders a styled preview of the tab being dragged.
 * Matches the tab's icon and style for visual consistency.
 */
function DraggedTabPreview({ tab }: { tab: Tab }) {
  const { theme } = useConfig();
  const IconComponent = tab.icon ? getTabIcon(tab.icon) : null;
  const styleColor = migrateTabStyle(tab.style);
  const styleClasses = tabStyleVariants({ color: styleColor, theme });

  return (
    <div
      className={cn(
        'tw:flex tw:cursor-grabbing tw:items-center tw:gap-2 tw:rounded-sm tw:border tw:border-border tw:bg-card tw:px-3 tw:py-1.5 tw:shadow-lg',
        'tw:opacity-80',
        styleClasses
      )}
    >
      {IconComponent && <IconComponent className="tw:h-3.5 tw:w-3.5" />}
      <span className="tw:text-sm tw:font-medium">{tab.name}</span>
    </div>
  );
}
