import type { Draft } from 'immer';
import type { Tab, TabId, PanelId, LayoutId, LayoutMeta } from '@types';
import { generateShortId } from '@utils/uuid';

/** Gives the name of a tab that the user did not name. */
export const NEW_TAB_NAME = 'New Tab';

/**
 * Builds a new tab in `panelId`. The tab gets the default name when `fields` has no name.
 *
 * The tab always gets a fresh `id`, `mountKey` and `createdAt`, also when `fields` holds them,
 * so a copy of a tab can pass the original as `fields`.
 */
export function createTab(panelId: PanelId, fields: Partial<Tab> = {}): Tab {
  return {
    ...fields,
    id: generateShortId(),
    name: fields.name ?? NEW_TAB_NAME,
    panelId,
    createdAt: Date.now(),
    mountKey: generateShortId(),
  };
}

// Support both regular Tab arrays and Immer Draft arrays
type TabOrDraft = Tab | Draft<Tab>;
type TabArrayOrDraft = Tab[] | Array<Draft<Tab>> | readonly Tab[] | ReadonlyArray<Draft<Tab>>;

/**
 * Finds the index of a tab by ID
 * @returns Index of tab, or -1 if not found
 */
export function findTabIndex(tabs: TabArrayOrDraft, tabId: TabId): number {
  return (tabs as Tab[]).findIndex((t) => t.id === tabId);
}

/**
 * Finds a tab by ID
 * @returns Tab if found, undefined otherwise
 */
export function findTabById<T extends TabOrDraft>(
  tabs: T[] | readonly T[],
  tabId: TabId
): T | undefined {
  return (tabs as T[]).find((t) => t.id === tabId);
}

/**
 * Gets the active tab for a panel
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

/**
 * Finds the tab that stops the user from opening a layout a second time.
 * @returns The open tab of a layout that does not allow multiple tabs, or undefined when the
 * layout allows several tabs or no tab shows it
 */
export function findOpenTabForLayout(
  tabs: readonly Tab[],
  layoutId: LayoutId,
  layout: LayoutMeta
): Tab | undefined {
  if (layout.allowMultiple) return undefined;
  return tabs.find((t) => t.layoutId === layoutId);
}
