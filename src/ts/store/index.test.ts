/**
 * End-to-end tests for createPrismStore: redux-undo inside redux-persist, plus
 * the Dash sync and validation middleware, wired exactly as in production. Only
 * redux-undo's `present` slice is persisted, so the undo history never reaches
 * storage and `_persist` lives beside it on `state.workspace`.
 *
 * Regression coverage: redux-persist's PERSIST/REHYDRATE actions used
 * to be recorded in the undo history. Every fresh page load therefore started
 * with Undo enabled, and one undo replaced the restored workspace with the empty
 * pre-persist state, whose `_persist.rehydrated === false` also stopped
 * redux-persist from writing anything for the rest of the session. The current
 * wrapping order keeps `_persist` outside the history, so an undo can no longer
 * reach it; the assertions below record that rehydration completed.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Storage } from 'redux-persist';
import { toast } from 'sonner';
import {
  createPrismStore,
  getWorkspaceStorageKey,
  addTab,
  activateTab,
  removeTab,
  renameTab,
  undo,
  redo,
  selectCanUndo,
  selectCanRedo,
  requestLayoutSelection,
  requestSearchFocus,
  startRenameTab,
  selectLayoutSelectionRequest,
  selectSearchFocusPanelId,
  selectIsSingleTabMode,
  splitPanel,
  canAddPanel,
} from './index';
import type { WorkspaceState } from './types';
import { MAX_LEAF_PANELS } from '@constants/panels';
import type { RegisteredLayouts } from '@types';
import { makeTab, makeWorkspace, PANEL_1 } from './testing';

interface PersistMeta {
  version: number;
  rehydrated: boolean;
}

/** Holds a legacy (persist version 1) payload: the flat workspace plus redux-persist's marker. */
interface Persisted extends WorkspaceState {
  _persist?: PersistMeta;
}

const COMPONENT_ID = 'test-prism';
const STORAGE_KEY = getWorkspaceStorageKey(COMPONENT_ID);

/** In-memory redux-persist storage engine that can be seeded and inspected. */
function createFakeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const storage: Storage = {
    getItem: (key: string) => Promise.resolve(data.get(key) ?? null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
  return { storage, data };
}

/** Serialises like redux-persist does: each top-level key is JSON-encoded separately. */
function serialisePersisted(state: Persisted): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(state).map(([key, value]) => [key, JSON.stringify(value)]))
  );
}

/** The current on-disk format (persist version 2): only redux-undo's `present`. */
function serialiseV2(present: WorkspaceState): string {
  return JSON.stringify({
    present: JSON.stringify(present),
    _persist: JSON.stringify({ version: 2, rehydrated: true }),
  });
}

/** Tab ids of the workspace currently in storage (current format). */
function storedTabIds(data: Map<string, string>): string[] {
  const stored = JSON.parse(data.get(STORAGE_KEY) ?? '{}') as Record<string, string>;
  const present = JSON.parse(stored.present) as WorkspaceState;
  return present.tabs.map((t) => t.id);
}

/** A valid two-tab workspace as a user would have left it on the previous visit. */
function savedWorkspace(overrides: Partial<Persisted> = {}): Persisted {
  const workspace = makeWorkspace([['tab-a', 'tab-b']], {
    tabs: [
      makeTab('tab-a', PANEL_1, { name: 'Alpha', layoutId: 'home' }),
      makeTab('tab-b', PANEL_1, { name: 'Beta', layoutId: 'about' }),
    ],
    activeTabIds: { [PANEL_1]: 'tab-b' },
    favoriteLayouts: ['home'],
  });
  return { ...workspace, _persist: { version: 1, rehydrated: true }, ...overrides };
}

// A thunk toast reaches sonner through prismToast. The mock keeps the tests quiet and shows which
// Toaster each store addresses.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function createStore(
  options: {
    componentId?: string;
    storage?: Storage;
    setProps?: () => void;
    serverSessionId?: string;
    registeredLayouts?: RegisteredLayouts;
    maxTabs?: number | (() => number);
    maxPanels?: number | (() => number);
  } = {}
) {
  const setProps = options.setProps ?? vi.fn();
  const result = createPrismStore({
    componentId: options.componentId ?? COMPONENT_ID,
    serverSessionId: options.serverSessionId,
    persistenceType: options.storage ? 'local' : 'memory',
    maxTabs: options.maxTabs ?? 16,
    maxPanels: options.maxPanels ?? MAX_LEAF_PANELS,
    setProps,
    getRegisteredLayouts: () => options.registeredLayouts ?? {},
    storage: options.storage,
  });
  return { ...result, setProps };
}

const LAYOUTS: RegisteredLayouts = { home: { name: 'Home' }, about: { name: 'About' } };

type Created = ReturnType<typeof createStore>;

/**
 * Waits until redux-persist completes the rehydration (the PersistGate condition). The persistor
 * notifies its subscribers before it calls the bootstrap callback of createPrismStore, and the
 * promise continues after that callback, so the undo history is clear by then.
 */
function settle({ persistor }: Created): Promise<void> {
  // A subscription waits for the bootstrap itself. A poll with vi.waitFor gave up after its own
  // timeout on a busy machine.
  return new Promise((resolve) => {
    const resolveWhenBootstrapped = () => {
      if (!persistor.getState().bootstrapped) return;
      unsubscribe();
      resolve();
    };
    const unsubscribe = persistor.subscribe(resolveWhenBootstrapped);
    resolveWhenBootstrapped();
  });
}

function present({ store }: Created): WorkspaceState {
  return store.getState().workspace.present;
}

function persistMeta({ store }: Created): PersistMeta | undefined {
  return store.getState().workspace._persist;
}

function history({ store }: Created) {
  const { past, future } = store.getState().workspace;
  return { past, future };
}

describe('createPrismStore', () => {
  describe('undo history after rehydration', () => {
    it('starts with an empty undo history and persistence armed (memory storage)', async () => {
      const created = createStore();
      await settle(created);

      expect(history(created).past).toHaveLength(0);
      expect(history(created).future).toHaveLength(0);
      expect(selectCanUndo(created.store.getState())).toBe(false);
      expect(selectCanRedo(created.store.getState())).toBe(false);
      expect(persistMeta(created)?.rehydrated).toBe(true);
      expect(present(created).tabs).toHaveLength(1);

      created.cleanup();
    });

    it('treats undo right after load as a no-op and keeps persistence armed', async () => {
      const created = createStore();
      await settle(created);
      const before = created.store.getState().workspace;

      created.store.dispatch(undo());

      expect(created.store.getState().workspace).toBe(before);
      expect(persistMeta(created)?.rehydrated).toBe(true);

      created.cleanup();
    });

    it('restores a saved workspace that undo cannot wipe', async () => {
      const saved = savedWorkspace();
      const { storage, data } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const created = createStore({ storage });
      await settle(created);

      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a', 'tab-b']);
      expect(present(created).favoriteLayouts).toEqual(['home']);
      expect(history(created).past).toHaveLength(0);
      expect(selectCanUndo(created.store.getState())).toBe(false);

      // The old symptom: undo straight after load used to land on the pre-persist
      // state, wiping the restored tabs...
      created.store.dispatch(undo());
      created.store.dispatch(undo());

      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a', 'tab-b']);
      expect(persistMeta(created)?.rehydrated).toBe(true);

      // ...and, because that state had `_persist.rehydrated === false`, redux-persist
      // stopped writing for the rest of the session. Prove writes still land.
      created.store.dispatch(renameTab({ tabId: 'tab-a', name: 'Renamed' }));
      await created.persistor.flush();
      const stored = JSON.parse(data.get(STORAGE_KEY) ?? '{}') as Record<string, string>;
      const storedTabs = (JSON.parse(stored.present) as WorkspaceState).tabs;
      expect(storedTabs.map((t) => [t.id, t.name])).toEqual([
        ['tab-a', 'Renamed'],
        ['tab-b', 'Beta'],
      ]);

      created.cleanup();
    });

    it('lets the first user action after load be undone back to the restored workspace', async () => {
      const saved = savedWorkspace();
      const { storage, data } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const created = createStore({ storage });
      await settle(created);

      created.store.dispatch(removeTab({ tabId: 'tab-b' }));
      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a']);
      expect(selectCanUndo(created.store.getState())).toBe(true);
      expect(history(created).past).toHaveLength(1);

      created.store.dispatch(undo());
      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a', 'tab-b']);
      expect(present(created).activeTabIds).toEqual(saved.activeTabIds);
      expect(selectCanUndo(created.store.getState())).toBe(false);
      expect(selectCanRedo(created.store.getState())).toBe(true);
      // Rehydration completed. `_persist` now sits outside the undo history, so
      // an undo can no longer clear this marker and stop all further writes.
      expect(persistMeta(created)?.rehydrated).toBe(true);

      created.store.dispatch(redo());
      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a']);
      created.store.dispatch(undo());

      // Persistence is still live after a normal undo/redo cycle: the next change
      // lands in storage together with the restored tab.
      created.store.dispatch(renameTab({ tabId: 'tab-a', name: 'Renamed' }));
      await created.persistor.flush();
      const stored = JSON.parse(data.get(STORAGE_KEY) ?? '{}') as Record<string, string>;
      const storedTabs = (JSON.parse(stored.present) as WorkspaceState).tabs;
      expect(storedTabs.map((t) => [t.id, t.name])).toEqual([
        ['tab-a', 'Renamed'],
        ['tab-b', 'Beta'],
      ]);

      created.cleanup();
    });

    it('keeps recording ordinary actions after load', async () => {
      const created = createStore();
      await settle(created);
      const tabId = present(created).tabs[0].id;

      created.store.dispatch(renameTab({ tabId, name: 'First' }));
      created.store.dispatch(renameTab({ tabId, name: 'Second' }));

      // Consecutive renames are grouped into one undo step by groupBy.
      expect(history(created).past).toHaveLength(1);
      created.store.dispatch(undo());
      expect(present(created).tabs[0].name).toBe('New Tab');

      created.cleanup();
    });

    it('does not record ui request actions', async () => {
      const created = createStore();
      await settle(created);
      const { id: tabId, panelId } = present(created).tabs[0];

      // activateTab is excluded from the history. Without `syncFilter: true` it would leave
      // redux-undo's latest unfiltered state behind the present state, and the next ui action
      // would enter the history.
      await created.store.dispatch(addTab({ panelId }));
      created.store.dispatch(activateTab({ tabId, panelId }));
      expect(history(created).past).toHaveLength(1);

      // The undoable reducer sees every action. A ui action leaves the workspace unchanged,
      // so redux-undo adds no history entry.
      created.store.dispatch(requestLayoutSelection({ tabId, layoutId: 'home' }));
      created.store.dispatch(requestSearchFocus({ panelId }));
      created.store.dispatch(startRenameTab({ tabId }));

      expect(history(created).past).toHaveLength(1);
      expect(selectLayoutSelectionRequest(created.store.getState())).toEqual({
        tabId,
        layoutId: 'home',
      });
      expect(selectSearchFocusPanelId(created.store.getState())).toBe(panelId);

      created.cleanup();
    });

    it('does not record redux-persist lifecycle actions (flush, pause, purge)', async () => {
      const { storage } = createFakeStorage();
      const created = createStore({ storage });
      await settle(created);
      const tabId = present(created).tabs[0].id;

      await created.persistor.flush();
      created.persistor.pause();
      await created.persistor.purge();
      created.persistor.persist();

      expect(history(created).past).toHaveLength(0);
      expect(history(created).future).toHaveLength(0);
      expect(present(created).tabs[0].id).toBe(tabId);

      created.cleanup();
    });

    it('clears history recorded by any action dispatched before rehydration finished', async () => {
      const created = createStore();
      // REHYDRATE is still pending in the microtask queue here.
      created.store.dispatch(renameTab({ tabId: present(created).tabs[0].id, name: 'Early' }));
      expect(history(created).past).toHaveLength(1);

      await settle(created);

      expect(present(created).tabs[0].name).toBe('Early');
      expect(history(created).past).toHaveLength(0);
      expect(selectCanUndo(created.store.getState())).toBe(false);

      created.cleanup();
    });

    it('clears history recorded before rehydration finished (corrupt persisted state)', async () => {
      // activePanelId does not name a leaf panel, so validateWorkspace rejects the
      // payload and validationMiddleware resets the workspace during REHYDRATE.
      const corrupt = savedWorkspace({ activePanelId: 'does-not-exist' });
      const { storage } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(corrupt) });
      const created = createStore({ storage });
      await settle(created);

      // Reset to a fresh single-tab workspace...
      expect(present(created).tabs).toHaveLength(1);
      expect(present(created).tabs[0].name).toBe('New Tab');
      // ...and the corrupt state is not one undo away.
      expect(history(created).past).toHaveLength(0);
      expect(selectCanUndo(created.store.getState())).toBe(false);
      created.store.dispatch(undo());
      expect(present(created).tabs).toHaveLength(1);
      expect(persistMeta(created)?.rehydrated).toBe(true);

      created.cleanup();
    });
  });

  describe('persisted format and undo persistence', () => {
    it('writes the result of an undo to storage immediately', async () => {
      const saved = savedWorkspace();
      const { storage, data } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const created = createStore({ storage });
      await settle(created);

      created.store.dispatch(removeTab({ tabId: 'tab-b' }));
      await created.persistor.flush();
      expect(storedTabIds(data)).toEqual(['tab-a']);

      // Regression: redux-undo skips the wrapped reducer on UNDO, so with
      // persistReducer on the inside the undone state was never written until
      // the next ordinary action, and a reload right after an undo lost it.
      created.store.dispatch(undo());
      await created.persistor.flush();
      expect(storedTabIds(data)).toEqual(['tab-a', 'tab-b']);

      created.store.dispatch(redo());
      await created.persistor.flush();
      expect(storedTabIds(data)).toEqual(['tab-a']);

      created.cleanup();
    });

    it('stores only the present workspace, never the undo history', async () => {
      const { storage, data } = createFakeStorage();
      const created = createStore({ storage });
      await settle(created);
      created.store.dispatch(renameTab({ tabId: present(created).tabs[0].id, name: 'One' }));
      created.store.dispatch(renameTab({ tabId: present(created).tabs[0].id, name: 'Two' }));
      await created.persistor.flush();

      const stored = JSON.parse(data.get(STORAGE_KEY) ?? '{}') as Record<string, string>;
      expect(Object.keys(stored).sort()).toEqual(['_persist', 'present']);
      expect(JSON.parse(stored._persist)).toMatchObject({ version: 2 });
      expect((JSON.parse(stored.present) as WorkspaceState).tabs[0].name).toBe('Two');

      created.cleanup();
    });

    it('migrates a version 1 flat payload written by 0.9.x', async () => {
      const saved = savedWorkspace(); // flat, _persist.version 1
      const { storage, data } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const created = createStore({ storage });
      await settle(created);

      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a', 'tab-b']);
      expect(present(created).favoriteLayouts).toEqual(['home']);
      expect(persistMeta(created)).toMatchObject({ version: 2, rehydrated: true });

      // The next write uses the new format
      created.store.dispatch(renameTab({ tabId: 'tab-a', name: 'Migrated' }));
      await created.persistor.flush();
      const stored = JSON.parse(data.get(STORAGE_KEY) ?? '{}') as Record<string, string>;
      expect('tabs' in stored).toBe(false);
      expect((JSON.parse(stored.present) as WorkspaceState).tabs[0].name).toBe('Migrated');

      created.cleanup();
    });

    it('loads a version 2 payload', async () => {
      const { _persist, ...presentOnly } = savedWorkspace();
      const { storage } = createFakeStorage({ [STORAGE_KEY]: serialiseV2(presentOnly) });
      const created = createStore({ storage });
      await settle(created);

      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a', 'tab-b']);
      expect(history(created).past).toHaveLength(0);

      created.cleanup();
    });
  });

  describe('server session reconciliation on load', () => {
    it('closes tabs whose layouts are gone when the persisted session id differs', async () => {
      const saved = savedWorkspace({ serverSessionId: 'old' });
      saved.tabs[1].layoutId = 'gone';
      const { storage } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const setProps = vi.fn();
      const created = createStore({
        storage,
        serverSessionId: 'new',
        registeredLayouts: LAYOUTS,
        setProps,
      });
      await settle(created);

      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a']);
      expect(present(created).serverSessionId).toBe('new');
      // The pruning happened before the undo baseline was reset
      expect(history(created).past).toHaveLength(0);
      expect(selectCanUndo(created.store.getState())).toBe(false);
      // ...and the UI is told how many tabs were closed so it can toast once mounted
      expect(created.store.getState().ui.loadNotice).toEqual({ closedTabs: 1 });
      // The first sync to Dash already carries the pruned workspace
      const firstSync = setProps.mock.calls[0][0] as { readWorkspace: WorkspaceState };
      expect(firstSync.readWorkspace.tabs.map((t) => t.id)).toEqual(['tab-a']);

      created.cleanup();
    });

    it('resets corrupt persisted state before reconciling (middleware order)', async () => {
      // Corrupt (activePanelId names no leaf) AND referencing an unknown layout.
      // validationMiddleware's post-step must run before reconcile's: the reset
      // workspace has nothing to prune, so no load notice is recorded. If the
      // order were inverted, reconcile would prune the corrupt payload first and
      // leave a notice about tabs that the reset then discarded anyway.
      const corrupt = savedWorkspace({
        activePanelId: 'does-not-exist',
        serverSessionId: 'old',
      });
      corrupt.tabs[0].layoutId = 'gone';
      const { storage } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(corrupt) });
      const created = createStore({ storage, serverSessionId: 'new', registeredLayouts: LAYOUTS });
      await settle(created);

      expect(present(created).tabs).toHaveLength(1);
      expect(present(created).tabs[0].name).toBe('New Tab');
      expect(present(created).serverSessionId).toBe('new');
      expect(created.store.getState().ui.loadNotice).toBeNull();
      expect(history(created).past).toHaveLength(0);

      created.cleanup();
    });

    it('rejects a persisted serverSessionId that is not a string', async () => {
      const saved = savedWorkspace({ serverSessionId: 42 as unknown as string });
      const { storage } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const created = createStore({ storage, serverSessionId: 'v1', registeredLayouts: LAYOUTS });
      await settle(created);

      // validateWorkspace failed -> fresh workspace, then the id is recorded
      expect(present(created).tabs).toHaveLength(1);
      expect(present(created).tabs[0].name).toBe('New Tab');
      expect(present(created).serverSessionId).toBe('v1');

      created.cleanup();
    });

    it('keeps a workspace whose session id matches and whose layouts all exist', async () => {
      const saved = savedWorkspace({ serverSessionId: 'same' });
      const { storage } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const created = createStore({ storage, serverSessionId: 'same', registeredLayouts: LAYOUTS });
      await settle(created);

      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a', 'tab-b']);
      expect(present(created).serverSessionId).toBe('same');
      expect(created.store.getState().ui.loadNotice).toBeNull();

      created.cleanup();
    });

    it('still closes tabs for unknown layouts when the session id matches', async () => {
      const saved = savedWorkspace({ serverSessionId: 'same' });
      saved.tabs[0].layoutId = 'gone';
      const { storage } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const created = createStore({ storage, serverSessionId: 'same', registeredLayouts: LAYOUTS });
      await settle(created);

      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-b']);

      created.cleanup();
    });

    it('records the session id on a fresh workspace (memory persistence)', async () => {
      const created = createStore({ serverSessionId: 'v1', registeredLayouts: LAYOUTS });
      await settle(created);

      expect(present(created).serverSessionId).toBe('v1');
      expect(present(created).tabs).toHaveLength(1);
      expect(history(created).past).toHaveLength(0);

      created.cleanup();
    });

    it('does not prune anything when no layouts are registered', async () => {
      const saved = savedWorkspace({ serverSessionId: 'old' });
      const { storage } = createFakeStorage({ [STORAGE_KEY]: serialisePersisted(saved) });
      const created = createStore({ storage, serverSessionId: 'new' });
      await settle(created);

      expect(present(created).tabs.map((t) => t.id)).toEqual(['tab-a', 'tab-b']);

      created.cleanup();
    });
  });

  describe('maxTabs read through a getter', () => {
    it('applies a limit changed after the store was created', async () => {
      let limit = 1;
      const created = createStore({ maxTabs: () => limit });
      await settle(created);
      const panelId = present(created).activePanelId;

      const rejected = await created.store.dispatch(addTab({ panelId }));
      expect(addTab.rejected.match(rejected)).toBe(true);
      expect(present(created).tabs).toHaveLength(1);

      // Prism updates a ref when the maxTabs prop changes; the store itself is
      // never rebuilt, so the undo history and pending sync survive.
      limit = 2;
      const fulfilled = await created.store.dispatch(addTab({ panelId }));
      expect(addTab.fulfilled.match(fulfilled)).toBe(true);
      expect(present(created).tabs).toHaveLength(2);

      created.cleanup();
    });

    it('still accepts a plain number', async () => {
      const created = createStore({ maxTabs: 1 });
      await settle(created);
      const panelId = present(created).activePanelId;

      const rejected = await created.store.dispatch(addTab({ panelId }));
      expect(addTab.rejected.match(rejected)).toBe(true);

      created.cleanup();
    });
  });

  describe('maxPanels read through a getter', () => {
    it('applies a limit changed after the store was created', async () => {
      let limit = 1;
      const created = createStore({ maxPanels: () => limit });
      await settle(created);
      const panelId = present(created).activePanelId;
      await created.store.dispatch(addTab({ panelId }));
      const tabId = present(created).tabs[1].id;

      const rejected = await created.store.dispatch(
        splitPanel({ panelId, direction: 'horizontal', tabId })
      );
      expect(splitPanel.rejected.match(rejected)).toBe(true);

      limit = 2;
      await created.store.dispatch(splitPanel({ panelId, direction: 'horizontal', tabId }));
      expect(present(created).panelTabs[panelId]).not.toContain(tabId);

      created.cleanup();
    });
  });

  describe('splitPanel in the undo history', () => {
    it('records one entry for a split, none for a refused split, and undoes to the old panel', async () => {
      const created = createStore({ maxPanels: 2 });
      await settle(created);
      const panelId = present(created).activePanelId;
      await created.store.dispatch(addTab({ panelId }));
      await created.store.dispatch(addTab({ panelId }));
      const [, tabB, tabC] = present(created).tabs;
      const pastBefore = history(created).past.length;

      await created.store.dispatch(
        splitPanel({ panelId, direction: 'horizontal', tabId: tabB.id })
      );
      expect(history(created).past).toHaveLength(pastBefore + 1);

      // The workspace is at the limit of two panels now.
      const refused = await created.store.dispatch(
        splitPanel({ panelId, direction: 'horizontal', tabId: tabC.id })
      );
      expect(splitPanel.rejected.match(refused)).toBe(true);
      expect(history(created).past).toHaveLength(pastBefore + 1);

      created.store.dispatch(undo());
      expect(present(created).panelTabs[panelId]).toContain(tabB.id);
      expect(present(created).tabs.find((t) => t.id === tabB.id)?.panelId).toBe(panelId);

      created.cleanup();
    });

    it('lets only one of two splits in the same tick pass the limit', async () => {
      const created = createStore({ maxPanels: 2 });
      await settle(created);
      const panelId = present(created).activePanelId;
      await created.store.dispatch(addTab({ panelId }));
      await created.store.dispatch(addTab({ panelId }));
      const [, tabB, tabC] = present(created).tabs;

      await Promise.all([
        created.store.dispatch(splitPanel({ panelId, direction: 'horizontal', tabId: tabB.id })),
        created.store.dispatch(splitPanel({ panelId, direction: 'horizontal', tabId: tabC.id })),
      ]);

      expect(Object.keys(present(created).panelTabs)).toHaveLength(2);

      created.cleanup();
    });

    it('skips a split whose panel an earlier split in the same tick removed', async () => {
      const created = createStore();
      await settle(created);
      const firstPanelId = present(created).activePanelId;
      await created.store.dispatch(addTab({ panelId: firstPanelId }));
      await created.store.dispatch(addTab({ panelId: firstPanelId }));
      const [, tabB, tabC] = present(created).tabs;
      await created.store.dispatch(
        splitPanel({ panelId: firstPanelId, direction: 'horizontal', tabId: tabB.id })
      );
      const secondPanelId = present(created).activePanelId;

      // The first split moves the only tab out of the second panel, so the second panel closes.
      await Promise.all([
        created.store.dispatch(
          splitPanel({ panelId: firstPanelId, direction: 'horizontal', tabId: tabB.id })
        ),
        created.store.dispatch(
          splitPanel({ panelId: secondPanelId, direction: 'horizontal', tabId: tabC.id })
        ),
      ]);

      expect(present(created).panelTabs[secondPanelId]).toBeUndefined();
      expect(present(created).panelTabs[firstPanelId]).toContain(tabC.id);

      created.cleanup();
    });
  });

  describe('selectIsSingleTabMode', () => {
    it('is true only for one tab in one panel', async () => {
      const created = createStore();
      await settle(created);
      const panelId = present(created).activePanelId;
      expect(selectIsSingleTabMode(created.store.getState())).toBe(true);

      await created.store.dispatch(addTab({ panelId }));
      expect(selectIsSingleTabMode(created.store.getState())).toBe(false);

      const tabId = present(created).tabs[1].id;
      await created.store.dispatch(splitPanel({ panelId, direction: 'horizontal', tabId }));
      expect(selectIsSingleTabMode(created.store.getState())).toBe(false);

      created.cleanup();
    });
  });

  describe('canAddPanel', () => {
    it('treats a limit below 1 as unlimited', () => {
      expect(canAddPanel(5, 0)).toBe(true);
      expect(canAddPanel(5, -1)).toBe(true);
    });

    it('allows a panel only below the limit', () => {
      expect(canAddPanel(1, 2)).toBe(true);
      expect(canAddPanel(2, 2)).toBe(false);
    });
  });

  describe('toasts of two stores', () => {
    it('sends the toast of a thunk to the Toaster of its own Prism instance', async () => {
      vi.mocked(toast.warning).mockClear();
      const first = createStore({ componentId: 'prism-a', maxTabs: 1 });
      const second = createStore({ componentId: 'prism-b', maxTabs: 1 });
      await settle(first);
      await settle(second);

      await second.store.dispatch(addTab({ panelId: present(second).activePanelId }));

      expect(toast.warning).toHaveBeenCalledTimes(1);
      expect(toast.warning).toHaveBeenCalledWith(
        'Maximum tabs limit reached (1)',
        expect.objectContaining({ toasterId: 'prism-b' })
      );

      first.cleanup();
      second.cleanup();
    });
  });

  describe('Dash sync on load', () => {
    it('pushes the workspace to Dash exactly once when rehydration completes', async () => {
      const setProps = vi.fn();
      const created = createStore({ setProps });
      await settle(created);

      expect(setProps).toHaveBeenCalledTimes(1);
      const payload = setProps.mock.calls[0][0] as { readWorkspace: WorkspaceState };
      expect(payload.readWorkspace.tabs).toHaveLength(1);
      expect(payload.readWorkspace.panelTabs).toEqual(present(created).panelTabs);

      created.cleanup();
    });
  });
});
