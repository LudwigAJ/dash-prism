import type { PanelId, TabId } from '@types';
import type { WorkspaceState } from './types';
import { getLeafPanelIds } from '@utils/panels';
import { logger } from '@utils/logger';

/**
 * Makes a workspace from Dash internally consistent and gives the result as a new object.
 * syncWorkspace calls it after it applies an `updateWorkspace` payload, because a Dash callback
 * can send any mix of fields.
 *
 * The rules:
 * - A tab on a panel that is not a leaf of the tree is removed.
 * - Each leaf panel keeps the order of its `panelTabs` list. An id is removed when the tab does
 *   not exist, belongs to another panel (`tab.panelId` decides) or shows twice. A tab that its
 *   panel does not list is added to the end of the list.
 * - An active tab that is not in its panel is replaced by the first tab of the panel. A panel
 *   without tabs has no active tab. Only leaf panels keep an entry.
 * - An active panel that is not a leaf is replaced by the first leaf panel.
 *
 * The input is not changed. It can be an immer draft.
 */
export function healWorkspace(workspace: WorkspaceState): WorkspaceState {
  const leafPanelIds = getLeafPanelIds(workspace.panel);
  const leafPanelSet = new Set(leafPanelIds);

  // When `tabs` and `activeTabIds` need no repair, the result keeps the input array and object,
  // so the selectors that read them do not report a change. `panelTabs` is always a new object.
  let tabs = workspace.tabs.filter((tab) => leafPanelSet.has(tab.panelId));
  if (tabs.length === workspace.tabs.length) {
    tabs = workspace.tabs;
  } else {
    logger.debug(`[syncWorkspace] Removed ${workspace.tabs.length - tabs.length} orphaned tabs`);
  }

  // panelTabs holds the order of the tabs in a panel. reorderTab changes only panelTabs, and
  // `tabs` stays in the order of creation, so a rebuild from `tabs` would undo every reorder on
  // each readWorkspace -> updateWorkspace echo.
  const tabById = new Map(tabs.map((tab) => [tab.id, tab]));
  const panelTabs: Record<PanelId, TabId[]> = {};
  for (const panelId of leafPanelIds) {
    const seen = new Set<TabId>();
    // The payload has no type check at runtime. A missing or malformed list gives an empty list,
    // which the loop below fills from `tabs`.
    const incoming = workspace.panelTabs[panelId];
    panelTabs[panelId] = (Array.isArray(incoming) ? incoming : []).filter((tabId) => {
      const tab = tabById.get(tabId);
      if (!tab || tab.panelId !== panelId || seen.has(tabId)) return false;
      seen.add(tabId);
      return true;
    });
  }
  for (const tab of tabs) {
    if (!panelTabs[tab.panelId].includes(tab.id)) panelTabs[tab.panelId].push(tab.id);
  }

  let activeTabIds: Record<PanelId, TabId> = {};
  for (const panelId of leafPanelIds) {
    const activeTabId = workspace.activeTabIds[panelId];
    if (!activeTabId) continue;
    const panelTabIds = panelTabs[panelId];
    if (panelTabIds.includes(activeTabId)) {
      activeTabIds[panelId] = activeTabId;
    } else if (panelTabIds.length > 0) {
      activeTabIds[panelId] = panelTabIds[0];
    }
  }
  const oldActiveTabIds = Object.entries(workspace.activeTabIds);
  if (
    oldActiveTabIds.length === Object.keys(activeTabIds).length &&
    oldActiveTabIds.every(([panelId, tabId]) => activeTabIds[panelId] === tabId)
  ) {
    activeTabIds = workspace.activeTabIds;
  }

  const activePanelId =
    leafPanelSet.has(workspace.activePanelId) || leafPanelIds.length === 0
      ? workspace.activePanelId
      : leafPanelIds[0];

  return { ...workspace, tabs, panelTabs, activeTabIds, activePanelId };
}
