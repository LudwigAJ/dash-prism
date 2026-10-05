import { describe, it, expect, vi } from 'vitest';
import type { ClientRect, SensorContext, UniqueIdentifier } from '@dnd-kit/core';
import type { DropData, PanelEdgeDropData } from '@types';
import { makeTab } from '@store/testing';
import { describeDropTarget, dropTargetCoordinates, findDropTarget } from './keyboardDrag';

function rect(left: number, top: number, width: number, height: number): ClientRect {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function zone(edge: PanelEdgeDropData['edge'], target: ClientRect) {
  return { id: `${edge}-1`, rect: target, data: { panelId: 'p1', edge } satisfies DropData };
}

// Two panels side by side. Each tab bar is 30 px high, and the content of a panel starts at 60 px.
// The four edge zones of panel 1 cover one half of its content each, as in PanelDropzone.
const TAB_1 = { id: 'tab-1', rect: rect(0, 0, 100, 30) };
const TAB_2 = { id: 'tab-2', rect: rect(100, 0, 100, 30) };
const TAB_3 = { id: 'tab-3', rect: rect(400, 0, 100, 30) };
const TAB_4 = { id: 'tab-4', rect: rect(500, 0, 100, 30) };
const TAB_BAR_2 = {
  id: 'tab-bar-2',
  rect: rect(400, 0, 400, 30),
  data: { type: 'tab-bar', panelId: 'p2' } satisfies DropData,
};
const LEFT_1 = zone('left', rect(0, 60, 200, 400));
const RIGHT_1 = zone('right', rect(200, 60, 200, 400));
const TOP_1 = zone('top', rect(0, 60, 400, 200));
const BOTTOM_1 = zone('bottom', rect(0, 260, 400, 200));
const ALL = [TAB_1, TAB_2, TAB_3, TAB_4, TAB_BAR_2, LEFT_1, RIGHT_1, TOP_1, BOTTOM_1];

describe('findDropTarget', () => {
  it('steps to the next tab in the same tab bar', () => {
    expect(findDropTarget(TAB_1, ALL, 'right')).toBe(TAB_2);
    expect(findDropTarget(TAB_2, ALL, 'left')).toBe(TAB_1);
  });

  it('continues into the tab bar of the next panel, and its end comes after its tabs', () => {
    expect(findDropTarget(TAB_2, ALL, 'right')).toBe(TAB_3);
    expect(findDropTarget(TAB_3, ALL, 'right')).toBe(TAB_4);
    expect(findDropTarget(TAB_4, ALL, 'right')).toBe(TAB_BAR_2);
  });

  it('goes down from a tab into the nearest edge zone of its panel', () => {
    expect(findDropTarget(TAB_1, ALL, 'down')).toBe(TOP_1);
  });

  it('moves between the edge zones of a panel as between the points of a compass', () => {
    expect(findDropTarget(TOP_1, ALL, 'down')).toBe(BOTTOM_1);
    expect(findDropTarget(TOP_1, ALL, 'left')).toBe(LEFT_1);
    expect(findDropTarget(LEFT_1, ALL, 'right')).toBe(RIGHT_1);
    expect(findDropTarget(LEFT_1, ALL, 'up')).toBe(TOP_1);
    expect(findDropTarget(RIGHT_1, ALL, 'down')).toBe(BOTTOM_1);
  });

  it('puts the anchor of an edge zone near its panel edge', () => {
    // In a wide panel, the center of the left zone is to the right of this tab
    const tab = { id: 'tab', rect: rect(100, 0, 100, 30) };
    const left = zone('left', rect(0, 60, 400, 200));
    const top = zone('top', rect(0, 60, 800, 100));
    expect(findDropTarget(tab, [left, top], 'right')).toBe(top);
  });

  it('prefers a target in line to a nearer target out of line', () => {
    const farInLine = { id: 'far', rect: rect(900, 0, 100, 30) };
    const nearBelow = { id: 'near', rect: rect(150, 40, 100, 30) };
    expect(findDropTarget(TAB_1, [farInLine, nearBelow], 'right')).toBe(farInLine);
  });

  it('takes the nearest target when no target is in line', () => {
    const near = { id: 'near', rect: rect(300, 100, 50, 50) };
    const far = { id: 'far', rect: rect(300, 400, 50, 50) };
    expect(findDropTarget(TAB_1, [far, near], 'right')).toBe(near);
  });

  it('returns null when no target is in the direction', () => {
    expect(findDropTarget(TAB_1, ALL, 'left')).toBeNull();
    expect(findDropTarget(TAB_1, ALL, 'up')).toBeNull();
    expect(findDropTarget(TAB_BAR_2, ALL, 'right')).toBeNull();
    expect(findDropTarget(TAB_1, [], 'right')).toBeNull();
  });
});

// Workspaces measured in Chrome at 1920 x 1080 during a drag of the first tab of panel 1. The
// tab bar of panel 1 takes no drop from its own tab, so it is not a target.
const BAR_HEIGHT = 32.1875;

function panel(id: string, content: ClientRect) {
  const { left, top, width, height } = content;
  const zones = {
    left: rect(left, top, width / 2, height),
    right: rect(left + width / 2, top, width / 2, height),
    top: rect(left, top, width, height / 2),
    bottom: rect(left, top + height / 2, width, height / 2),
  };
  return (['left', 'right', 'top', 'bottom'] as const).map((edge) => ({
    id: `${edge}-${id}`,
    rect: zones[edge],
    data: { panelId: id, edge } satisfies DropData,
  }));
}

function tabBar(id: string, left: number, top: number, width: number) {
  return {
    id: `tab-bar-${id}`,
    rect: rect(left, top, width, BAR_HEIGHT),
    data: { type: 'tab-bar', panelId: id } satisfies DropData,
  };
}

function tab(id: string, left: number, top: number) {
  return { id, rect: rect(left, top, 93.75, BAR_HEIGHT) };
}

// Panel 1 fills the left half. Panel 2 and panel 3 share the right half, one above the other.
const THREE_PANELS = [
  tab('a', 8, 8),
  tab('b', 101.75, 8),
  tab('c', 968.5, 8),
  tab('d', 968.5, 495.5),
  tabBar('p2', 968.5, 8, 959.5),
  tabBar('p3', 968.5, 495.5, 959.5),
  ...panel('p1', rect(8, 76.578125, 959.5, 905.390625)),
  ...panel('p2', rect(968.5, 76.578125, 959.5, 417.921875)),
  ...panel('p3', rect(968.5, 564.078125, 959.5, 417.921875)),
];

// Panel 1 and panel 2 side by side
const TWO_PANELS = [
  tab('a', 8, 8),
  tab('b', 101.75, 8),
  tab('c', 968.5, 8),
  tabBar('p2', 968.5, 8, 959.5),
  ...panel('p1', rect(8, 76.578125, 959.5, 905.390625)),
  ...panel('p2', rect(968.5, 76.578125, 959.5, 905.390625)),
];

const DIRECTIONS = ['left', 'right', 'up', 'down'] as const;

function byId(targets: typeof THREE_PANELS, id: string) {
  const found = targets.find((target) => target.id === id);
  if (!found) throw new Error(`No target ${id}`);
  return found;
}

describe.each([
  { name: 'three panels', targets: THREE_PANELS },
  { name: 'two panels', targets: TWO_PANELS },
])('findDropTarget with $name', ({ targets }) => {
  it('reaches every target from the dragged tab', () => {
    const reached = new Set<UniqueIdentifier>(['a']);
    const queue: Array<Parameters<typeof findDropTarget>[0]> = [byId(targets, 'a')];
    for (let origin = queue.shift(); origin; origin = queue.shift()) {
      for (const direction of DIRECTIONS) {
        const next = findDropTarget(origin, targets, direction);
        if (next && !reached.has(next.id)) {
          reached.add(next.id);
          queue.push(next);
        }
      }
    }
    expect([...reached].sort()).toEqual(targets.map((target) => target.id).sort());
  });

  it('never moves more to the side than ahead, unless the two targets overlap', () => {
    for (const origin of targets) {
      for (const direction of DIRECTIONS) {
        const next = findDropTarget(origin, targets, direction);
        if (!next) continue;
        const isHorizontal = direction === 'left' || direction === 'right';
        const [from, to] = [origin.rect, next.rect];
        const overlaps = isHorizontal
          ? from.top < to.bottom && to.top < from.bottom
          : from.left < to.right && to.left < from.right;
        const along = isHorizontal
          ? Math.abs(to.left + to.width / 2 - (from.left + from.width / 2))
          : Math.abs(to.top + to.height / 2 - (from.top + from.height / 2));
        const across = isHorizontal
          ? Math.abs(to.top + to.height / 2 - (from.top + from.height / 2))
          : Math.abs(to.left + to.width / 2 - (from.left + from.width / 2));
        expect(overlaps || across <= along, `${origin.id} ${direction} ${next.id}`).toBe(true);
      }
    }
  });

  it('goes up from the top edge of a panel to its tabs', () => {
    expect(findDropTarget(byId(targets, 'top-p1'), targets, 'up')?.id).toBe('b');
  });

  it('stays put at the outer edges of the workspace', () => {
    expect(findDropTarget(byId(targets, 'left-p1'), targets, 'left')).toBeNull();
    expect(findDropTarget(byId(targets, 'bottom-p1'), targets, 'down')).toBeNull();
    expect(findDropTarget(byId(targets, 'right-p2'), targets, 'right')).toBeNull();
  });
});

describe('findDropTarget with three panels', () => {
  it('does not jump up from the right edge of the lower panel', () => {
    expect(findDropTarget(byId(THREE_PANELS, 'right-p3'), THREE_PANELS, 'right')).toBeNull();
  });
});

interface FakeContainer {
  id: string;
  rect: ClientRect;
  disabled?: boolean;
  data?: DropData;
}

function makeContext(containers: FakeContainer[], overId: string | null): SensorContext {
  // A partial SensorContext: the getter reads only these fields. getEnabled skips a disabled
  // droppable, as the map of dnd-kit does.
  return {
    collisionRect: rect(0, 0, 100, 30),
    droppableRects: new Map(containers.map((container) => [container.id, container.rect])),
    droppableContainers: {
      getEnabled: () =>
        containers
          .filter((container) => !container.disabled)
          .map((container) => ({ ...container, data: { current: container.data } })),
    },
    over: overId === null ? null : { id: overId },
  } as unknown as SensorContext;
}

function pressArrow(code: string, context: SensorContext) {
  const event = { code, preventDefault: vi.fn() } as unknown as KeyboardEvent;
  const coordinates = dropTargetCoordinates(event, {
    active: 'tab-1',
    currentCoordinates: { x: 0, y: 0 },
    context,
  });
  return { coordinates, event };
}

describe('dropTargetCoordinates', () => {
  it('centers the drag on the next drop target', () => {
    const context = makeContext([TAB_1, TAB_2], 'tab-1');
    expect(pressArrow('ArrowRight', context).coordinates).toEqual({ x: 100, y: 0 });
  });

  it('skips a disabled droppable, as the collision detection of a mouse drag does', () => {
    const context = makeContext([TAB_1, { ...TAB_2, disabled: true }, TAB_3], 'tab-1');
    expect(pressArrow('ArrowRight', context).coordinates).toEqual({ x: 400, y: 0 });
  });

  it('puts the anchor of a tab bar at its right end', () => {
    const bar: FakeContainer = {
      id: 'bar',
      rect: rect(100, 0, 400, 30),
      data: { type: 'tab-bar', panelId: 'p2' },
    };
    const tab = { id: 'tab', rect: rect(400, 0, 100, 30) };
    const context = makeContext([TAB_1, bar, tab], 'tab-1');
    // The center of the bar is nearer, but the tab comes first.
    expect(pressArrow('ArrowRight', context).coordinates).toEqual({ x: 400, y: 0 });
  });

  it('stops the default of an arrow key also when no target is in its direction', () => {
    const { coordinates, event } = pressArrow('ArrowLeft', makeContext([TAB_1, TAB_2], 'tab-1'));
    expect(coordinates).toBeUndefined();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('ignores a key that is not an arrow key', () => {
    const { coordinates, event } = pressArrow('KeyA', makeContext([TAB_1, TAB_2], 'tab-1'));
    expect(coordinates).toBeUndefined();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('starts from the drag itself when it is over no target', () => {
    const context = makeContext([TAB_2], null);
    expect(pressArrow('ArrowRight', context).coordinates).toEqual({ x: 100, y: 0 });
  });
});

describe('describeDropTarget', () => {
  const panelIds = ['p1', 'p2'];
  const panelTabs = { p1: ['a', 'b'], p2: ['c'] };

  it('names the edge and the panel of an edge zone', () => {
    expect(describeDropTarget({ panelId: 'p2', edge: 'right' }, panelIds, panelTabs)).toBe(
      'right edge of panel 2'
    );
  });

  it('names the position of a tab', () => {
    const data: DropData = { type: 'tab', tab: makeTab('b', 'p1'), panelId: 'p1' };
    expect(describeDropTarget(data, panelIds, panelTabs)).toBe('position 2 in panel 1');
  });

  it('names the position after the last tab for a tab bar', () => {
    const data: DropData = { type: 'tab-bar', panelId: 'p2' };
    expect(describeDropTarget(data, panelIds, panelTabs)).toBe('position 2 in panel 2');
  });
});
