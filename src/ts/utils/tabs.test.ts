import { describe, it, expect } from 'vitest';
import type { LayoutMeta, Tab } from '@types';
import { createTab, findOpenTabForLayout, NEW_TAB_NAME } from './tabs';

function tab(id: string, layoutId?: string): Tab {
  return { id, name: id, panelId: 'p1', createdAt: 1, layoutId };
}

const tabs = [tab('t1'), tab('t2', 'report'), tab('t3', 'report')];

describe('findOpenTabForLayout', () => {
  it('returns the first open tab of a layout that does not allow multiple tabs', () => {
    expect(findOpenTabForLayout(tabs, 'report', { name: 'Report' })?.id).toBe('t2');
    expect(findOpenTabForLayout(tabs, 'report', { name: 'Report', allowMultiple: false })?.id).toBe(
      't2'
    );
  });

  it('returns undefined when the layout allows multiple tabs', () => {
    const layout: LayoutMeta = { name: 'Report', allowMultiple: true };
    expect(findOpenTabForLayout(tabs, 'report', layout)).toBeUndefined();
  });

  it('returns undefined when no tab shows the layout', () => {
    expect(findOpenTabForLayout(tabs, 'other', { name: 'Other' })).toBeUndefined();
  });
});

describe('createTab', () => {
  it('builds a blank tab with the default name in the panel', () => {
    const created = createTab('p1');
    expect(created.name).toBe(NEW_TAB_NAME);
    expect(created.panelId).toBe('p1');
    expect(created.id).toBeTruthy();
    expect(created.mountKey).toBeTruthy();
  });

  it('keeps the default name when the name field is undefined', () => {
    expect(createTab('p1', { name: undefined, layoutId: 'report' }).name).toBe(NEW_TAB_NAME);
  });

  it('gives a copy fresh ids and the target panel', () => {
    const original: Tab = { ...tab('t1', 'report'), mountKey: 'm1', createdAt: 1 };
    const copy = createTab('p2', original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.mountKey).not.toBe(original.mountKey);
    expect(copy.panelId).toBe('p2');
    expect(copy.layoutId).toBe('report');
  });
});
