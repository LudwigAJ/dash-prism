import { Draft } from 'immer';
import type { Panel, PanelId, PanelDirection } from '@types';

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
 *
 * TODO: Utility function for future use - checks if panel is the last remaining
 * Currently unused but may be needed for collapse validation
 *
 * @param root - The root panel tree
 * @param panelId - The panel ID to check
 * @returns true if this is the only leaf panel remaining
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

/**
 * Normalize a panel tree by flattening single-child containers (in-place)
 *
 * TODO: Utility function for future use - flattens single-child containers
 * Currently unused but may be needed for panel tree optimization
 */
export function normalizePanel(root: Panel | Draft<Panel>): void {
  for (const child of root.children) {
    normalizePanel(child);
  }

  if (root.children.length === 1) {
    const onlyChild = root.children[0];
    root.id = onlyChild.id;
    root.order = onlyChild.order;
    root.direction = onlyChild.direction;
    root.size = onlyChild.size;
    root.children = onlyChild.children;
  }
}

/**
 * Sort panels by their order property (in-place)
 *
 * TODO: Utility function for future use - sorts panels by order property
 * Currently unused but may be needed for panel ordering features
 */
export function sortPanelByOrder(root: Panel | Draft<Panel>): void {
  if (root.children.length < 2) return;
  root.children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const child of root.children) {
    sortPanelByOrder(child);
  }
}
