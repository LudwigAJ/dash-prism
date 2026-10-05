import type { ClientRect, KeyboardCoordinateGetter, UniqueIdentifier } from '@dnd-kit/core';
import { ARROW_DIRECTIONS, type Direction } from '@constants/shortcuts';
import type { DropData, PanelId, TabId } from '@types';

/** Holds a drop target as the keyboard drag compares it with the other targets. */
interface DropTarget {
  id: UniqueIdentifier;
  rect: ClientRect;
  data?: DropData;
}

// The four edge zones of a panel touch at the center lines of the panel. A zone that only touches
// the anchor of the origin is not in line with it.
const SPAN_MARGIN = 1;

function anchorOf({ rect, data }: DropTarget): { x: number; y: number } {
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  if (data && 'edge' in data) {
    // An edge zone covers one half of its panel, but a drop there adds a panel at that edge. So
    // the anchor of the zone is near that edge.
    const { edge } = data;
    if (edge === 'left') return { ...center, x: rect.left + rect.width / 4 };
    if (edge === 'right') return { ...center, x: rect.right - rect.width / 4 };
    if (edge === 'top') return { ...center, y: rect.top + rect.height / 4 };
    return { ...center, y: rect.bottom - rect.height / 4 };
  }
  // A drop on a tab bar puts the tab after the last tab, so the anchor of the bar is at its right
  // end, after its tabs.
  if (data?.type === 'tab-bar') return { ...center, x: rect.right - rect.height / 2 };
  return center;
}

function isEdgeZone({ data }: DropTarget): boolean {
  return data !== undefined && 'edge' in data;
}

/** Tells if `position` is inside the span of `rect` across the direction, away from its ends. */
function isInSpan(position: number, rect: ClientRect, isHorizontal: boolean): boolean {
  const start = isHorizontal ? rect.top : rect.left;
  const end = isHorizontal ? rect.bottom : rect.right;
  return position > start + SPAN_MARGIN && position < end - SPAN_MARGIN;
}

/**
 * Finds the drop target that an arrow key moves the drag to, or null when no target is in that
 * direction.
 *
 * The anchor of a tab is its center. The anchor of an edge zone is near its panel edge, and the
 * anchor of a tab bar is at its right end. A target is in the direction when its anchor is past
 * the anchor of `origin`. A target is in line when the anchor of `origin` is inside the span of
 * the target across the direction. A tab or a tab bar is also in line when its anchor is inside
 * the span of `origin`, so Up from a top edge goes to the tabs of that panel. The nearest target
 * in line wins. When no target is in line, the nearest target within 45 degrees of the direction
 * wins, by the sum of the distances along and across the direction.
 *
 * @param origin The current drop target.
 * @param targets The drop targets that the drag can reach.
 * @param direction The direction of the arrow key.
 */
export function findDropTarget(
  origin: DropTarget,
  targets: readonly DropTarget[],
  direction: Direction
): DropTarget | null {
  const from = anchorOf(origin);
  const isHorizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;
  const ranked = targets.flatMap((target) => {
    const to = anchorOf(target);
    const along = sign * (isHorizontal ? to.x - from.x : to.y - from.y);
    if (along <= 0) return [];
    const across = Math.abs(isHorizontal ? to.y - from.y : to.x - from.x);
    const inLine =
      isInSpan(isHorizontal ? from.y : from.x, target.rect, isHorizontal) ||
      (!isEdgeZone(target) && isInSpan(isHorizontal ? to.y : to.x, origin.rect, isHorizontal));
    // A key must not move the drag more to the side than in its own direction
    if (!inLine && across > along) return [];
    return [{ target, inLine, distance: inLine ? along : along + across, across }];
  });
  ranked.sort(
    (a, b) => Number(b.inLine) - Number(a.inLine) || a.distance - b.distance || a.across - b.across
  );
  return ranked[0]?.target ?? null;
}

/**
 * Moves a keyboard drag to the next drop target in the direction of the arrow key. The drag lands
 * on the center of the target, so the `closestCenter` collision detection picks that target.
 */
export const dropTargetCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const direction = ARROW_DIRECTIONS[event.code];
  const { collisionRect, droppableRects, droppableContainers, over } = context;
  if (!direction || !collisionRect) return undefined;
  // The arrow key must not scroll the page, also when no target is in its direction
  event.preventDefault();

  // Collision detection skips a disabled droppable. So the keys reach only the targets that a
  // mouse drag reaches, and the drop rules of the mouse apply.
  const targets = droppableContainers.getEnabled().flatMap((container) => {
    const rect = droppableRects.get(container.id);
    // dnd-kit types the data of a droppable as a plain record. Each droppable of Prism sets a
    // DropData.
    const data = container.data.current as DropData | undefined;
    return rect ? [{ id: container.id, rect, data }] : [];
  });
  const origin = targets.find((target) => target.id === over?.id) ?? {
    id: 'drag',
    rect: collisionRect,
  };
  const target = findDropTarget(origin, targets, direction);
  if (!target) return undefined;
  return {
    x: target.rect.left + (target.rect.width - collisionRect.width) / 2,
    y: target.rect.top + (target.rect.height - collisionRect.height) / 2,
  };
};

/**
 * Names a drop target for a screen reader: `position 2 in panel 1` or `right edge of panel 2`.
 * The panels count from 1 in the order of `panelIds`.
 *
 * @param data The data of the droppable.
 * @param panelIds The IDs of the leaf panels, in the order of the panel tree.
 * @param panelTabs The tab IDs of each panel, in their order.
 */
export function describeDropTarget(
  data: DropData,
  panelIds: readonly PanelId[],
  panelTabs: Record<PanelId, TabId[]>
): string {
  const panel = `panel ${panelIds.indexOf(data.panelId) + 1}`;
  if ('edge' in data) return `${data.edge} edge of ${panel}`;
  const tabIds = panelTabs[data.panelId] ?? [];
  // A drop on a tab puts the dragged tab at the index of that tab
  const position = data.type === 'tab-bar' ? tabIds.length + 1 : tabIds.indexOf(data.tab.id) + 1;
  return `position ${position} in ${panel}`;
}
