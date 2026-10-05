import React, { useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@components/ui/card';
import { useConfig } from '@context/ConfigContext';
import { cn } from '@utils/cn';
import { Layers } from 'lucide-react';
import { FavoriteStar } from '@components/FavoriteStar';
import type { LayoutMeta, TabId } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectFavoriteLayouts,
  toggleFavoriteLayout,
  requestLayoutSelection,
} from '@store';

/** Holds the props of `LayoutPicker`. */
interface LayoutPickerProps {
  tabId: TabId;
}

/** Holds the props of `LayoutCard`. */
interface LayoutCardProps {
  id: string;
  meta: LayoutMeta;
  isFavorite: boolean;
  onLayoutClick: (layoutId: string) => void;
  onToggleFavorite: (layoutId: string) => void;
}

/** Holds the props of `LayoutSection`. */
interface LayoutSectionProps {
  title: string;
  entries: Array<[string, LayoutMeta]>;
  favoriteLayouts: string[];
  onLayoutClick: (layoutId: string) => void;
  onToggleFavorite: (layoutId: string) => void;
}

// Defined at module level so React sees a stable component identity across renders.
// Defining inside LayoutPicker would cause unmount/remount on every re-render,
// replacing DOM nodes and swallowing in-flight click events.
function LayoutCard({ id, meta, isFavorite, onLayoutClick, onToggleFavorite }: LayoutCardProps) {
  return (
    <article data-testid={`prism-layout-card-${id}`} className="tw:flex">
      <Card
        className={cn(
          'tw:relative tw:flex tw:min-w-0 tw:flex-1 tw:flex-col',
          'tw:transition-colors tw:hover:border-accent tw:hover:shadow-md'
        )}
      >
        <CardHeader className="tw:flex-1 tw:pr-10 tw:pb-2">
          <CardTitle className="tw:text-[1.15em]">
            {/* The ::after element covers the whole card, so a click anywhere on the card opens the layout. */}
            <button
              type="button"
              data-testid={`prism-layout-card-open-${id}`}
              onClick={() => onLayoutClick(id)}
              className={cn(
                'tw:cursor-pointer tw:text-left tw:after:absolute tw:after:inset-0 tw:after:rounded-xl',
                'tw:focus-visible:outline-none tw:focus-visible:after:ring-2 tw:focus-visible:after:ring-ring tw:focus-visible:after:ring-inset'
              )}
            >
              {meta.name}
            </button>
          </CardTitle>
          {meta.description && (
            <CardDescription className="tw:line-clamp-3 tw:text-[1em]">
              {meta.description}
            </CardDescription>
          )}
        </CardHeader>
        {meta.params && meta.params.length > 0 && (
          <CardContent className="tw:pt-0">
            <p className="tw:text-[0.85em] tw:text-muted-foreground">
              {meta.params.length} parameter{meta.params.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        )}

        {/* The star follows the title in the focus order. It is a sibling, because a button cannot contain a button. */}
        <FavoriteStar
          layoutName={meta.name}
          isFavorite={isFavorite}
          onToggle={() => onToggleFavorite(id)}
          className="tw:absolute tw:top-2 tw:right-2 tw:z-10 tw:rounded-md tw:p-1.5 tw:focus-visible:ring-2"
          testId={`prism-layout-card-favorite-${id}`}
        />
      </Card>
    </article>
  );
}

/** Renders one titled grid of layout cards. */
function LayoutSection({
  title,
  entries,
  favoriteLayouts,
  onLayoutClick,
  onToggleFavorite,
}: LayoutSectionProps) {
  return (
    <section className="tw:mb-[2.3em] tw:last:mb-0">
      <h2 className="tw:mb-[1.1em] tw:text-[1em] tw:font-medium tw:tracking-wide tw:text-muted-foreground tw:uppercase">
        {title}
      </h2>
      <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(15em,1fr))] tw:gap-[1.1em]">
        {entries.map(([id, meta]) => (
          <LayoutCard
            key={id}
            id={id}
            meta={meta}
            isFavorite={favoriteLayouts.includes(id)}
            onLayoutClick={onLayoutClick}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Displays available layouts as cards for new/empty tabs.
 * Shows favorites at top, then remaining layouts.
 */
export function LayoutPicker({ tabId }: LayoutPickerProps) {
  const { registeredLayouts } = useConfig();
  const dispatch = useAppDispatch();
  const storedFavorites = useAppSelector(selectFavoriteLayouts);
  const favoriteLayouts = storedFavorites ?? [];
  const gridRef = useRef<HTMLDivElement>(null);
  const toggledLayoutIdRef = useRef<string | null>(null);

  // A card moves to the other section when the user toggles its star, and React mounts the
  // card again there. Without this effect the focus would fall back to the page.
  useEffect(() => {
    const layoutId = toggledLayoutIdRef.current;
    if (layoutId === null) return;
    toggledLayoutIdRef.current = null;
    const testId = `prism-layout-card-favorite-${CSS.escape(layoutId)}`;
    gridRef.current?.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
  }, [storedFavorites]);

  const layoutEntries = Object.entries(registeredLayouts);

  // Split into favorites and non-favorites
  const favoriteEntries = layoutEntries.filter(([id]) => favoriteLayouts.includes(id));
  const otherEntries = layoutEntries.filter(([id]) => !favoriteLayouts.includes(id));

  const handleToggleFavorite = (layoutId: string) => {
    toggledLayoutIdRef.current = layoutId;
    dispatch(toggleFavoriteLayout({ layoutId }));
  };

  const handleLayoutClick = (layoutId: string) => {
    dispatch(requestLayoutSelection({ tabId, layoutId }));
  };

  if (layoutEntries.length === 0) {
    return (
      <div
        data-testid="prism-empty-tab-no-layouts"
        className="tw:flex tw:h-full tw:items-center tw:justify-center tw:p-6"
      >
        <Card className="tw:w-full tw:max-w-md">
          <CardHeader>
            <div className="tw:flex tw:items-center tw:gap-2">
              <Layers className="tw:size-[1.25em] tw:text-muted-foreground" />
              <CardTitle>No Layouts Available</CardTitle>
            </div>
            <CardDescription>
              No layouts have been registered. Configure layouts in your Dash app.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      data-testid="prism-empty-tab-layouts"
      className="tw:flex tw:h-full tw:w-full tw:flex-col tw:overflow-auto tw:bg-background tw:p-[1.7em]"
    >
      {favoriteEntries.length > 0 && (
        <LayoutSection
          title="Favorites"
          entries={favoriteEntries}
          favoriteLayouts={favoriteLayouts}
          onLayoutClick={handleLayoutClick}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
      {otherEntries.length > 0 && (
        <LayoutSection
          title="Layouts"
          entries={otherEntries}
          favoriteLayouts={favoriteLayouts}
          onLayoutClick={handleLayoutClick}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
}
