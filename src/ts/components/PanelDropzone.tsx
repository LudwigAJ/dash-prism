import React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import type { PanelId } from '@types';
import { useConfig } from '@context/ConfigContext';
import { useAppSelector, selectIsSingleTabMode, selectPanelCount, canAddPanel } from '@store';

interface PanelDropzoneProps {
  panelId: PanelId;
  children: React.ReactNode;
  /** When true, disable all edge dropzones (no splits allowed) */
  isPinned?: boolean;
}

/**
 * Wraps the content of a leaf panel with four edge drop zones. A tab that the user drops on an
 * edge splits the panel on that side. The zones show only during a drag, and only when the panel
 * can split.
 */
export function PanelDropzone({ panelId, children, isPinned = false }: PanelDropzoneProps) {
  const { active } = useDndContext();
  const { maxPanels } = useConfig();
  const isSingleTabMode = useAppSelector(selectIsSingleTabMode);
  const panelCount = useAppSelector(selectPanelCount);
  const isActive = !!active;

  // Edge zones split the panel, so they are off once the maxPanels limit is reached
  const isMaxPanelsReached = !canAddPanel(panelCount, maxPanels);

  // Disable dropzones entirely for pinned panels, single-tab mode, or at the panel limit
  const dropzonesEnabled = isActive && !isPinned && !isSingleTabMode && !isMaxPanelsReached;

  // Create 4 separate droppable zones: left, right, top, bottom
  const leftZone = useDroppable({
    id: `panel-drop-left-${panelId}`,
    data: { panelId, edge: 'left' },
    disabled: !dropzonesEnabled,
  });

  const rightZone = useDroppable({
    id: `panel-drop-right-${panelId}`,
    data: { panelId, edge: 'right' },
    disabled: !dropzonesEnabled,
  });

  const topZone = useDroppable({
    id: `panel-drop-top-${panelId}`,
    data: { panelId, edge: 'top' },
    disabled: !dropzonesEnabled,
  });

  const bottomZone = useDroppable({
    id: `panel-drop-bottom-${panelId}`,
    data: { panelId, edge: 'bottom' },
    disabled: !dropzonesEnabled,
  });

  return (
    <div className="tw:relative tw:h-full tw:w-full tw:overflow-auto">
      {children}

      {/* Drop zones - only interactive when dragging and panel is not pinned */}
      {dropzonesEnabled && (
        <>
          {/* Left */}
          <div
            ref={leftZone.setNodeRef}
            data-testid={`prism-drop-zone-left-${panelId}`}
            className="tw:absolute tw:top-0 tw:bottom-0 tw:left-0 tw:z-50 tw:w-1/2"
          >
            {leftZone.isOver && <div className="tw:absolute tw:inset-0 tw:bg-primary/15" />}
          </div>

          {/* Right */}
          <div
            ref={rightZone.setNodeRef}
            data-testid={`prism-drop-zone-right-${panelId}`}
            className="tw:absolute tw:top-0 tw:right-0 tw:bottom-0 tw:z-50 tw:w-1/2"
          >
            {rightZone.isOver && <div className="tw:absolute tw:inset-0 tw:bg-primary/15" />}
          </div>

          {/* Top */}
          <div
            ref={topZone.setNodeRef}
            data-testid={`prism-drop-zone-top-${panelId}`}
            className="tw:absolute tw:top-0 tw:right-0 tw:left-0 tw:z-50 tw:h-1/2"
          >
            {topZone.isOver && <div className="tw:absolute tw:inset-0 tw:bg-primary/15" />}
          </div>

          {/* Bottom */}
          <div
            ref={bottomZone.setNodeRef}
            data-testid={`prism-drop-zone-bottom-${panelId}`}
            className="tw:absolute tw:right-0 tw:bottom-0 tw:left-0 tw:z-50 tw:h-1/2"
          >
            {bottomZone.isOver && <div className="tw:absolute tw:inset-0 tw:bg-primary/15" />}
          </div>
        </>
      )}
    </div>
  );
}
