// Fixtures for the store tests. Only test files import this module, so the bundle does not
// contain it.
import { combineReducers, configureStore, type Middleware } from '@reduxjs/toolkit';
import undoable, { type StateWithHistory } from 'redux-undo';
import type { PanelId, PanelNode, RegisteredLayouts, Tab, TabId } from '@types';
import { MAX_LEAF_PANELS } from '@constants/panels';
import { workspaceReducer } from './workspaceSlice';
import { uiReducer, initialUiState } from './uiSlice';
import type { ThunkExtra, UiState, WorkspaceState } from './types';

/** Gives the id of the first leaf panel of a `makeWorkspace` workspace. */
export const PANEL_1 = 'panel-1';
/** Gives the id of the second leaf panel of a `makeWorkspace` workspace. */
export const PANEL_2 = 'panel-2';
/** Gives the id of the container panel of a `makeWorkspace` workspace with two or more panels. */
export const ROOT_CONTAINER = 'container-1';
// Tab ids for the `panels` argument of `makeWorkspace`.
export const TAB_1 = 'tab-1';
export const TAB_2 = 'tab-2';
export const TAB_3 = 'tab-3';

/** Builds a tab with the id as its name and a mount key made from the id. */
export function makeTab(id: TabId, panelId: PanelId, fields: Partial<Tab> = {}): Tab {
  return { id, name: id, panelId, createdAt: 1, mountKey: `mount-${id}`, ...fields };
}

/**
 * Builds a valid workspace with one leaf panel for each entry of `panels`. Each entry lists the
 * tab ids of its panel. The leaf panels are `panel-1`, `panel-2` and so on. One panel is the root.
 * Two or more panels are the children of the container `container-1`. The first tab of each
 * panel is active, and the first panel is the active panel.
 */
export function makeWorkspace(
  panels: TabId[][] = [[TAB_1]],
  overrides: Partial<WorkspaceState> = {}
): WorkspaceState {
  const panelIds = panels.map((_, index) => `panel-${index + 1}`);
  const tabs = panels.flatMap((tabIds, index) =>
    tabIds.map((tabId) => makeTab(tabId, panelIds[index]))
  );
  const panelTabs: Record<PanelId, TabId[]> = {};
  const activeTabIds: Record<PanelId, TabId> = {};
  panels.forEach((tabIds, index) => {
    panelTabs[panelIds[index]] = [...tabIds];
    if (tabIds.length > 0) activeTabIds[panelIds[index]] = tabIds[0];
  });

  const leaves: PanelNode[] = panelIds.map((id, index) => ({
    id,
    // The type allows 0 and 1 only. A flat container of more than two leaves does not occur in
    // the app, but getLeafPanelIds walks it all the same.
    order: index % 2 === 0 ? 0 : 1,
    direction: 'horizontal',
    children: [],
    size: `${100 / panelIds.length}%`,
  }));
  const panel: PanelNode =
    leaves.length === 1
      ? { ...leaves[0], size: '100%' }
      : { id: ROOT_CONTAINER, order: 0, direction: 'horizontal', children: leaves, size: '100%' };

  return {
    tabs,
    panel,
    panelTabs,
    activeTabIds,
    activePanelId: panelIds[0],
    favoriteLayouts: [],
    searchBarsHidden: false,
    ...overrides,
  };
}

/** Holds the settings of `createTestStore`. Each one has a default. */
interface TestStoreOptions {
  ui?: Partial<UiState>;
  maxTabs?: number;
  maxPanels?: number;
  registeredLayouts?: RegisteredLayouts;
  notify?: ThunkExtra['notify'];
  /** Runs after the default middleware, in this order. */
  middleware?: Middleware[];
}

/**
 * Builds a store with the reducer shape of the app: the workspace inside redux-undo, and the ui
 * slice. It has no persistence and none of the store middleware, so a test adds the middleware
 * that it checks. Without `workspace`, the store starts from the initial workspace.
 */
export function createTestStore(
  workspace?: WorkspaceState,
  {
    ui = {},
    maxTabs = 16,
    maxPanels = MAX_LEAF_PANELS,
    registeredLayouts = {},
    notify = () => {},
    middleware = [],
  }: TestStoreOptions = {}
) {
  const extra: ThunkExtra = {
    getMaxTabs: () => maxTabs,
    getMaxPanels: () => maxPanels,
    getRegisteredLayouts: () => registeredLayouts,
    notify,
  };
  const history: StateWithHistory<WorkspaceState> | undefined = workspace && {
    past: [],
    present: workspace,
    future: [],
  };
  return configureStore({
    reducer: combineReducers({
      workspace: undoable(workspaceReducer, { limit: 50, ignoreInitialState: true }),
      ui: uiReducer,
    }),
    preloadedState: {
      workspace: history,
      ui: { ...initialUiState, ...ui },
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: extra } }).concat(middleware),
  });
}

/** Gives the store type of `createTestStore`. */
export type TestStore = ReturnType<typeof createTestStore>;

/** Gives the present workspace of a test store. */
export function getWorkspace(store: TestStore): WorkspaceState {
  return store.getState().workspace.present;
}

/** Gives a tab of the present workspace of a test store, or undefined. */
export function getTab(store: TestStore, tabId: TabId): Tab | undefined {
  return getWorkspace(store).tabs.find((tab) => tab.id === tabId);
}
