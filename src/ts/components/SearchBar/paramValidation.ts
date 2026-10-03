import type { LayoutParam, ParamType, ParamConstraints } from '@types';

export type ParamCheck =
  /** Submits `value` (always a string on the wire). */
  | { ok: true; value: string }
  /** Leaves the param out so the server applies the callback default. */
  | { ok: true; omit: true }
  | { ok: false; message: string };

const TRUE_WORDS = new Set(['true', '1', 'yes', 'on', 'y', 't']);
const FALSE_WORDS = new Set(['false', '0', 'no', 'off', 'n', 'f']);
const INTEGER_RE = /^[+-]?\d+$/;

function checkNumber(kind: 'integer' | 'number', raw: string, c: ParamConstraints): string | null {
  if (kind === 'integer' ? !INTEGER_RE.test(raw) : !Number.isFinite(Number(raw)) || raw === '') {
    return kind === 'integer' ? 'Must be a whole number' : 'Must be a number';
  }
  const n = Number(raw);
  if (c.minimum !== undefined && n < c.minimum) return `Must be at least ${c.minimum}`;
  if (c.exclusiveMinimum !== undefined && n <= c.exclusiveMinimum) {
    return `Must be greater than ${c.exclusiveMinimum}`;
  }
  if (c.maximum !== undefined && n > c.maximum) return `Must be at most ${c.maximum}`;
  if (c.exclusiveMaximum !== undefined && n >= c.exclusiveMaximum) {
    return `Must be less than ${c.exclusiveMaximum}`;
  }
  return null;
}

function checkLength(len: number, c: ParamConstraints, unit: string): string | null {
  if (c.minLength !== undefined && len < c.minLength) {
    return `Must have at least ${c.minLength} ${unit}`;
  }
  if (c.maxLength !== undefined && len > c.maxLength) {
    return `Must have at most ${c.maxLength} ${unit}`;
  }
  return null;
}

function checkScalar(type: ParamType, raw: string, param: LayoutParam): string | null {
  const c = param.constraints ?? {};
  switch (type) {
    case 'integer':
    case 'number':
      return checkNumber(type, raw, c);
    case 'boolean': {
      const w = raw.trim().toLowerCase();
      return TRUE_WORDS.has(w) || FALSE_WORDS.has(w) ? null : 'Must be true or false';
    }
    case 'enum': {
      const choices = param.choices ?? [];
      // An array of enum items (list[Literal[...]]) carries no item-level
      // choices in the metadata, so there is nothing here to check the item
      // against. The server knows the item type; let it answer, as we already
      // do for object and unknown.
      if (choices.length === 0) return null;
      return choices.some((ch) => String(ch) === raw)
        ? null
        : `Must be one of: ${choices.map(String).join(', ')}`;
    }
    case 'string': {
      const lengthError = checkLength(raw.length, c, 'characters');
      if (lengthError) return lengthError;
      if (c.pattern) {
        try {
          if (!new RegExp(c.pattern).test(raw)) return `Must match pattern ${c.pattern}`;
        } catch {
          /* invalid JS regex (e.g. Python-only syntax): let the server decide */
        }
      }
      return null;
    }
    case 'array':
    case 'object':
    case 'unknown':
    default:
      return null; // array / object / unknown: the server validates
  }
}

/**
 * Validates a single search-bar input against the parameter's simplified schema.
 * Pure function; mirrors the server's coercion rules but never blocks unknown types.
 */
export function checkParamInput(param: LayoutParam, rawInput: string): ParamCheck {
  const raw = rawInput.trim();
  const type = param.type ?? 'unknown';

  if (raw === '') {
    if (param.hasDefault) return { ok: true, omit: true };
    if (param.nullable) return { ok: true, value: '' };
    return { ok: false, message: 'Required' };
  }

  if (type === 'array') {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const lengthError = checkLength(parts.length, param.constraints ?? {}, 'items');
    if (lengthError) return { ok: false, message: lengthError };
    const itemType = param.items ?? 'unknown';
    for (const part of parts) {
      const itemError = checkScalar(itemType, part, { ...param, constraints: {} });
      if (itemError) return { ok: false, message: `"${part}": ${itemError}` };
    }
    return { ok: true, value: parts.join(',') };
  }

  const error = checkScalar(type, raw, param);
  return error ? { ok: false, message: error } : { ok: true, value: raw };
}

/** Short inline hint shown next to the input, e.g. "integer, 1-100" or "bar | line". */
export function formatParamHint(param: LayoutParam): string {
  const c = param.constraints ?? {};
  const parts: string[] = [];
  if (param.type === 'enum' && param.choices?.length) {
    return param.choices.map(String).join(' | ');
  }
  if (param.type && param.type !== 'unknown') parts.push(param.type);
  const lo = c.minimum ?? c.exclusiveMinimum;
  const hi = c.maximum ?? c.exclusiveMaximum;
  if (lo !== undefined || hi !== undefined) parts.push(`${lo ?? ''}-${hi ?? ''}`);
  if (c.minLength !== undefined || c.maxLength !== undefined) {
    parts.push(`len ${c.minLength ?? ''}-${c.maxLength ?? ''}`);
  }
  if (param.nullable) parts.push('optional');
  return parts.join(', ');
}

/**
 * Validates a whole params object (share links, updateWorkspace) against a layout's
 * param list. Returns one message per failing field; never throws.
 */
export function checkParams(
  params: LayoutParam[],
  values: Record<string, unknown>
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  const known = new Map(params.map((p) => [p.name, p]));
  for (const [name, value] of Object.entries(values)) {
    const param = known.get(name);
    if (!param) {
      errors.push({ field: name, message: 'Unknown parameter' });
      continue;
    }
    const raw = Array.isArray(value) ? value.map(String).join(',') : String(value ?? '');
    const result = checkParamInput(param, raw);
    if (result.ok === false) errors.push({ field: name, message: result.message });
  }
  for (const p of params) {
    if (!p.hasDefault && !(p.name in values)) errors.push({ field: p.name, message: 'Required' });
  }
  return errors;
}

/**
 * For enum params, map what the user typed to a choice: an exact match wins,
 * otherwise a unique case-insensitive prefix match. Returns the raw input when
 * nothing matches so the normal validation reports it.
 */
export function resolveEnumInput(param: LayoutParam, rawInput: string): string {
  const raw = rawInput.trim();
  const choices = (param.choices ?? []).map(String);
  if (param.type !== 'enum' || raw === '' || choices.includes(raw)) return raw;
  const lowered = raw.toLowerCase();
  const prefixed = choices.filter((c) => c.toLowerCase().startsWith(lowered));
  return prefixed.length === 1 ? prefixed[0] : raw;
}

/**
 * Choices to offer for an enum param, narrowed by what the user typed so far.
 * A param of any other type has no choice list.
 */
export function filterChoices(param: LayoutParam, rawInput: string): string[] {
  if (param.type !== 'enum') return [];
  const choices = (param.choices ?? []).map(String);
  const lowered = rawInput.trim().toLowerCase();
  if (!lowered) return choices;
  return choices.filter((c) => c.toLowerCase().includes(lowered));
}

/**
 * Moves the active choice one step through the list and wraps at both ends.
 * With no active choice, the first step down gives the first choice and the first step up
 * gives the last one. An empty list has no active choice.
 */
export function stepActiveChoice(
  choices: string[],
  active: string | null,
  step: 1 | -1
): string | null {
  if (choices.length === 0) return null;
  const index = active === null ? -1 : choices.indexOf(active);
  if (index === -1) return step === 1 ? choices[0] : choices[choices.length - 1];
  return choices[(index + step + choices.length) % choices.length];
}

/**
 * Turns share-link parameter values into the string map Prism sends to Dash.
 *
 * A blank value for a parameter that has a default means "leave it out" — the
 * same thing an empty input means in the search bar. Forwarding it as "" would
 * instead be validated as an empty value and rejected by the server.
 */
export function stringifyParams(
  params: LayoutParam[],
  values: Record<string, unknown>
): Record<string, string> {
  const optional = new Set(params.filter((p) => p.hasDefault).map((p) => p.name));
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    const text = Array.isArray(value) ? value.map(String).join(',') : String(value ?? '');
    if (text === '' && optional.has(name)) continue;
    out[name] = text;
  }
  return out;
}
