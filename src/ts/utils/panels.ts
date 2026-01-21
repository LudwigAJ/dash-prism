import { Draft } from 'immer';
import type { Panel, PanelId, PanelDirection } from '@types';
import { generateShortId } from '@utils/uuid';

// =============================================================================
// Query Functions (Read-only)
// =============================================================================

/**
 * Check if a panel is a leaf panel (can hold tabs)
 */
export function isLeafPanel(root: Panel | Draft<Panel>): boolean {
  return root.children.length === 0;
}

/**
 * Check if a panel is a container (has children)
 */
export function isContainerPanel(root: Panel | Draft<Panel>): boolean {
  return root.children.length > 0;
}

/**
 * Get all leaf panel IDs from a panel tree (recursive)
 */
export function getLeafPanelIds(root: Panel | Draft<Panel>): PanelId[] {
  if (!root || !root.children) return [];
  if (isLeafPanel(root)) return [root.id];
  return root.children.flatMap(getLeafPanelIds);
}

/**
 * Count total number of leaf panels in a tree
 */
export function countLeafPanels(root: Panel | Draft<Panel>): number {
  return getLeafPanelIds(root).length;
}

/**
 * Find a panel by ID in the tree (recursive)
 */
export function findPanelById(
  root: Panel | Draft<Panel>,
  panelId: PanelId
): Panel | Draft<Panel> | null {
  if (root.id === panelId) return root;

  for (const child of root.children) {
    const found = findPanelById(child, panelId);
    if (found) return found;
  }

  return null;
}

/**
 * Find parent panel (returns just the parent)
 */
export function findParentPanel(
  root: Panel | Draft<Panel>,
  panelId: PanelId
): Panel | Draft<Panel> | null {
  if (root.id === panelId) return null;

  for (const child of root.children) {
    if (child.id === panelId) return root;
    const parent = findParentPanel(child, panelId);
    if (parent) return parent;
  }

  return null;
}

/**
 * Find parent panel with index (useful for splicing in mutations)
 */
export function findParentPanelWithIndex(
  root: Panel | Draft<Panel>,
  panelId: PanelId
): { parent: Panel | Draft<Panel>; index: number } | null {
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === panelId) {
      return { parent: root, index: i };
    }
    const found = findParentPanelWithIndex(root.children[i], panelId);
    if (found) return found;
  }
  return null;
}

/**
 * Find all leaf panels in the tree (recursive)
 */
export function findAllLeaves(root: Panel | Draft<Panel>): Panel | Draft<Panel>[] {
  if (isLeafPanel(root)) return [root];
  return root.children.flatMap(findAllLeaves);
}

/**
 * Check if a panel is the last (only) leaf panel in the tree
 */
export function isLastPanel(root: Panel | Draft<Panel>, panelId: PanelId): boolean {
  const leafPanels = getLeafPanelIds(root);
  return leafPanels.length === 1 && leafPanels[0] === panelId;
}

// =============================================================================
// Mutation Functions (In-place, for use inside produce() blocks)
// =============================================================================

/**
 * Update a panel in the tree by ID (in-place mutation)
 */
export function updatePanelInTree(
  root: Panel | Draft<Panel>,
  panelId: PanelId,
  updater: (p: Panel | Draft<Panel>) => void
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
 * Remove a panel from tree with bubble-up behavior (in-place)
 * If parent has only one child after removal, child replaces parent
 */
export function removePanelFromTree(root: Panel | Draft<Panel>, panelId: PanelId): boolean {
  const result = findParentPanelWithIndex(root, panelId);
  if (!result) return false;

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

// =============================================================================
// Complex Panel Operations (Panel Tree Transformations)
// =============================================================================

/**
 * Result of a panel split operation
 */
export type SplitPanelResult = {
  success: boolean;
  newPanelId?: PanelId;
  containerId?: PanelId;
  error?: string;
};

/**
 * Split a leaf panel into a container with two children.
 *
 * This transforms a leaf panel at the given location into a container panel
 * with two children: the original panel (keeping its ID) and a new sibling panel.
 * The original panel ID is preserved to avoid triggering React re-renders of tabs.
 *
 * @param rootPanel - The root panel of the tree (Immer draft or plain)
 * @param options - Split configuration
 * @returns Result indicating success/failure and new panel IDs
 */
export function splitPanel(
  rootPanel: Panel | Draft<Panel>,
  options: {
    panelId: PanelId;
    direction: PanelDirection;
    position: 'before' | 'after';
  }
): SplitPanelResult {
  const { panelId, direction, position } = options;

  // Find the panel to split
  const panelToSplit = findPanelById(rootPanel, panelId);
  if (!panelToSplit) {
    return {
      success: false,
      error: `Panel '${panelId}' not found`,
    };
  }

  // Verify it's a leaf panel
  if (!isLeafPanel(panelToSplit)) {
    return {
      success: false,
      error: `Panel '${panelId}' is not a leaf panel (has ${panelToSplit.children.length} children)`,
    };
  }

  // Generate new IDs
  const newPanelId = generateShortId();
  const containerId = generateShortId();

  // Determine ordering based on position
  const newPanelOrder = position === 'before' ? 0 : 1;
  const originalPanelOrder = position === 'before' ? 1 : 0;

  // Create the original panel as a child (keeps same ID!)
  const originalPanelAsChild: Panel = {
    id: panelId,
    order: originalPanelOrder,
    direction: null,
    children: [],
    size: '50%',
  };

  // Create new sibling panel
  const newSiblingPanel: Panel = {
    id: newPanelId,
    order: newPanelOrder,
    direction: null,
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
  panelToSplit.children = children as any; // Type assertion for Immer Draft compatibility

  // Clean up size for nested containers (root keeps size)
  if (panelToSplit !== rootPanel && panelToSplit.size) {
    delete panelToSplit.size;
  }

  return {
    success: true,
    newPanelId,
    containerId,
  };
}

/**
 * Result of a panel collapse operation
 */
export type CollapsePanelResult = {
  success: boolean;
  removedPanelId?: PanelId;
  error?: string;
};

/**
 * Collapse a panel by removing it from the tree.
 *
 * This function only handles the tree manipulation. The caller is responsible for:
 * - Moving tabs from the collapsed panel to another panel
 * - Updating activeTabIds and panelTabs state
 * - Ensuring at least one panel remains
 *
 * @param rootPanel - The root panel of the tree
 * @param panelId - ID of panel to collapse
 * @returns Result indicating success/failure
 */
export function collapsePanel(
  rootPanel: Panel | Draft<Panel>,
  panelId: PanelId
): CollapsePanelResult {
  // Verify panel exists
  const panelExists = getLeafPanelIds(rootPanel).includes(panelId);
  if (!panelExists) {
    return {
      success: false,
      error: `Panel '${panelId}' not found in tree`,
    };
  }

  // Attempt to remove from tree
  const removed = removePanelFromTree(rootPanel, panelId);
  if (!removed) {
    return {
      success: false,
      error: `Failed to remove panel '${panelId}' from tree`,
    };
  }

  return {
    success: true,
    removedPanelId: panelId,
  };
}
