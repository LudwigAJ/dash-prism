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

// The reducers pass immer drafts. A draft of a Tab has the same fields, so `readonly Tab[]` takes it.

/** Finds the index of a tab, or -1. */
export function findTabIndex(tabs: readonly Tab[], tabId: TabId): number {
  return tabs.findIndex((t) => t.id === tabId);
}

/** Finds a tab by id, or undefined. */
export function findTabById(tabs: readonly Tab[], tabId: TabId): Tab | undefined {
  return tabs.find((t) => t.id === tabId);
}

/** Finds the active tab of a panel, or undefined. */
export function getActiveTabForPanel(
  tabs: readonly Tab[],
  activeTabIds: Record<PanelId, TabId>,
  panelId: PanelId
): Tab | undefined {
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
