/**
 * Unit tests for the client-side parameter pre-validation (doc 04 §3.7).
 * The server remains the source of truth; these mirror its coercion rules.
 */

import { describe, it, expect } from 'vitest';
import {
  checkParamInput,
  checkParams,
  filterChoices,
  formatParamHint,
  resolveEnumInput,
  stringifyParams,
} from './paramValidation';
import type { LayoutParam } from '@types';

function param(overrides: Partial<LayoutParam>): LayoutParam {
  return { name: 'p', hasDefault: false, ...overrides };
}

describe('checkParamInput', () => {
  it('omits an empty input when the param has a default (server applies it)', () => {
    expect(checkParamInput(param({ hasDefault: true, default: 5 }), '')).toEqual({
      ok: true,
      omit: true,
    });
    expect(checkParamInput(param({ hasDefault: true, default: 0 }), '  ')).toEqual({
      ok: true,
      omit: true,
    });
  });

  it('requires a value for a required param and accepts empty for nullable ones', () => {
    expect(checkParamInput(param({}), '')).toEqual({ ok: false, message: 'Required' });
    expect(checkParamInput(param({ nullable: true }), '')).toEqual({ ok: true, value: '' });
  });

  it('checks integers and numbers with their constraints', () => {
    const int = param({ type: 'integer', constraints: { minimum: 1, maximum: 100 } });
    expect(checkParamInput(int, '42')).toEqual({ ok: true, value: '42' });
    expect(checkParamInput(int, '4.2')).toEqual({ ok: false, message: 'Must be a whole number' });
    expect(checkParamInput(int, '0')).toEqual({ ok: false, message: 'Must be at least 1' });
    expect(checkParamInput(int, '101')).toEqual({ ok: false, message: 'Must be at most 100' });
    const num = param({ type: 'number', constraints: { exclusiveMinimum: 0 } });
    expect(checkParamInput(num, '0.5')).toEqual({ ok: true, value: '0.5' });
    expect(checkParamInput(num, '0')).toEqual({ ok: false, message: 'Must be greater than 0' });
    expect(checkParamInput(num, 'abc')).toEqual({ ok: false, message: 'Must be a number' });
  });

  it('checks booleans and enum membership', () => {
    expect(checkParamInput(param({ type: 'boolean' }), 'Yes').ok).toBe(true);
    expect(checkParamInput(param({ type: 'boolean' }), 'maybe')).toEqual({
      ok: false,
      message: 'Must be true or false',
    });
    const kind = param({ type: 'enum', choices: ['bar', 'line'] });
    expect(checkParamInput(kind, 'bar')).toEqual({ ok: true, value: 'bar' });
    expect(checkParamInput(kind, 'pie')).toEqual({
      ok: false,
      message: 'Must be one of: bar, line',
    });
  });

  it('checks string length and pattern, ignoring patterns the browser cannot compile', () => {
    const s = param({ type: 'string', constraints: { minLength: 2, maxLength: 3, pattern: '^a' } });
    expect(checkParamInput(s, 'ab')).toEqual({ ok: true, value: 'ab' });
    expect(checkParamInput(s, 'a')).toEqual({
      ok: false,
      message: 'Must have at least 2 characters',
    });
    expect(checkParamInput(s, 'abcd')).toEqual({
      ok: false,
      message: 'Must have at most 3 characters',
    });
    expect(checkParamInput(s, 'bb')).toEqual({ ok: false, message: 'Must match pattern ^a' });
    const py = param({ type: 'string', constraints: { pattern: '(?P<name>a)' } });
    expect(checkParamInput(py, 'zzz').ok).toBe(true);
  });

  it('splits arrays on commas and checks each item', () => {
    const tags = param({ type: 'array', items: 'integer', constraints: { maxLength: 2 } });
    expect(checkParamInput(tags, '1, 2')).toEqual({ ok: true, value: '1,2' });
    expect(checkParamInput(tags, '1, x')).toEqual({
      ok: false,
      message: '"x": Must be a whole number',
    });
    expect(checkParamInput(tags, '1,2,3')).toEqual({
      ok: false,
      message: 'Must have at most 2 items',
    });
  });

  it('leaves enum items to the server when the metadata carries no item choices', () => {
    // list[Literal['a', 'b']] reports items: 'enum' but no choices, because the
    // choices on the parameter describe whole values, not items. Checking each
    // item against that empty list rejected every value the callback accepts.
    const tags = param({ type: 'array', items: 'enum', choices: null });
    expect(checkParamInput(tags, 'a, b')).toEqual({ ok: true, value: 'a,b' });

    // A scalar enum still has its own choices and is still checked here.
    const kind = param({ type: 'enum', choices: ['bar', 'line'] });
    expect(checkParamInput(kind, 'pie')).toEqual({
      ok: false,
      message: 'Must be one of: bar, line',
    });
  });

  it('never blocks unknown or object types', () => {
    expect(checkParamInput(param({ type: 'unknown' }), 'anything').ok).toBe(true);
    expect(checkParamInput(param({ type: 'object' }), '{"a":1}').ok).toBe(true);
    expect(checkParamInput(param({}), 'legacy').ok).toBe(true);
  });
});

describe('formatParamHint', () => {
  it('describes enums, ranges, lengths and optionality', () => {
    expect(formatParamHint(param({ type: 'enum', choices: ['bar', 'line'] }))).toBe('bar | line');
    expect(
      formatParamHint(param({ type: 'integer', constraints: { minimum: 1, maximum: 100 } }))
    ).toBe('integer, 1-100');
    expect(
      formatParamHint(param({ type: 'string', constraints: { maxLength: 60 }, nullable: true }))
    ).toBe('string, len -60, optional');
    expect(formatParamHint(param({}))).toBe('');
  });
});

describe('checkParams', () => {
  const params: LayoutParam[] = [
    param({ name: 'country' }),
    param({ name: 'n', hasDefault: true, default: 10, type: 'integer' }),
  ];

  it('reports unknown fields, invalid values and missing required fields', () => {
    expect(checkParams(params, { country: 'SE', n: 'x', bogus: 1 })).toEqual([
      { field: 'n', message: 'Must be a whole number' },
      { field: 'bogus', message: 'Unknown parameter' },
    ]);
    expect(checkParams(params, {})).toEqual([{ field: 'country', message: 'Required' }]);
  });

  it('accepts a valid object, stringifying non-string values', () => {
    expect(checkParams(params, { country: 'SE', n: 5 })).toEqual([]);
    expect(checkParams(params, { country: 'SE', n: [1, 2] })).toEqual([
      { field: 'n', message: 'Must be a whole number' },
    ]);
  });
});

describe('resolveEnumInput / filterChoices', () => {
  const kind = param({ type: 'enum', choices: ['bar', 'line', 'scatter'] });

  it('accepts exact matches and unique prefixes, leaves ambiguous input alone', () => {
    expect(resolveEnumInput(kind, 'line')).toBe('line');
    expect(resolveEnumInput(kind, 'SC')).toBe('scatter');
    expect(resolveEnumInput(kind, 'b')).toBe('bar');
    expect(resolveEnumInput(kind, 'pie')).toBe('pie');
    expect(resolveEnumInput(kind, '')).toBe('');
    expect(resolveEnumInput(param({ type: 'string' }), 'li')).toBe('li');
  });

  it('narrows the choice list by substring', () => {
    expect(filterChoices(kind, '')).toEqual(['bar', 'line', 'scatter']);
    expect(filterChoices(kind, 'a')).toEqual(['bar', 'scatter']);
    expect(filterChoices(kind, 'zzz')).toEqual([]);
  });
});

describe('stringifyParams', () => {
  const params = [
    { name: 'n', type: 'integer', hasDefault: true, required: false },
    { name: 'country', type: 'string', hasDefault: false, required: true },
    { name: 'tags', type: 'array', hasDefault: true, required: false },
  ] as unknown as Parameters<typeof stringifyParams>[0];

  it('drops a blank value for a parameter that has a default', () => {
    // The search bar omits such a parameter so the callback's own default
    // applies; a share link must not turn it into an empty string instead.
    expect(stringifyParams(params, { n: '', country: 'SE' })).toEqual({ country: 'SE' });
  });

  it('keeps a blank value for a required parameter so the server reports it', () => {
    expect(stringifyParams(params, { country: '' })).toEqual({ country: '' });
  });

  it('joins a list and stringifies other scalars', () => {
    expect(stringifyParams(params, { tags: ['a', 'b'], n: 3, country: 'SE' })).toEqual({
      tags: 'a,b',
      n: '3',
      country: 'SE',
    });
  });

  it('treats null and undefined as blank', () => {
    expect(stringifyParams(params, { n: null, country: undefined })).toEqual({ country: '' });
  });
});
