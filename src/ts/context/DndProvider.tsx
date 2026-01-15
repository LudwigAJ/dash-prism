import React, { useState, useMemo } from 'react';
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
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { getLeafPanelIds } from '@utils/panels';
import { getTabIcon } from '@constants/tab-icons';
import { TAB_STYLE_VARIANTS } from '@constants/tab-styles';
import { cn } from '@utils/cn';
import type { Tab } from '../types';

type DndProviderProps = {
  children: React.ReactNode;
};

export function DndProvider({ children }: DndProviderProps) {
  const { state, dispatch } = usePrism();
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [overPanelId, setOverPanelId] = useState<string | null>(null);

  // Check if we're in single-tab-single-panel mode (no DnD operations allowed)
  const isSingleTabMode = useMemo(() => {
    const leafPanelIds = getLeafPanelIds(state.panel);
    const tabCount = state.tabs?.length ?? 0;
    return tabCount === 1 && leafPanelIds.length === 1;
  }, [state.tabs?.length, state.panel]);

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
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ===== EVENT HANDLERS =====

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const tab = state.tabs?.find((t) => t.id === active.id);

    if (tab?.locked) {
      // Don't allow dragging locked tabs
      return;
    }

    // In single-tab mode, still allow drag start but will no-op on drop
    setActiveTab(tab ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    // In single-tab mode, no visual feedback
    if (isSingleTabMode) {
      setOverPanelId(null);
      return;
    }

    if (!over) {
      setOverPanelId(null);
      return;
    }

    // Check if over a panel drop zone
    const overId = String(over.id);
    if (overId.startsWith('panel-drop-')) {
      setOverPanelId(overId.replace('panel-drop-', ''));
    } else {
      // Over a tab - find its panel
      const overTab = state.tabs?.find((t) => t.id === overId);
      setOverPanelId(overTab?.panelId ?? null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveTab(null);
    setOverPanelId(null);

    // Single-tab mode: no-op, tab returns to origin
    if (isSingleTabMode) {
      return;
    }

    if (!over || !activeTab) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Case 1: Dropped on a panel drop zone (cross-panel move or split)
    // Use data object from droppable instead of parsing string ID
    const dropData = over.data.current as
      | { panelId?: string; edge?: string; type?: string }
      | undefined;

    if (dropData?.edge) {
      const { edge, panelId: targetPanelId } = dropData;

      if (edge && edge !== 'center' && targetPanelId) {
        // Edge drop → SPLIT_PANEL
        const direction = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
        // 'before' = left/top (new panel first), 'after' = right/bottom (new panel second)
        const position = edge === 'left' || edge === 'top' ? 'before' : 'after';

        dispatch({
          type: 'SPLIT_PANEL',
          payload: {
            panelId: targetPanelId,
            direction,
            tabId: activeId,
            position,
          },
        });
      }
      return;
    }

    // Case 2: Dropped on TabBar/SearchBar drop zone (cross-panel move)
    // Use data object instead of regex matching
    if (dropData?.type === 'searchbar' && dropData.panelId) {
      const targetPanelId = dropData.panelId;
      if (activeTab.panelId !== targetPanelId) {
        dispatch({
          type: 'MOVE_TAB',
          payload: { tabId: activeId, targetPanelId },
        });
      }
      return;
    }

    // Case 3: Dropped on another tab (reorder within panel or cross-panel)
    const overTab = state.tabs?.find((t) => t.id === overId);
    if (!overTab) return;

    if (activeTab.panelId === overTab.panelId) {
      // Same panel: reorder
      const panelTabIds = state.panelTabs[activeTab.panelId] || [];
      const oldIndex = panelTabIds.indexOf(activeId);
      const newIndex = panelTabIds.indexOf(overId);

      if (oldIndex !== newIndex) {
        dispatch({
          type: 'REORDER_TAB',
          payload: {
            panelId: activeTab.panelId,
            fromIndex: oldIndex,
            toIndex: newIndex,
          },
        });
      }
    } else {
      // Different panel: move to target panel at drop position
      const targetPanelTabIds = state.panelTabs[overTab.panelId] || [];
      const targetIndex = targetPanelTabIds.indexOf(overId);

      dispatch({
        type: 'MOVE_TAB',
        payload: {
          tabId: activeId,
          targetPanelId: overTab.panelId,
          targetIndex: targetIndex >= 0 ? targetIndex : undefined,
        },
      });
    }
  };

  const handleDragCancel = () => {
    setActiveTab(null);
    setOverPanelId(null);
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
      onDragOver={handleDragOver}
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
  // Safely check if style exists in TAB_STYLE_VARIANTS before accessing
  const styleVariant =
    tab.style && tab.style in TAB_STYLE_VARIANTS
      ? TAB_STYLE_VARIANTS[tab.style as keyof typeof TAB_STYLE_VARIANTS]
      : null;
  const styleClasses = styleVariant ? styleVariant[theme === 'dark' ? 'dark' : 'light'] : '';

  return (
    <div
      className={cn(
        'bg-surface border-border flex cursor-grabbing items-center gap-2 rounded-sm border px-3 py-1.5 shadow-lg',
        'opacity-80',
        styleClasses
      )}
    >
      {IconComponent && <IconComponent className="h-3.5 w-3.5" />}
      <span className="text-sm font-medium">{tab.name}</span>
    </div>
  );
}
