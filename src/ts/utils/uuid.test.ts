/**
 * Unit tests for generateShortId.
 *
 * Regression coverage: `crypto.randomUUID` only exists in secure
 * contexts, so the generator must degrade gracefully instead of throwing.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateShortId } from './uuid';

const HEX8 = /^[0-9a-f]{8}$/;

describe('generateShortId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available and returns its first 8 hex chars', () => {
    const randomUUID = vi.fn(() => '550e8400-e29b-41d4-a716-446655440000');
    const getRandomValues = vi.fn();
    vi.stubGlobal('crypto', { randomUUID, getRandomValues });

    expect(generateShortId()).toBe('550e8400');
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(getRandomValues).not.toHaveBeenCalled();
  });

  it('falls back to crypto.getRandomValues when randomUUID is missing (insecure context)', () => {
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      arr.set([0x01, 0xab, 0xff, 0x00]);
      return arr;
    });
    vi.stubGlobal('crypto', { getRandomValues });

    expect(generateShortId()).toBe('01abff00');
    expect(getRandomValues).toHaveBeenCalledTimes(1);
  });

  it('falls back to Math.random when crypto is unavailable entirely', () => {
    vi.stubGlobal('crypto', undefined);

    const id = generateShortId();
    expect(id).toMatch(HEX8);
  });

  it('always returns exactly 8 hex characters in every mode', () => {
    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr.fill(0) });
    expect(generateShortId()).toBe('00000000');

    vi.stubGlobal('crypto', { getRandomValues: (arr: Uint8Array) => arr.fill(0xff) });
    expect(generateShortId()).toBe('ffffffff');

    vi.stubGlobal('crypto', undefined);
    const mathRandom = vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(generateShortId()).toBe('00000000');
    mathRandom.mockReturnValue(0.999999);
    expect(generateShortId()).toBe('ffffffff');
    mathRandom.mockRestore();
  });

  it('generates distinct ids', () => {
    // 100 draws from a 32-bit space: collision probability ~1e-6 per run.
    const ids = new Set(Array.from({ length: 100 }, () => generateShortId()));
    expect(ids.size).toBe(100);
  });
});
