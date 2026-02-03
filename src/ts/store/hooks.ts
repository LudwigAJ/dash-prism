// src/ts/store/hooks.ts
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './index';

/**
 * Typed dispatch hook - use this instead of plain useDispatch
 *
 * @example
 * ```tsx
 * const dispatch = useAppDispatch();
 * dispatch(addTab({ panelId: 'abc', name: 'New Tab' }));
 * ```
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();

/**
 * Typed selector hook - use this instead of plain useSelector
 *
 * @example
 * ```tsx
 * const tabs = useAppSelector(selectTabs);
 * const activePanelId = useAppSelector(selectActivePanelId);
 * ```
 */
export const useAppSelector = useSelector.withTypes<RootState>();
