// src/ts/store/middleware/reconcileMiddleware.ts
import { isAction, type Middleware } from '@reduxjs/toolkit';
import { REHYDRATE } from 'redux-persist';
import type { RegisteredLayouts } from '@types';
import type { RootState } from '../index';
import { reconcileWithServer } from '../workspaceSlice';
import { setLoadNotice } from '../uiSlice';

/**
 * After redux-persist has rehydrated the workspace, reconcile it with the
 * server: close tabs whose layouts no longer exist and record the current
 * `serverSessionId` (see `reconcileWithServer`).
 *
 * The dispatch happens inside the REHYDRATE dispatch, i.e. before redux-persist
 * reports `bootstrapped` and before the store resets the undo history, so the
 * pruning is never one undo away and PersistGate only ever shows the
 * reconciled workspace.
 *
 * Because nothing is mounted yet at that point (PersistGate still renders its
 * `loading` fallback, so neither the toast subscriber nor sonner's Toaster
 * exists), the number of closed tabs is parked in `ui.loadNotice`; the
 * `<LoadNotice />` component turns it into a toast once the UI is up.
 */
export function createReconcileMiddleware(
  getServerSessionId: () => string | undefined,
  getRegisteredLayouts: () => RegisteredLayouts
): Middleware<object, RootState> {
  return (store) => (next) => (action: unknown) => {
    const result = next(action);
    if (!isAction(action)) return result;

    if (action.type === REHYDRATE) {
      const before = new Set(store.getState().workspace.present.tabs.map((tab) => tab.id));
      store.dispatch(
        reconcileWithServer({
          serverSessionId: getServerSessionId(),
          registeredLayoutIds: Object.keys(getRegisteredLayouts()),
        })
      );
      const after = new Set(store.getState().workspace.present.tabs.map((tab) => tab.id));
      let closedTabs = 0;
      before.forEach((id) => {
        if (!after.has(id)) closedTabs += 1;
      });
      if (closedTabs > 0) {
        store.dispatch(setLoadNotice({ closedTabs }));
      }
    }

    return result;
  };
}
