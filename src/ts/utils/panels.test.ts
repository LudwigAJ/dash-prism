import { describe, it, expect } from 'vitest';
import type { PanelNode } from '@types';
import { countLeafPanels, removePanelFromTree, splitPanel } from './panels';

function leaf(id: string, order: 0 | 1 = 0): PanelNode {
  return { id, order, direction: 'horizontal', children: [], size: '50%' };
}

function twoPanelTree(): PanelNode {
  return {
    id: 'root',
    order: 0,
    direction: 'horizontal',
    children: [leaf('a', 0), leaf('b', 1)],
    size: '100%',
  };
}

describe('splitPanel', () => {
  it('turns a leaf into a container and returns the id of the new sibling', () => {
    const root = leaf('a');

    const newPanelId = splitPanel(root, { panelId: 'a', direction: 'vertical', position: 'after' });

    expect(root.children.map((child) => child.id)).toEqual(['a', newPanelId]);
    expect(root.direction).toBe('vertical');
    expect(countLeafPanels(root)).toBe(2);
  });

  it('puts the new sibling first for position before', () => {
    const root = leaf('a');

    const newPanelId = splitPanel(root, {
      panelId: 'a',
      direction: 'horizontal',
      position: 'before',
    });

    expect(root.children.map((child) => child.id)).toEqual([newPanelId, 'a']);
  });

  it('throws for a panel that is not in the tree and leaves the tree unchanged', () => {
    const root = twoPanelTree();

    expect(() =>
      splitPanel(root, { panelId: 'missing', direction: 'horizontal', position: 'after' })
    ).toThrow("Panel 'missing' not found");
    expect(root).toEqual(twoPanelTree());
  });

  it('throws for a panel that is not a leaf and leaves the tree unchanged', () => {
    const root = twoPanelTree();

    expect(() =>
      splitPanel(root, { panelId: 'root', direction: 'horizontal', position: 'after' })
    ).toThrow("Panel 'root' is not a leaf panel");
    expect(root).toEqual(twoPanelTree());
  });
});

describe('removePanelFromTree', () => {
  it('removes a leaf and lets the surviving sibling replace the root', () => {
    const root = twoPanelTree();

    expect(removePanelFromTree(root, 'a')).toBe(true);

    expect(root.id).toBe('b');
    expect(root.children).toEqual([]);
  });

  it('returns false and changes nothing for an unknown panel', () => {
    const root = twoPanelTree();

    expect(removePanelFromTree(root, 'missing')).toBe(false);
    expect(root).toEqual(twoPanelTree());
  });

  it('returns false and changes nothing for a container panel', () => {
    const root: PanelNode = {
      id: 'root',
      order: 0,
      direction: 'horizontal',
      children: [leaf('a', 0), { ...twoPanelTree(), id: 'inner', order: 1, size: '50%' }],
      size: '100%',
    };
    const before = structuredClone(root);

    expect(removePanelFromTree(root, 'inner')).toBe(false);
    expect(root).toEqual(before);
  });
});
