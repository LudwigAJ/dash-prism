import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './index';

/**
 * Gives the typed dispatch function. Use it instead of plain useDispatch.
 *
 * @example
 * ```tsx
 * const dispatch = useAppDispatch();
 * dispatch(addTab({ panelId: 'abc', name: 'New Tab' }));
 * ```
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/**
 * Reads state with a typed selector. Use it instead of plain useSelector.
 *
 * @example
 * ```tsx
 * const tabs = useAppSelector(selectTabs);
 * const activePanelId = useAppSelector(selectActivePanelId);
 * ```
 */
export const useAppSelector = useSelector.withTypes<RootState>();
