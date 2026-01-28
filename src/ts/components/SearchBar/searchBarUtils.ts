// src/ts/components/SearchBar/searchBarUtils.ts
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
