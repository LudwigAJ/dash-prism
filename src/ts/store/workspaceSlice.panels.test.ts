// Tests for the panel reducers of workspaceSlice. The splitPanel thunk has its tests in
// workspaceThunks.test.ts.

import { describe, it, expect, vi } from 'vitest';
import { setActivePanel, resizePanel, pinPanel, unpinPanel, collapsePanel } from './workspaceSlice';
import { countLeafPanels } from '@utils/panels';
import {
  createTestStore,
  getTab,
  getWorkspace,
  makeWorkspace,
  PANEL_1,
  PANEL_2,
  ROOT_CONTAINER,
  TAB_1,
  TAB_2,
  TAB_3,
} from './testing';

describe('setActivePanel', () => {
  it('sets the active panel', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(setActivePanel({ panelId: PANEL_2 }));

    expect(getWorkspace(store).activePanelId).toBe(PANEL_2);
  });

  it('is a no-op when panel does not exist', () => {
    const store = createTestStore(makeWorkspace());
    const originalPanelId = getWorkspace(store).activePanelId;

    store.dispatch(setActivePanel({ panelId: 'nonexistent' }));

    // Should not change activePanelId when panel doesn't exist
    expect(getWorkspace(store).activePanelId).toBe(originalPanelId);
  });

  it('is a no-op for container panels (non-leaf)', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    const store = createTestStore(state);
    const originalPanelId = getWorkspace(store).activePanelId;

    // Try to set active panel to the container panel
    store.dispatch(setActivePanel({ panelId: ROOT_CONTAINER }));

    // Should not change since container-1 is not a leaf
    expect(getWorkspace(store).activePanelId).toBe(originalPanelId);
  });
});

describe('collapsePanel', () => {
  it('moves all tabs to remaining panel', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(collapsePanel({ panelId: PANEL_2 }));

    expect(getTab(store, TAB_3)?.panelId).toBe(PANEL_1);
    expect(getWorkspace(store).panelTabs[PANEL_1]).toContain(TAB_3);
  });

  it('cleans up collapsed panel state', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(collapsePanel({ panelId: PANEL_2 }));

    expect(getWorkspace(store).panelTabs[PANEL_2]).toBeUndefined();
    expect(getWorkspace(store).activeTabIds[PANEL_2]).toBeUndefined();
  });

  it('does not collapse last remaining panel', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(collapsePanel({ panelId: PANEL_1 }));

    expect(countLeafPanels(getWorkspace(store).panel)).toBe(1);
  });

  it('does nothing for a panel that does not exist', () => {
    const notify = vi.fn();
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]), { notify });
    const before = getWorkspace(store);

    store.dispatch(collapsePanel({ panelId: 'missing' }));

    expect(getWorkspace(store)).toBe(before);
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not toast when it refuses to close the last panel', () => {
    const notify = vi.fn();
    const store = createTestStore(makeWorkspace(), { notify });

    store.dispatch(collapsePanel({ panelId: PANEL_1 }));

    expect(notify).not.toHaveBeenCalled();
  });

  it('updates activePanelId to remaining panel', () => {
    const state = makeWorkspace([[TAB_1, TAB_2], [TAB_3]]);
    state.activePanelId = PANEL_2;
    const store = createTestStore(state);

    store.dispatch(collapsePanel({ panelId: PANEL_2 }));

    expect(getWorkspace(store).activePanelId).toBe(PANEL_1);
  });
});

describe('resizePanel', () => {
  it('updates panel size with string value', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(resizePanel({ panelId: PANEL_1, size: '30%' }));

    const panel1 = getWorkspace(store).panel.children.find((c) => c.id === PANEL_1);
    expect(panel1?.size).toBe('30%');
  });

  it('accepts numeric size values', () => {
    const store = createTestStore(makeWorkspace([[TAB_1, TAB_2], [TAB_3]]));

    store.dispatch(resizePanel({ panelId: PANEL_1, size: 300 }));

    const panel1 = getWorkspace(store).panel.children.find((c) => c.id === PANEL_1);
    expect(panel1?.size).toBe(300);
  });
});

describe('pinPanel / unpinPanel', () => {
  it('pinPanel sets pinned to true', () => {
    const store = createTestStore(makeWorkspace());

    store.dispatch(pinPanel({ panelId: PANEL_1 }));

    expect(getWorkspace(store).panel.pinned).toBe(true);
  });

  it('unpinPanel sets pinned to false', () => {
    const state = makeWorkspace();
    state.panel.pinned = true;
    const store = createTestStore(state);

    store.dispatch(unpinPanel({ panelId: PANEL_1 }));

    expect(getWorkspace(store).panel.pinned).toBe(false);
  });
});
