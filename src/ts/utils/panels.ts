import type { PanelNode, PanelId, PanelDirection } from '@types';
import { generateShortId } from '@utils/uuid';

// The reducers pass immer drafts. A draft of a PanelNode has the same fields, so `PanelNode`
// takes it, and a function can change the draft in place.

// Query Functions (Read-only)

/**
 * Checks if a panel is a leaf panel (can hold tabs)
 */
export function isLeafPanel(root: PanelNode): boolean {
  return root.children.length === 0;
}

/**
 * Gets all leaf panel IDs from a panel tree (recursive)
 */
export function getLeafPanelIds(root: PanelNode): PanelId[] {
  if (!root || !root.children) return [];
  if (isLeafPanel(root)) return [root.id];
  return root.children.flatMap((child) => getLeafPanelIds(child));
}

/**
 * Counts total number of leaf panels in a tree
 */
export function countLeafPanels(root: PanelNode): number {
  return getLeafPanelIds(root).length;
}

/**
 * Finds a panel by ID in the tree (recursive)
 */
export function findPanelById(root: PanelNode, panelId: PanelId): PanelNode | null {
  if (root.id === panelId) return root;

  for (const child of root.children) {
    const found = findPanelById(child, panelId);
    if (found) return found;
  }

  return null;
}

/**
 * Finds parent panel with index (useful for splicing in mutations)
 */
function findParentPanelWithIndex(
  root: PanelNode,
  panelId: PanelId
): { parent: PanelNode; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === panelId) {
      return { parent: root, index: i };
    }
    const found = findParentPanelWithIndex(root.children[i], panelId);
    if (found) return found;
  }
  return null;
}

// Mutation Functions (In-place, for use inside produce() blocks)

/**
 * Updates a panel in the tree by ID (in-place mutation)
 */
export function updatePanelInTree(
  root: PanelNode,
  panelId: PanelId,
  updater: (p: PanelNode) => void
): boolean {
  if (root.id === panelId) {
    updater(root);
    return true;
  }
  for (const child of root.children) {
    if (updatePanelInTree(child, panelId, updater)) {
      return true;
    }
  }
  return false;
}

/**
 * Removes a leaf panel from the tree with bubble-up behavior (in-place)
 * If parent has only one child after removal, child replaces parent
 *
 * Returns a boolean and does not throw, because the panel ID can come from a state that Dash
 * or the browser storage provided. A caller treats false as "nothing to remove". A throw would
 * make a reducer fail on corrupt input.
 *
 * @returns true if the panel was removed, false if the panel is not in the tree or is a container
 */
export function removePanelFromTree(root: PanelNode, panelId: PanelId): boolean {
  const result = findParentPanelWithIndex(root, panelId);
  if (!result) return false;
  if (!isLeafPanel(result.parent.children[result.index])) return false;

  const { parent, index } = result;
  parent.children.splice(index, 1);

  // If parent now has only one child, that child bubbles up
  if (parent.children.length === 1) {
    const survivor = parent.children[0];

    // Find grandparent to replace parent with survivor
    const grandparentResult = findParentPanelWithIndex(root, parent.id);
    if (grandparentResult) {
      grandparentResult.parent.children[grandparentResult.index] = survivor;
    } else if (root.id === parent.id) {
      // Parent IS the root - survivor becomes the new root
      root.id = survivor.id;
      root.order = survivor.order;
      root.direction = survivor.direction;
      root.children = survivor.children;
      root.size = survivor.size;
      root.pinned = survivor.pinned;
    }
  }

  return true;
}

// Complex Panel Operations (Panel Tree Transformations)

/**
 * Splits a leaf panel into a container with two children.
 *
 * This transforms a leaf panel at the given location into a container panel
 * with two children: the original panel (keeping its ID) and a new sibling panel.
 * The original panel ID is preserved to avoid triggering React re-renders of tabs.
 *
 * @param rootPanel - The root panel of the tree (Immer draft or plain)
 * @param options - Split configuration
 * @returns The ID of the new sibling panel
 * @throws Error if the panel is not in the tree or is not a leaf panel. The caller gets the
 * panel ID from the rendered tree, so this is a programming error and not user input. A throw
 * in a reducer also makes Immer discard the draft, so the tree stays unchanged.
 */
export function splitPanel(
  rootPanel: PanelNode,
  options: {
    panelId: PanelId;
    direction: PanelDirection;
    position: 'before' | 'after';
  }
): PanelId {
  const { panelId, direction, position } = options;

  const panelToSplit = findPanelById(rootPanel, panelId);
  if (!panelToSplit) {
    throw new Error(`Panel '${panelId}' not found`);
  }
  if (!isLeafPanel(panelToSplit)) {
    throw new Error(
      `Panel '${panelId}' is not a leaf panel (has ${panelToSplit.children.length} children)`
    );
  }

  // Generate new IDs
  const newPanelId = generateShortId();
  const containerId = generateShortId();

  // Determine ordering based on position
  const newPanelOrder = position === 'before' ? 0 : 1;
  const originalPanelOrder = position === 'before' ? 1 : 0;

  // Create the original panel as a child (keeps same ID!)
  const originalPanelAsChild: PanelNode = {
    id: panelId,
    order: originalPanelOrder,
    direction: panelToSplit.direction,
    children: [],
    size: '50%',
  };

  // Create new sibling panel
  const newSiblingPanel: PanelNode = {
    id: newPanelId,
    order: newPanelOrder,
    direction,
    children: [],
    size: '50%',
  };

  // Build children array sorted by order
  const children =
    position === 'before'
      ? [newSiblingPanel, originalPanelAsChild]
      : [originalPanelAsChild, newSiblingPanel];

  // Transform the panel at this location into a container
  // The original panel becomes a child, container takes its place
  panelToSplit.id = containerId;
  panelToSplit.direction = direction;
  panelToSplit.children = children;

  // Clean up size for nested containers (root keeps size)
  if (panelToSplit !== rootPanel && panelToSplit.size) {
    delete panelToSplit.size;
  }

  return newPanelId;
}
