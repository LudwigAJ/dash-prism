/**
 * Checks the layout metadata that Python sends against the TypeScript types.
 *
 * tests/fixtures/layout_meta.json is the output of `to_metadata()` for a set of
 * reference layouts. tests/test_registry.py fails when the Python output
 * changes. Vitest does not type-check, so two tools check the TypeScript side.
 * `pnpm run typecheck` fails when a value in the file has the wrong type or the
 * file does not fit an interface. The runtime tests here fail when a layout, a
 * parameter or an option has a key that its interface does not have, or lacks
 * one that it has, and when a `type` value is not a `ParamType`.
 */

import { describe, it, expect } from 'vitest';
import type { LayoutMeta, LayoutOption, LayoutParam, ParamType, RegisteredLayouts } from '@types';
// The fixture is not under src/ts, so no path alias reaches it.
import layoutMetaFixture from '../../../tests/fixtures/layout_meta.json';

// A JSON import types every string as `string`, so a field such as `type` cannot
// satisfy the `ParamType` union. This type widens each string in `RegisteredLayouts`
// in the same way, and the last test checks the members of `ParamType` at runtime.
type JsonShape<T> = T extends string
  ? string
  : T extends Array<infer Item>
    ? Array<JsonShape<Item>>
    : T extends object
      ? { [Key in keyof T]: JsonShape<T[Key]> }
      : T;

// This assignment is the compile-time check of the fixture against the types.
const fixture: JsonShape<RegisteredLayouts> = layoutMetaFixture;

const paramTypes: ParamType[] = [
  'string',
  'integer',
  'number',
  'boolean',
  'enum',
  'array',
  'object',
  'unknown',
];

// An object with every key of an interface. The compiler rejects a missing key
// and an extra key, so each list below follows its interface.
const paramKeys = Object.keys({
  name: '',
  hasDefault: false,
  default: null,
  annotation: null,
  type: 'string',
  required: false,
  nullable: false,
  choices: null,
  items: null,
  constraints: {},
  description: null,
  title: null,
  examples: null,
  placeholder: null,
} satisfies Required<LayoutParam>);

const metaKeys = Object.keys({
  name: '',
  description: '',
  keywords: [],
  allowMultiple: false,
  params: [],
  paramOptions: null,
} satisfies Required<LayoutMeta>);

const optionKeys = Object.keys({ description: '', params: {} } satisfies Required<LayoutOption>);

describe('layout_meta.json fixture', () => {
  const layouts = Object.values(fixture);
  const params = layouts.flatMap((layout) => layout.params ?? []);
  const options = layouts.flatMap((layout) => Object.values(layout.paramOptions ?? {}));

  it('covers a static layout, a callback layout and parameter options', () => {
    expect(layouts.length).toBeGreaterThan(1);
    expect(params.length).toBeGreaterThan(0);
    expect(options.length).toBeGreaterThan(0);
  });

  it('gives each layout exactly the keys of LayoutMeta', () => {
    for (const layout of layouts) {
      expect(Object.keys(layout).sort()).toEqual([...metaKeys].sort());
    }
  });

  it('gives each parameter exactly the keys of LayoutParam', () => {
    for (const param of params) {
      expect(Object.keys(param).sort()).toEqual([...paramKeys].sort());
    }
  });

  it('gives each parameter a type and an item type that ParamType allows', () => {
    for (const param of params) {
      expect(paramTypes).toContain(param.type);
      if (param.items) expect(paramTypes).toContain(param.items);
    }
  });

  it('gives each parameter option exactly the keys of LayoutOption', () => {
    for (const option of options) {
      expect(Object.keys(option).sort()).toEqual([...optionKeys].sort());
    }
  });
});
