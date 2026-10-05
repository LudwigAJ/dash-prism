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
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useConfig } from '@context/ConfigContext';
import { getTabIcon } from '@constants/tab-icons';
import { tabStyleVariants, migrateTabStyle } from '@constants/tab-styles';
import { cn } from '@utils/cn';
import type { Tab, DropData } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectIsSingleTabMode,
  selectPanelTabs,
  splitPanel,
  moveTab,
  reorderTab,
} from '@store';

interface DndProviderProps {
  children: React.ReactNode;
}

export function DndProvider({ children }: DndProviderProps) {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const panelTabs = useAppSelector(selectPanelTabs);
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
    // Enter only selects a focused tab. Space selects it and picks it up for a keyboard drag.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    })
  );

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

      dispatch(
        splitPanel({
          panelId: dropData.panelId,
          direction,
          tabId: activeId,
          position,
        })
      );
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
