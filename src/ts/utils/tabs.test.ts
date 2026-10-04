import { describe, it, expect } from 'vitest';
import type { LayoutMeta, Tab } from '@types';
import { findOpenTabForLayout } from './tabs';

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
