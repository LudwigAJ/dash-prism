// Tests for the actions of workspaceSlice that apply to the whole workspace: the initial state,
// resetWorkspace, the two toggles, syncWorkspace and reconcileWithServer. healWorkspace, which
// syncWorkspace calls, has its own tests in workspaceHeal.test.ts.

import { describe, it, expect, vi } from 'vitest';
import {
  createInitialWorkspaceState,
  reorderTab,
  toggleSearchBars,
  toggleFavoriteLayout,
  resetWorkspace,
  syncWorkspace,
  reconcileWithServer,
} from './workspaceSlice';
import type { WorkspaceState } from './types';
import {
  createTestStore,
  getWorkspace,
  makeTab,
  makeWorkspace,
  PANEL_1,
  PANEL_2,
  ROOT_CONTAINER,
  TAB_1,
  TAB_2,
  TAB_3,
} from './testing';

describe('createInitialWorkspaceState', () => {
  it('returns an internally consistent single-panel, single-tab state', () => {
    const s = createInitialWorkspaceState();

    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0].name).toBe('New Tab');
    expect(s.tabs[0].layoutId).toBeUndefined();
    expect(s.tabs[0].panelId).toBe(s.panel.id);
    expect(s.panel.children).toEqual([]);
    expect(s.panelTabs).toEqual({ [s.panel.id]: [s.tabs[0].id] });
    expect(s.activeTabIds).toEqual({ [s.panel.id]: s.tabs[0].id });
    expect(s.activePanelId).toBe(s.panel.id);
    expect(s.favoriteLayouts).toEqual([]);
    expect(s.searchBarsHidden).toBe(false);
  });

  it('returns fresh objects and fresh IDs on every call', () => {
    const a = createInitialWorkspaceState();
    const b = createInitialWorkspaceState();

    expect(a).not.toBe(b);
    expect(a.tabs[0].id).not.toBe(b.tabs[0].id);
    expect(a.tabs[0].mountKey).not.toBe(b.tabs[0].mountKey);
    expect(a.panel.id).not.toBe(b.panel.id);
  });

  it('computes createdAt at call time, not at module load', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const a = createInitialWorkspaceState();
      vi.setSystemTime(2_000);
      const b = createInitialWorkspaceState();

      expect(a.tabs[0].createdAt).toBe(1_000);
      expect(b.tabs[0].createdAt).toBe(2_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives two stores on the same page independent initial IDs', () => {
    const a = getWorkspace(createTestStore());
    const b = getWorkspace(createTestStore());

    expect(a.tabs[0].id).not.toBe(b.tabs[0].id);
    expect(a.panel.id).not.toBe(b.panel.id);
  });

  it('lets the slice module load when crypto.randomUUID is unavailable', async () => {
    // Regression: IDs used to be generated at module scope via crypto.randomUUID(),
    // which is undefined on plain-HTTP, non-localhost origins, so the bundle threw
    // while loading and window.dash_prism was never defined.
    vi.resetModules();
    vi.stubGlobal('crypto', undefined);
    try {
      const mod = await import('./workspaceSlice');
      const state = mod.createInitialWorkspaceState();
      expect(state.tabs[0].id).toMatch(/^[0-9a-f]{8}$/);
      expect(state.panel.id).toMatch(/^[0-9a-f]{8}$/);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  it('never generates IDs while the module is being evaluated', async () => {
    // Stricter than the crypto stub above: with the fallback generator in place a
    // module-scope call would no longer throw, so make the generator itself throw
    // during module evaluation. Importing must still succeed.
    vi.resetModules();
    vi.doMock('@utils/uuid', () => ({
      generateShortId: () => {
        throw new Error('generateShortId() called at module scope');
      },
    }));
    try {
      await expect(import('./workspaceSlice')).resolves.toBeDefined();
    } finally {
      vi.doUnmock('@utils/uuid');
      vi.resetModules();
    }
  });
});

describe('resetWorkspace', () => {
  it('resets state to a fresh initial workspace', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    state.favoriteLayouts = ['layout-1', 'layout-2'];
    state.searchBarsHidden = true;
    const store = createTestStore(state);

    store.dispatch(resetWorkspace());

    expect(getWorkspace(store).tabs.length).toBe(1);
    expect(getWorkspace(store).favoriteLayouts).toEqual([]);
    expect(getWorkspace(store).searchBarsHidden).toBe(false);
  });

  it('generates new tab and panel IDs instead of reusing the initial ones', () => {
    // No preloaded state: the reducer builds its own initial state lazily.
    const store = createTestStore();
    const before = getWorkspace(store);

    store.dispatch(resetWorkspace());
    const after = getWorkspace(store);

    expect(after.tabs).toHaveLength(1);
    expect(after.tabs[0].id).not.toBe(before.tabs[0].id);
    expect(after.tabs[0].mountKey).not.toBe(before.tabs[0].mountKey);
    expect(after.panel.id).not.toBe(before.panel.id);
    expect(after.panelTabs).toEqual({ [after.panel.id]: [after.tabs[0].id] });
    expect(after.activeTabIds).toEqual({ [after.panel.id]: after.tabs[0].id });
    expect(after.activePanelId).toBe(after.panel.id);
  });

  it('resets twice in a row without reusing IDs', () => {
    const store = createTestStore();
    store.dispatch(resetWorkspace());
    const first = getWorkspace(store);
    store.dispatch(resetWorkspace());
    const second = getWorkspace(store);

    expect(second.tabs[0].id).not.toBe(first.tabs[0].id);
    expect(second.panel.id).not.toBe(first.panel.id);
  });
});

describe('toggleSearchBars', () => {
  it('toggles searchBarsHidden', () => {
    const store = createTestStore(makeWorkspace());
    expect(getWorkspace(store).searchBarsHidden).toBe(false);

    store.dispatch(toggleSearchBars());
    expect(getWorkspace(store).searchBarsHidden).toBe(true);

    store.dispatch(toggleSearchBars());
    expect(getWorkspace(store).searchBarsHidden).toBe(false);
  });
});

describe('toggleFavoriteLayout', () => {
  it('adds layout to favorites', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(toggleFavoriteLayout({ layoutId: 'my-layout' }));

    expect(getWorkspace(store).favoriteLayouts).toContain('my-layout');
  });

  it('removes layout from favorites if already present', () => {
    const state = makeWorkspace();
    state.favoriteLayouts = ['my-layout'];
    const store = createTestStore(state);

    store.dispatch(toggleFavoriteLayout({ layoutId: 'my-layout' }));

    expect(getWorkspace(store).favoriteLayouts).not.toContain('my-layout');
  });
});

describe('syncWorkspace', () => {
  it('syncs partial workspace state from Dash', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(
      syncWorkspace({
        searchBarsHidden: true,
        favoriteLayouts: ['layout-1', 'layout-2'],
      })
    );

    expect(getWorkspace(store).searchBarsHidden).toBe(true);
    expect(getWorkspace(store).favoriteLayouts).toEqual(['layout-1', 'layout-2']);
  });

  it('preserves unsynced fields', () => {
    const store = createTestStore(makeWorkspace());
    const originalTabs = getWorkspace(store).tabs;

    store.dispatch(
      syncWorkspace({
        searchBarsHidden: true,
      })
    );

    expect(getWorkspace(store).tabs).toEqual(originalTabs);
  });

  it('removes tabs that reference non-existent panels', () => {
    const state = makeWorkspace();
    const store = createTestStore(state);
    const panelId = state.panel.id;

    // Sync tabs with one referencing a non-existent panel
    store.dispatch(
      syncWorkspace({
        tabs: [makeTab(TAB_1, panelId), makeTab(TAB_2, 'non-existent-panel')],
      })
    );

    // Should only have the valid tab
    expect(getWorkspace(store).tabs.length).toBe(1);
    expect(getWorkspace(store).tabs[0].id).toBe(TAB_1);
  });

  it('replaces stale ids in panelTabs with the tabs that exist', () => {
    const state = makeWorkspace();
    const store = createTestStore(state);
    const panelId = state.panel.id;

    // Sync with mismatched panelTabs
    store.dispatch(
      syncWorkspace({
        tabs: [makeTab('new-tab', panelId)],
        panelTabs: {
          [panelId]: ['wrong-tab-id'], // Doesn't match tabs
        },
      })
    );

    // The unknown id is dropped and the real tab is appended
    expect(getWorkspace(store).panelTabs[panelId]).toEqual(['new-tab']);
  });

  describe('panelTabs order', () => {
    /** Three tabs in one panel, created a-b-c but displayed c-a-b. */
    function createReorderedState(): WorkspaceState {
      return makeWorkspace([['tab-c', 'tab-a', 'tab-b']], {
        tabs: [makeTab('tab-a', PANEL_1), makeTab('tab-b', PANEL_1), makeTab('tab-c', PANEL_1)],
      });
    }

    it('keeps the order from the payload when a readWorkspace snapshot is echoed back', () => {
      const store = createTestStore(createReorderedState());
      const snapshot = getWorkspace(store);

      // What a Dash callback wired Input('readWorkspace') -> Output('updateWorkspace') sends
      store.dispatch(
        syncWorkspace({
          tabs: snapshot.tabs,
          panel: snapshot.panel,
          panelTabs: snapshot.panelTabs,
          activeTabIds: snapshot.activeTabIds,
          activePanelId: snapshot.activePanelId,
        })
      );

      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-a', 'tab-b']);
      expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe('tab-c');
    });

    it('survives a real reorderTab followed by a readWorkspace/updateWorkspace round trip', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));
      store.dispatch(reorderTab({ panelId: PANEL_1, fromIndex: 0, toIndex: 1 }));
      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);

      const snapshot = getWorkspace(store);
      store.dispatch(syncWorkspace({ ...snapshot }));

      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
      expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_3]);
    });

    it('keeps the current order when the payload does not include panelTabs', () => {
      const store = createTestStore(createReorderedState());

      store.dispatch(syncWorkspace({ searchBarsHidden: true }));

      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-a', 'tab-b']);
    });

    it('keeps the current order when only tabs are sent, appending new tabs at the end', () => {
      const state = createReorderedState();
      const store = createTestStore(state);
      const panelId = state.panel.id;

      store.dispatch(
        syncWorkspace({
          tabs: [...state.tabs, makeTab('tab-d', panelId)],
        })
      );

      expect(getWorkspace(store).panelTabs[panelId]).toEqual(['tab-c', 'tab-a', 'tab-b', 'tab-d']);
    });

    it('appends tabs missing from their panel list without reordering the rest', () => {
      const state = createReorderedState();
      state.panelTabs = { [PANEL_1]: ['tab-c', 'tab-a'] }; // tab-b missing
      const store = createTestStore(state);

      store.dispatch(syncWorkspace({ panelTabs: state.panelTabs }));

      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-a', 'tab-b']);
    });

    it('drops ids that are unknown, duplicated, or belong to another panel', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(
        syncWorkspace({
          panelTabs: {
            // tab-3 lives in panel-2 (tab.panelId wins), ghost does not exist, tab-1 twice
            [PANEL_1]: [TAB_3, 'ghost', TAB_2, TAB_1, TAB_1],
            [PANEL_2]: [],
          },
        })
      );

      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
      expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_3]);
    });

    it('tolerates a non-array per-panel value from updateWorkspace', () => {
      const store = createTestStore(createReorderedState());

      expect(() =>
        store.dispatch(syncWorkspace({ panelTabs: { [PANEL_1]: 'tab-a' as never } }))
      ).not.toThrow();

      // Malformed list: that panel is rebuilt from tabs order
      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-a', 'tab-b', 'tab-c']);
    });

    it('builds the list for a panel missing from the payload from tabs order', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(syncWorkspace({ panelTabs: { [PANEL_1]: [TAB_2, TAB_1] } }));

      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
      expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_3]);
    });

    it('drops panelTabs keys that are not leaf panels', () => {
      const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

      store.dispatch(
        syncWorkspace({
          panelTabs: {
            [PANEL_1]: [TAB_2, TAB_1],
            [PANEL_2]: [TAB_3],
            [ROOT_CONTAINER]: [TAB_1],
            'gone-panel': [TAB_3],
          },
        })
      );

      expect(Object.keys(getWorkspace(store).panelTabs).sort()).toEqual([PANEL_1, PANEL_2]);
      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual([TAB_2, TAB_1]);
      expect(getWorkspace(store).panelTabs[PANEL_2]).toEqual([TAB_3]);
    });

    it('falls back to the first displayed tab (not the first created) when the active tab disappears', () => {
      const state = createReorderedState();
      state.panelTabs = { [PANEL_1]: ['tab-b', 'tab-c', 'tab-a'] };
      state.activeTabIds = { [PANEL_1]: 'tab-b' };
      const store = createTestStore(state);

      store.dispatch(syncWorkspace({ tabs: state.tabs.filter((t) => t.id !== 'tab-b') }));

      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-a']);
      expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe('tab-c');
    });

    it('removes tabs from panelTabs when they are removed from tabs', () => {
      const state = createReorderedState();
      const store = createTestStore(state);

      store.dispatch(syncWorkspace({ tabs: state.tabs.filter((t) => t.id !== 'tab-a') }));

      expect(getWorkspace(store).panelTabs[PANEL_1]).toEqual(['tab-c', 'tab-b']);
      expect(getWorkspace(store).activeTabIds[PANEL_1]).toBe('tab-c');
    });
  });

  it('fixes activeTabIds referencing non-existent tabs', () => {
    const state = makeWorkspace();
    const store = createTestStore(state);
    const panelId = state.panel.id;

    // Sync with activeTabId pointing to non-existent tab
    store.dispatch(
      syncWorkspace({
        tabs: [makeTab('real-tab', panelId)],
        activeTabIds: {
          [panelId]: 'deleted-tab',
        },
      })
    );

    // Should fall back to first tab in panel
    expect(getWorkspace(store).activeTabIds[panelId]).toBe('real-tab');
  });

  it('fixes activePanelId referencing non-existent panel', () => {
    const state = makeWorkspace();
    const store = createTestStore(state);
    const panelId = state.panel.id;

    store.dispatch(
      syncWorkspace({
        activePanelId: 'non-existent',
      })
    );

    // Should fall back to first leaf panel
    expect(getWorkspace(store).activePanelId).toBe(panelId);
  });
});

describe('reconcileWithServer', () => {
  /** Two panels: panel-1 has a locked tab on layout 'gone' and a tab on 'home'; panel-2 one tab on 'gone'. */
  function createStaleState(): WorkspaceState {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    state.tabs[0].layoutId = 'gone';
    state.tabs[0].locked = true;
    state.tabs[1].layoutId = 'home';
    state.tabs[2].layoutId = 'gone';
    state.serverSessionId = 'old';
    return state;
  }

  it('is a no-op (same reference) when the id matches and every layout is known', () => {
    const state = createStaleState();
    state.serverSessionId = 'same';
    const store = createTestStore(state);
    const before = getWorkspace(store);

    store.dispatch(
      reconcileWithServer({ serverSessionId: 'same', registeredLayoutIds: ['gone', 'home'] })
    );

    expect(getWorkspace(store)).toBe(before);
  });

  it('records a new server session id without touching tabs when nothing is stale', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    const store = createTestStore(state);

    store.dispatch(reconcileWithServer({ serverSessionId: 'v1', registeredLayoutIds: ['home'] }));

    expect(getWorkspace(store).serverSessionId).toBe('v1');
    expect(getWorkspace(store).tabs.map((t) => t.id)).toEqual([TAB_1, TAB_2, TAB_3]);
  });

  it('closes tabs whose layout is no longer registered, locked ones included, without toasting from the reducer', () => {
    const notify = vi.fn();
    const store = createTestStore(createStaleState(), { notify });

    store.dispatch(reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] }));

    const ws = getWorkspace(store);
    expect(ws.tabs.map((t) => t.id)).toEqual([TAB_2]);
    // panel-2 lost its only tab and collapsed; panel-1 remains as the single leaf
    expect(Object.keys(ws.panelTabs)).toEqual([PANEL_1]);
    expect(ws.panelTabs[PANEL_1]).toEqual([TAB_2]);
    expect(ws.activeTabIds[PANEL_1]).toBe(TAB_2);
    expect(ws.activePanelId).toBe(PANEL_1);
    expect(ws.serverSessionId).toBe('new');
    // The toast is raised later by <LoadNotice /> from ui.loadNotice (set by the
    // reconcile middleware): during REHYDRATE nobody is subscribed yet.
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps the saved active panel when a different panel collapses', () => {
    const state = createStaleState();
    // panel-2 (only tab on 'gone') will collapse; the user had panel-1 focused.
    state.activePanelId = PANEL_1;
    state.tabs[0].layoutId = 'home';
    state.tabs[0].locked = false;
    const store = createTestStore(state);

    store.dispatch(reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] }));

    expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
  });

  it('moves focus when the active panel itself collapses', () => {
    const state = createStaleState();
    state.activePanelId = PANEL_2;
    state.tabs[0].layoutId = 'home';
    state.tabs[0].locked = false;
    const store = createTestStore(state);

    store.dispatch(reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: ['home'] }));

    expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
  });

  it('prunes unknown layouts even when the session id has not changed (safety net)', () => {
    const state = createStaleState();
    state.serverSessionId = 'same';
    const store = createTestStore(state);

    store.dispatch(reconcileWithServer({ serverSessionId: 'same', registeredLayoutIds: ['home'] }));

    expect(getWorkspace(store).tabs.map((t) => t.id)).toEqual([TAB_2]);
  });

  it('spawns a blank tab when every tab is closed', () => {
    const state = makeWorkspace();
    state.tabs[0].layoutId = 'gone';
    const store = createTestStore(state);

    store.dispatch(reconcileWithServer({ serverSessionId: 'v2', registeredLayoutIds: ['home'] }));

    const ws = getWorkspace(store);
    expect(ws.tabs).toHaveLength(1);
    expect(ws.tabs[0].layoutId).toBeUndefined();
    expect(ws.tabs[0].name).toBe('New Tab');
    expect(ws.panelTabs[state.panel.id]).toEqual([ws.tabs[0].id]);
    expect(ws.activeTabIds[state.panel.id]).toBe(ws.tabs[0].id);
  });

  it('keeps tabs that have no layout', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]); // no layoutIds at all
    const store = createTestStore(state);

    store.dispatch(reconcileWithServer({ serverSessionId: 'v1', registeredLayoutIds: ['home'] }));

    expect(getWorkspace(store).tabs).toHaveLength(3);
  });

  it('never prunes when the registry is empty (metadata may not be injected)', () => {
    const notify = vi.fn();
    const store = createTestStore(createStaleState(), { notify });

    store.dispatch(reconcileWithServer({ serverSessionId: 'new', registeredLayoutIds: [] }));

    expect(getWorkspace(store).tabs).toHaveLength(3);
    expect(getWorkspace(store).serverSessionId).toBe('new');
    expect(notify).not.toHaveBeenCalled();
  });
});
