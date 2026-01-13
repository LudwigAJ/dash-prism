import type { Draft } from 'immer';
import type { Tab, TabId, PanelId } from '@types';

// Support both regular Tab arrays and Immer Draft arrays
type TabOrDraft = Tab | Draft<Tab>;
type TabArrayOrDraft = Tab[] | Draft<Tab>[] | readonly Tab[] | readonly Draft<Tab>[];

/**
 * Find the index of a tab by ID
 * @returns Index of tab, or -1 if not found
 */
export function findTabIndex(tabs: TabArrayOrDraft, tabId: TabId): number {
  return (tabs as Tab[]).findIndex((t) => t.id === tabId);
}

/**
 * Find a tab by ID
 * @returns Tab if found, undefined otherwise
 */
export function findTabById<T extends TabOrDraft>(
  tabs: T[] | readonly T[],
  tabId: TabId
): T | undefined {
  return (tabs as T[]).find((t) => t.id === tabId);
}

/**
 * Get all tabs belonging to a specific panel
 * @returns Array of tabs in the panel (empty array if none)
 */
export function getTabsByPanelId<T extends TabOrDraft>(
  tabs: T[] | readonly T[],
  panelId: PanelId
): T[] {
  return (tabs as T[]).filter((t) => t.panelId === panelId);
}

/**
 * Count tabs in a specific panel
 * @returns Number of tabs in the panel
 */
export function countTabsInPanel(tabs: TabArrayOrDraft, panelId: PanelId): number {
  return (tabs as Tab[]).filter((t) => t.panelId === panelId).length;
}

/**
 * Check if a tab is locked
 * @returns true if tab exists and is locked
 */
export function isTabLocked(tabs: TabArrayOrDraft, tabId: TabId): boolean {
  const tab = findTabById(tabs as Tab[], tabId);
  return tab?.locked === true;
}

/**
 * Get the active tab for a panel
 * @param tabs - All tabs
 * @param activeTabIds - Map of panelId -> activeTabId
 * @param panelId - The panel to get active tab for
 * @returns The active tab, or undefined if not found
 */
export function getActiveTabForPanel<T extends TabOrDraft>(
  tabs: T[] | readonly T[],
  activeTabIds: Record<PanelId, TabId>,
  panelId: PanelId
): T | undefined {
  const activeTabId = activeTabIds[panelId];
  if (!activeTabId) return undefined;
  return findTabById(tabs, activeTabId);
}
