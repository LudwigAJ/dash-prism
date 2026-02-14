import type { PanelNode, Tab, Theme, Workspace } from '@types';

type ValidationSuccess = { ok: true; workspace: Workspace };
type ValidationFailure = { ok: false; errors: string[] };

export type WorkspaceValidationResult = ValidationSuccess | ValidationFailure;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const isOptionalString = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === 'string';

const isOptionalBoolean = (value: unknown): value is boolean | null | undefined =>
  value === undefined || value === null || typeof value === 'boolean';

const isOptionalStringArray = (value: unknown): value is string[] | null | undefined =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.every((item) => typeof item === 'string'));

const isOptionalRecordOfStrings = (
  value: unknown
): value is Record<string, string> | null | undefined =>
  value === undefined ||
  value === null ||
  (isRecord(value) && Object.values(value).every((item) => typeof item === 'string'));

const isOptionalStringOrNumber = (value: unknown): value is string | number | null | undefined =>
  value === undefined ||
  value === null ||
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value));

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

const isOptionalTheme = (value: unknown): value is Theme | null | undefined =>
  value === undefined || value === null || isTheme(value);

const normalizeOptional = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

function validateTab(value: unknown, index: number, errors: string[]): Tab | null {
  if (!isRecord(value)) {
    errors.push(`tabs[${index}]: expected object`);
    return null;
  }

  const id = value.id;
  const name = value.name;
  const panelId = value.panelId;
  const createdAt = value.createdAt;

  if (!isString(id)) errors.push(`tabs[${index}].id: expected string`);
  if (!isString(name)) errors.push(`tabs[${index}].name: expected string`);
  if (!isString(panelId)) errors.push(`tabs[${index}].panelId: expected string`);
  if (!isNumber(createdAt)) errors.push(`tabs[${index}].createdAt: expected number`);

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

  if (!isString(id) || !isString(name) || !isString(panelId) || !isNumber(createdAt)) {
    return null;
  }

  return {
    id,
    name,
    panelId,
    createdAt,
    layoutId: normalizeOptional(value.layoutId as string | null | undefined),
    layoutOption: normalizeOptional(value.layoutOption as string | null | undefined),
    layoutParams: normalizeOptional(
      value.layoutParams as Record<string, string> | null | undefined
    ),
    locked: normalizeOptional(value.locked as boolean | null | undefined),
    mountKey: normalizeOptional(value.mountKey as string | null | undefined),
    icon: normalizeOptional(value.icon as string | null | undefined),
    style: normalizeOptional(value.style as string | null | undefined),
  };
}

function validatePanel(value: unknown, path: string, errors: string[]): PanelNode | null {
  if (!isRecord(value)) {
    errors.push(`${path}: expected object`);
    return null;
  }

  const id = value.id;
  const order = value.order;
  const direction = value.direction;
  const children = value.children;

  if (!isString(id)) errors.push(`${path}.id: expected string`);
  if (order !== 0 && order !== 1) errors.push(`${path}.order: expected 0 or 1`);
  if (direction !== 'horizontal' && direction !== 'vertical') {
    errors.push(`${path}.direction: expected 'horizontal' or 'vertical'`);
  }
  if (!Array.isArray(children)) errors.push(`${path}.children: expected array`);
  if (!isOptionalBoolean(value.pinned)) errors.push(`${path}.pinned: expected boolean or null`);
  if (!isOptionalStringOrNumber(value.size)) {
    errors.push(`${path}.size: expected string, number, or null`);
  }

  if (
    !isString(id) ||
    (order !== 0 && order !== 1) ||
    (direction !== 'horizontal' && direction !== 'vertical') ||
    !Array.isArray(children)
  ) {
    return null;
  }

  const normalizedChildren: PanelNode[] = [];
  children.forEach((child, index) => {
    const childPanel = validatePanel(child, `${path}.children[${index}]`, errors);
    if (childPanel) normalizedChildren.push(childPanel);
  });

  return {
    id,
    order,
    direction: direction as PanelNode['direction'],
    children: normalizedChildren,
    pinned: normalizeOptional(value.pinned as boolean | null | undefined),
    size: normalizeOptional(value.size as string | number | null | undefined),
  };
}

function validatePanelTabs(value: unknown, errors: string[]): Record<string, string[]> | null {
  if (!isRecord(value)) {
    errors.push('panelTabs: expected object');
    return null;
  }

  const result: Record<string, string[]> = {};
  for (const [panelId, tabIds] of Object.entries(value)) {
    if (!Array.isArray(tabIds) || !tabIds.every(isString)) {
      errors.push(`panelTabs['${panelId}']: expected string[]`);
      continue;
    }
    result[panelId] = tabIds;
  }
  return result;
}

function validateActiveTabIds(value: unknown, errors: string[]): Record<string, string> | null {
  if (!isRecord(value)) {
    errors.push('activeTabIds: expected object');
    return null;
  }

  const result: Record<string, string> = {};
  for (const [panelId, tabId] of Object.entries(value)) {
    if (!isString(tabId)) {
      errors.push(`activeTabIds['${panelId}']: expected string`);
      continue;
    }
    result[panelId] = tabId;
  }
  return result;
}

function collectLeafPanelIds(panel: PanelNode): string[] {
  if (panel.children.length === 0) return [panel.id];
  return panel.children.flatMap(collectLeafPanelIds);
}

export function validateWorkspace(value: unknown): WorkspaceValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ['workspace: expected object'] };
  }

  const tabsValue = value.tabs;
  const panelValue = value.panel;
  const panelTabsValue = value.panelTabs;
  const activeTabIdsValue = value.activeTabIds;
  const activePanelIdValue = value.activePanelId;

  if (!Array.isArray(tabsValue)) errors.push('tabs: expected array');
  if (!isRecord(panelValue)) errors.push('panel: expected object');
  if (!isRecord(panelTabsValue)) errors.push('panelTabs: expected object');
  if (!isRecord(activeTabIdsValue)) errors.push('activeTabIds: expected object');
  if (!isString(activePanelIdValue)) errors.push('activePanelId: expected string');

  if (!isOptionalStringArray(value.favoriteLayouts)) {
    errors.push('favoriteLayouts: expected string[] or null');
  }
  if (!isOptionalTheme(value.theme)) {
    errors.push('theme: expected "light" or "dark" or null');
  }
  if (!isOptionalBoolean(value.searchBarsHidden)) {
    errors.push('searchBarsHidden: expected boolean or null');
  }

  if (!Array.isArray(tabsValue) || !isRecord(panelValue)) {
    return { ok: false, errors };
  }

  const normalizedTabs: Tab[] = [];
  tabsValue.forEach((tab, index) => {
    const normalized = validateTab(tab, index, errors);
    if (normalized) normalizedTabs.push(normalized);
  });

  const normalizedPanel = validatePanel(panelValue, 'panel', errors);
  const normalizedPanelTabs = validatePanelTabs(panelTabsValue, errors);
  const normalizedActiveTabIds = validateActiveTabIds(activeTabIdsValue, errors);

  if (
    !normalizedPanel ||
    !normalizedPanelTabs ||
    !normalizedActiveTabIds ||
    !isString(activePanelIdValue)
  ) {
    return { ok: false, errors };
  }

  const activePanelId = activePanelIdValue as string;
  const favoriteLayouts = normalizeOptional(value.favoriteLayouts as string[] | null | undefined);
  const theme = normalizeOptional(value.theme as Theme | null | undefined);
  const searchBarsHidden = normalizeOptional(value.searchBarsHidden as boolean | null | undefined);

  const workspace: Workspace = {
    tabs: normalizedTabs,
    panel: normalizedPanel,
    panelTabs: normalizedPanelTabs,
    activeTabIds: normalizedActiveTabIds,
    activePanelId,
    favoriteLayouts,
    theme,
    searchBarsHidden,
  };

  // --------------------------------------------------------------------------
  // Cross-key invariants
  // --------------------------------------------------------------------------

  const leafPanelIds = new Set(collectLeafPanelIds(normalizedPanel));
  const tabIds = new Set(normalizedTabs.map((tab) => tab.id));
  const tabToPanels: Record<string, string[]> = {};

  for (const [panelId, tabIdsForPanel] of Object.entries(normalizedPanelTabs)) {
    if (!leafPanelIds.has(panelId)) {
      errors.push(`panelTabs key '${panelId}' is not a leaf panel`);
    }

    for (const tabId of tabIdsForPanel) {
      if (!tabToPanels[tabId]) tabToPanels[tabId] = [];
      tabToPanels[tabId].push(panelId);
    }
  }

  for (const tab of normalizedTabs) {
    const panels = tabToPanels[tab.id] ?? [];
    if (panels.length === 0) {
      errors.push(`Tab '${tab.id}' exists in tabs but not in any panelTabs list`);
    } else if (panels.length > 1) {
      errors.push(`Tab '${tab.id}' appears in multiple panels: ${panels.join(', ')}`);
    }
  }

  for (const [panelId, tabIdsForPanel] of Object.entries(normalizedPanelTabs)) {
    for (const tabId of tabIdsForPanel) {
      if (!tabIds.has(tabId)) {
        errors.push(`Tab '${tabId}' in panelTabs['${panelId}'] not found in tabs`);
      }
    }
  }

  for (const leafId of leafPanelIds) {
    if (!normalizedPanelTabs[leafId]) {
      errors.push(`Leaf panel '${leafId}' missing from panelTabs`);
    }
  }

  if (!leafPanelIds.has(activePanelId)) {
    errors.push(`activePanelId '${activePanelId}' is not a valid leaf panel`);
  }

  for (const [panelId, tabId] of Object.entries(normalizedActiveTabIds)) {
    const tabsForPanel = normalizedPanelTabs[panelId];
    if (!tabsForPanel) {
      errors.push(`activeTabIds references unknown panel '${panelId}'`);
    } else if (!tabsForPanel.includes(tabId)) {
      errors.push(`activeTabIds['${panelId}'] = '${tabId}' but tab not in panelTabs['${panelId}']`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, workspace };
}
