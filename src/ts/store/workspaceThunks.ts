// The workspace thunks hold the limit policy: the tab limit, the panel limit and the layouts that
// allow one tab only. The thunks read the limits from the thunk extra argument and tell the user
// when they refuse an action. The reducers in workspaceSlice.ts then only move data.
import { createAsyncThunk } from '@reduxjs/toolkit';
import type { Tab, PanelId, TabId, PanelDirection } from '@types';
import type { WorkspaceState, ThunkExtra } from './types';
import { createTab, findOpenTabForLayout, findTabById } from '@utils/tabs';
import { countLeafPanels, findPanelById, isLeafPanel } from '@utils/panels';

/** Gives the store shape and the extra argument that the workspace thunks use. */
export interface WorkspaceThunkConfig {
  state: { workspace: { present: WorkspaceState } };
  extra: ThunkExtra;
  rejectValue: string;
}

/** Arguments of the addTab thunk. */
interface AddTabPayload {
  panelId: PanelId;
  name?: string;
  layoutId?: string;
  params?: Record<string, string>;
  option?: string;
}

/**
 * Holds a tab that addTab or duplicateTab built, with the tab limit that the thunk read. The
 * reducer checks the limit again, because another tab can arrive between the thunk and the reducer.
 */
interface TabInsertResult {
  tab: Tab;
  maxTabs: number;
}

/** Arguments of the splitPanel thunk. */
export interface SplitPanelPayload {
  panelId: PanelId;
  direction: PanelDirection;
  tabId: TabId;
  position?: 'before' | 'after';
}

/** Holds the split arguments with the panel limit, which the reducer checks again like maxTabs. */
interface SplitPanelResult extends SplitPanelPayload {
  maxPanels: number;
}

/**
 * Tells if the workspace has room for one more tab.
 *
 * @param maxTabs - A limit below 1 means no limit.
 */
export function canAddTab(tabCount: number, maxTabs: number): boolean {
  return maxTabs < 1 || tabCount < maxTabs;
}

/**
 * Tells if the workspace has room for one more leaf panel.
 *
 * @param maxPanels - A limit below 1 means no limit.
 */
export function canAddPanel(panelCount: number, maxPanels: number): boolean {
  return maxPanels < 1 || panelCount < maxPanels;
}

/**
 * Adds a tab to a panel and makes it active. The thunk rejects the tab at the tab limit, and for
 * a layout that does not allow multiple tabs while one is open, and tells the user why.
 */
export const addTab = createAsyncThunk<TabInsertResult, AddTabPayload, WorkspaceThunkConfig>(
  'workspace/addTab',
  async (payload, { getState, extra, rejectWithValue }) => {
    const { tabs } = getState().workspace.present;

    if (!canAddTab(tabs.length, extra.getMaxTabs())) {
      extra.notify(
        'warning',
        `Maximum tabs limit reached (${extra.getMaxTabs()})`,
        `Cannot add tab: maximum of ${extra.getMaxTabs()} tabs reached.`
      );
      return rejectWithValue(`Maximum tabs limit reached (${extra.getMaxTabs()})`);
    }

    if (payload.layoutId) {
      const layoutMeta = extra.getRegisteredLayouts()[payload.layoutId];
      if (layoutMeta && findOpenTabForLayout(tabs, payload.layoutId, layoutMeta)) {
        extra.notify(
          'info',
          `"${layoutMeta.name}" is already open`,
          `This layout does not allow multiple instances.`
        );
        return rejectWithValue(`Layout "${payload.layoutId}" does not allow multiple instances`);
      }
    }

    const newTab = createTab(payload.panelId, {
      name: payload.name,
      layoutId: payload.layoutId,
      layoutParams: payload.params,
      layoutOption: payload.option,
    });

    return { tab: newTab, maxTabs: extra.getMaxTabs() };
  }
);

/**
 * Adds a copy of a tab next to the original, in the same panel. The copy is unlocked, its name
 * ends with "(copy)", and it gets fresh ids, so it mounts its own layout.
 *
 * The thunk applies the same limits as addTab: the tab limit, and a layout that does not allow
 * multiple tabs.
 */
export const duplicateTab = createAsyncThunk<
  TabInsertResult,
  { tabId: TabId },
  WorkspaceThunkConfig
>('workspace/duplicateTab', async ({ tabId }, { getState, extra, rejectWithValue }) => {
  const { tabs } = getState().workspace.present;

  if (!canAddTab(tabs.length, extra.getMaxTabs())) {
    extra.notify(
      'warning',
      `Cannot duplicate: maximum tabs limit reached (${extra.getMaxTabs()})`,
      `DUPLICATE_TAB blocked: workspace at maxTabs limit (${extra.getMaxTabs()})`
    );
    return rejectWithValue(`Maximum tabs limit reached`);
  }

  const originalTab = findTabById(tabs, tabId);
  if (!originalTab) {
    return rejectWithValue('Tab not found');
  }

  // The original tab is open, so a layout that does not allow multiple tabs always has an open
  // tab here.
  if (originalTab.layoutId) {
    const layoutMeta = extra.getRegisteredLayouts()[originalTab.layoutId];
    if (layoutMeta && findOpenTabForLayout(tabs, originalTab.layoutId, layoutMeta)) {
      extra.notify(
        'info',
        `"${layoutMeta.name}" does not allow duplicates`,
        `This layout does not allow multiple instances.`
      );
      return rejectWithValue(`Layout "${originalTab.layoutId}" does not allow multiple instances`);
    }
  }

  const newTab = createTab(originalTab.panelId, {
    ...originalTab,
    name: `${originalTab.name} (copy)`,
    locked: false,
    layoutParams: originalTab.layoutParams ? { ...originalTab.layoutParams } : undefined,
  });

  return { tab: newTab, maxTabs: extra.getMaxTabs() };
});

/**
 * Splits a leaf panel and moves a tab into the new panel. The thunk rejects the split at the
 * panel limit, and for a panel that is not a leaf of the tree, and tells the user why.
 */
export const splitPanel = createAsyncThunk<
  SplitPanelResult,
  SplitPanelPayload,
  WorkspaceThunkConfig
>('workspace/splitPanel', async (payload, { getState, extra, rejectWithValue }) => {
  const { panel } = getState().workspace.present;
  const maxPanels = extra.getMaxPanels();
  if (!canAddPanel(countLeafPanels(panel), maxPanels)) {
    extra.notify(
      'warning',
      `Cannot split: maximum of ${maxPanels} panels reached`,
      `Cannot split panel: maximum of ${maxPanels} panels reached.`
    );
    return rejectWithValue(`Maximum panels limit reached (${maxPanels})`);
  }

  // The UI only offers a leaf panel, so these two are faults. The thunk reports them, because a
  // throw in the reducer would reject the dispatch and no caller catches that.
  const target = findPanelById(panel, payload.panelId);
  if (!target) {
    extra.notify('error', 'Cannot split: panel not found');
    return rejectWithValue(`Panel '${payload.panelId}' not found`);
  }
  if (!isLeafPanel(target)) {
    extra.notify('error', 'Cannot split a non-leaf panel');
    return rejectWithValue(`Panel '${payload.panelId}' is not a leaf panel`);
  }

  return { ...payload, maxPanels };
});
