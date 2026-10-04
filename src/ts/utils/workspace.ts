import { getLeafPanelIds } from '@utils/panels';
import type { PanelNode, Tab } from '@types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalBoolean(value: unknown): value is boolean | null | undefined {
  return value === undefined || value === null || typeof value === 'boolean';
}

function isOptionalStringArray(value: unknown): value is string[] | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isOptionalRecordOfStrings(
  value: unknown
): value is Record<string, string> | null | undefined {
  return (
    value === undefined ||
    value === null ||
    (isRecord(value) && Object.values(value).every((item) => typeof item === 'string'))
  );
}

function isOptionalStringOrNumber(value: unknown): value is string | number | null | undefined {
  return (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/** Adds an error for each field of a tab that has the wrong type. */
function checkTab(value: unknown, index: number, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`tabs[${index}]: expected object`);
    return;
  }

  if (!isString(value.id)) errors.push(`tabs[${index}].id: expected string`);
  if (!isString(value.name)) errors.push(`tabs[${index}].name: expected string`);
  if (!isString(value.panelId)) errors.push(`tabs[${index}].panelId: expected string`);
  if (!isNumber(value.createdAt)) errors.push(`tabs[${index}].createdAt: expected number`);

  if (!isOptionalString(value.layoutId)) {
    errors.push(`tabs[${index}].layoutId: expected string or null`);
  }
  if (!isOptionalString(value.layoutOption)) {
    errors.push(`tabs[${index}].layoutOption: expected string or null`);
  }
  if (!isOptionalRecordOfStrings(value.layoutParams)) {
    errors.push(`tabs[${index}].layoutParams: expected record of strings or null`);
  }
  if (!isOptionalBoolean(value.locked)) {
    errors.push(`tabs[${index}].locked: expected boolean or null`);
  }
  if (!isOptionalString(value.mountKey)) {
    errors.push(`tabs[${index}].mountKey: expected string or null`);
  }
  if (!isOptionalString(value.icon)) {
    errors.push(`tabs[${index}].icon: expected string or null`);
  }
  if (!isOptionalString(value.style)) {
    errors.push(`tabs[${index}].style: expected string or null`);
  }
}

// Each check below adds an error for each problem it finds, and tells if it found none. Its
// type guard lets the cross-key checks of validateWorkspace read the checked value.

function checkTabs(value: unknown, errors: string[]): value is Tab[] {
  if (!Array.isArray(value)) {
    errors.push('tabs: expected array');
    return false;
  }
  const errorCount = errors.length;
  value.forEach((tab, index) => {
    checkTab(tab, index, errors);
  });
  return errors.length === errorCount;
}

function checkPanel(value: unknown, path: string, errors: string[]): value is PanelNode {
  if (!isRecord(value)) {
    errors.push(`${path}: expected object`);
    return false;
  }

  const errorCount = errors.length;
  if (!isString(value.id)) errors.push(`${path}.id: expected string`);
  if (value.order !== 0 && value.order !== 1) errors.push(`${path}.order: expected 0 or 1`);
  if (value.direction !== 'horizontal' && value.direction !== 'vertical') {
    errors.push(`${path}.direction: expected 'horizontal' or 'vertical'`);
  }
  if (!isOptionalBoolean(value.pinned)) errors.push(`${path}.pinned: expected boolean or null`);
  if (!isOptionalStringOrNumber(value.size)) {
    errors.push(`${path}.size: expected string, number, or null`);
  }
  if (Array.isArray(value.children)) {
    value.children.forEach((child, index) => {
      checkPanel(child, `${path}.children[${index}]`, errors);
    });
  } else {
    errors.push(`${path}.children: expected array`);
  }
  return errors.length === errorCount;
}

function checkPanelTabs(value: unknown, errors: string[]): value is Record<string, string[]> {
  if (!isRecord(value)) {
    errors.push('panelTabs: expected object');
    return false;
  }
  const errorCount = errors.length;
  for (const [panelId, tabIds] of Object.entries(value)) {
    if (!Array.isArray(tabIds) || !tabIds.every((tabId) => isString(tabId))) {
      errors.push(`panelTabs['${panelId}']: expected string[]`);
    }
  }
  return errors.length === errorCount;
}

function checkActiveTabIds(value: unknown, errors: string[]): value is Record<string, string> {
  if (!isRecord(value)) {
    errors.push('activeTabIds: expected object');
    return false;
  }
  const errorCount = errors.length;
  for (const [panelId, tabId] of Object.entries(value)) {
    if (!isString(tabId)) errors.push(`activeTabIds['${panelId}']: expected string`);
  }
  return errors.length === errorCount;
}

/**
 * Checks a workspace from storage or from the store against the shape of `Workspace` and the
 * invariants that the reducers keep: each tab is in exactly one leaf panel list, each list
 * belongs to a leaf panel, and the active panel and the active tabs exist.
 *
 * A legacy key such as `theme` is ignored. Optional fields may be null, because a payload that
 * went through JSON has null where the store had undefined.
 *
 * @returns one message for each problem, or an empty list for a valid workspace
 */
export function validateWorkspace(value: unknown): string[] {
  if (!isRecord(value)) return ['workspace: expected object'];

  const errors: string[] = [];
  const { tabs, panel, panelTabs, activeTabIds, activePanelId } = value;
  const tabsValid = checkTabs(tabs, errors);
  const panelValid = checkPanel(panel, 'panel', errors);
  const panelTabsValid = checkPanelTabs(panelTabs, errors);
  const activeTabIdsValid = checkActiveTabIds(activeTabIds, errors);
  if (!isString(activePanelId)) errors.push('activePanelId: expected string');

  if (!isOptionalStringArray(value.favoriteLayouts)) {
    errors.push('favoriteLayouts: expected string[] or null');
  }
  if (!isOptionalBoolean(value.searchBarsHidden)) {
    errors.push('searchBarsHidden: expected boolean or null');
  }
  if (!isOptionalString(value.serverSessionId)) {
    errors.push('serverSessionId: expected string or null');
  }

  if (
    !tabsValid ||
    !panelValid ||
    !panelTabsValid ||
    !activeTabIdsValid ||
    !isString(activePanelId)
  ) {
    return errors;
  }

  const leafPanelIds = new Set(getLeafPanelIds(panel));
  const tabIds = new Set(tabs.map((tab) => tab.id));
  const tabToPanels: Record<string, string[]> = {};

  for (const [panelId, tabIdsForPanel] of Object.entries(panelTabs)) {
    if (!leafPanelIds.has(panelId)) {
      errors.push(`panelTabs key '${panelId}' is not a leaf panel`);
    }
    for (const tabId of tabIdsForPanel) {
      (tabToPanels[tabId] ??= []).push(panelId);
      if (!tabIds.has(tabId)) {
        errors.push(`Tab '${tabId}' in panelTabs['${panelId}'] not found in tabs`);
      }
    }
  }

  for (const tab of tabs) {
    const panels = tabToPanels[tab.id] ?? [];
    if (panels.length === 0) {
      errors.push(`Tab '${tab.id}' exists in tabs but not in any panelTabs list`);
    } else if (panels.length > 1) {
      errors.push(`Tab '${tab.id}' appears in multiple panels: ${panels.join(', ')}`);
    }
  }

  for (const leafId of leafPanelIds) {
    if (!panelTabs[leafId]) {
      errors.push(`Leaf panel '${leafId}' missing from panelTabs`);
    }
  }

  if (!leafPanelIds.has(activePanelId)) {
    errors.push(`activePanelId '${activePanelId}' is not a valid leaf panel`);
  }

  for (const [panelId, tabId] of Object.entries(activeTabIds)) {
    const tabsForPanel = panelTabs[panelId];
    if (!tabsForPanel) {
      errors.push(`activeTabIds references unknown panel '${panelId}'`);
    } else if (!tabsForPanel.includes(tabId)) {
      errors.push(`activeTabIds['${panelId}'] = '${tabId}' but tab not in panelTabs['${panelId}']`);
    }
  }

  return errors;
}
