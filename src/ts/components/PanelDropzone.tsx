import React from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import type { PanelId } from '@types';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { getLeafPanelIds } from '@utils/panels';

type PanelDropzoneProps = {
  panelId: PanelId;
  children: React.ReactNode;
  /** When true, disable all edge dropzones (no splits allowed) */
  isPinned?: boolean;
};

export function PanelDropzone({ panelId, children, isPinned = false }: PanelDropzoneProps) {
  const { active } = useDndContext();
  const { state } = usePrism();
  const { maxPanels } = useConfig();
  const isActive = !!active;

  // Check if we're in single-tab-single-panel mode (no DnD operations allowed)
  const leafPanelIds = getLeafPanelIds(state.panel);
  const tabCount = state.tabs?.length ?? 0;
  const isSingleTabMode = tabCount === 1 && leafPanelIds.length === 1;

  // Edge zones split the panel, so they are off once the maxPanels limit is reached
  const isMaxPanelsReached = maxPanels >= 1 && leafPanelIds.length >= maxPanels;

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
