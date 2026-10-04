import type { LayoutMeta } from '@types';

/**
 * Filters layouts based on a search query.
 * Searches across layout ID, name, description, and keywords.
 */
export function filterLayouts(
  layouts: Array<[string, LayoutMeta]>,
  query: string
): Array<[string, LayoutMeta]> {
  if (!query.trim()) return layouts;

  const lowerQuery = query.toLowerCase();

  return layouts.filter(
    ([id, meta]) =>
      id.toLowerCase().includes(lowerQuery) ||
      meta.name.toLowerCase().includes(lowerQuery) ||
      meta.description?.toLowerCase().includes(lowerQuery) ||
      meta.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))
  );
}

/** Checks whether the layout asks for parameters, so that the search bar must show the params step. */
export function layoutHasParams(layout: LayoutMeta): boolean {
  return (layout.params?.length ?? 0) > 0;
}

/** Checks whether the layout offers preset options, so that the search bar must show the options step. */
export function layoutHasOptions(layout: LayoutMeta): boolean {
  // Python sends null for a layout without options.
  return Object.keys(layout.paramOptions ?? {}).length > 0;
}
