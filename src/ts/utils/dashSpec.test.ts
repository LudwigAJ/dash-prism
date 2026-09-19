/**
 * Regression tests for buildDashSpec (02 B-3 / 01 §1.1).
 *
 * The Prism `layoutTimeout` prop used to be placed only inside `data`, while
 * PrismContent's client-side timer read the `layoutTimeout` prop, so the
 * client always timed out after the 30 s default.
 */

import { describe, it, expect } from 'vitest';
import { buildDashSpec, normalizeLayoutTimeout } from './dashSpec';

describe('buildDashSpec', () => {
  it('targets the PrismContent component with a pattern-matching object id', () => {
    const spec = buildDashSpec('tab-1', 'home', undefined, undefined, 30);

    expect(spec.namespace).toBe('dash_prism');
    expect(spec.type).toBe('PrismContent');
    expect(spec.props.id).toEqual({ type: 'prism-content', index: 'tab-1' });
  });

  it('passes the timeout both as the layoutTimeout prop and inside data', () => {
    const spec = buildDashSpec('tab-1', 'home', undefined, undefined, 45);

    expect(spec.props.layoutTimeout).toBe(45);
    expect(spec.props.data).toMatchObject({ tabId: 'tab-1', layoutId: 'home', timeout: 45 });
  });

  it('normalises unusable timeouts to the default on both the prop and data', () => {
    for (const bad of [null, 0, -5, Number.NaN, Number.POSITIVE_INFINITY, undefined, '30']) {
      const spec = buildDashSpec('t', 'home', undefined, undefined, bad as unknown as number);
      expect(spec.props.layoutTimeout).toBe(30);
      expect((spec.props.data as { timeout: number }).timeout).toBe(30);
    }
  });

  it('forwards layout params and option unchanged', () => {
    const params = { country: 'SE' };
    const spec = buildDashSpec('tab-2', 'chart', params, 'bar', 10);

    expect(spec.props.data).toEqual({
      tabId: 'tab-2',
      layoutId: 'chart',
      layoutParams: params,
      layoutOption: 'bar',
      timeout: 10,
    });
  });
});

describe('normalizeLayoutTimeout', () => {
  it('keeps finite positive numbers and falls back otherwise (matches _coerce_timeout)', () => {
    expect(normalizeLayoutTimeout(0.05)).toBe(0.05);
    expect(normalizeLayoutTimeout(45)).toBe(45);
    expect(normalizeLayoutTimeout(null)).toBe(30);
    expect(normalizeLayoutTimeout(0)).toBe(30);
    expect(normalizeLayoutTimeout(-1)).toBe(30);
    expect(normalizeLayoutTimeout(Number.NaN)).toBe(30);
    expect(normalizeLayoutTimeout(true)).toBe(30);
  });
});
