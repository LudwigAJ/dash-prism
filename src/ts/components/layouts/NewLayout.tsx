import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@components/ui/card';
import { useConfig } from '@context/ConfigContext';
import { cn } from '@utils/cn';
import { Star, Layers } from 'lucide-react';
import type { TabId } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectFavoriteLayouts,
  toggleFavoriteLayout,
} from '@store';

type NewLayoutProps = {
  tabId: TabId;
};

type LayoutCardProps = {
  id: string;
  meta: { name: string; description?: string; params?: Array<{ name: string }> };
  isFavorite: boolean;
  onLayoutClick: (layoutId: string) => void;
  onToggleFavorite: (e: React.MouseEvent, layoutId: string) => void;
};

// Defined at module level so React sees a stable component identity across renders.
// Defining inside NewLayout would cause unmount/remount on every re-render,
// replacing DOM nodes and swallowing in-flight click events.
function LayoutCard({ id, meta, isFavorite, onLayoutClick, onToggleFavorite }: LayoutCardProps) {
  return (
    <Card
      className={cn(
        'tw:relative tw:cursor-pointer tw:transition-colors tw:hover:border-accent tw:hover:shadow-md',
        'tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:outline-none tw:focus-visible:ring-inset',
        'tw:flex tw:flex-col'
      )}
      onClick={() => onLayoutClick(id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onLayoutClick(id);
        }
      }}
    >
      {/* Favorite star button */}
      <button
        type="button"
        onClick={(e) => onToggleFavorite(e, id)}
        className={cn(
          'tw:absolute tw:top-2 tw:right-2 tw:rounded-md tw:p-1.5 tw:transition-colors',
          'tw:hover:bg-muted tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:outline-none',
          isFavorite ? 'tw:text-primary' : 'tw:text-muted-foreground tw:hover:text-primary'
        )}
        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={cn('tw:size-[1em]', isFavorite && 'tw:fill-current')} />
      </button>

      <CardHeader className="tw:flex-1 tw:pr-10 tw:pb-2">
        <CardTitle className="tw:text-[1.15em]">{meta.name}</CardTitle>
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
    </Card>
  );
}

/**
 * Displays available layouts as cards for new/empty tabs.
 * Shows favorites at top, then remaining layouts.
 */
export function NewLayout({ tabId }: NewLayoutProps) {
  const { registeredLayouts } = useConfig();
  const dispatch = useAppDispatch();
  const favoriteLayouts = useAppSelector(selectFavoriteLayouts) ?? [];

  const layoutEntries = Object.entries(registeredLayouts);

  // Split into favorites and non-favorites
  const favoriteEntries = layoutEntries.filter(([id]) => favoriteLayouts.includes(id));
  const otherEntries = layoutEntries.filter(([id]) => !favoriteLayouts.includes(id));

  const handleToggleFavorite = (e: React.MouseEvent, layoutId: string) => {
    e.stopPropagation();
    dispatch(toggleFavoriteLayout({ layoutId }));
  };

  const handleLayoutClick = (layoutId: string) => {
    window.dispatchEvent(
      new CustomEvent('prism:select-layout', {
        detail: { layoutId, tabId },
      })
    );
  };

  if (layoutEntries.length === 0) {
    return (
      <div
        data-testid="prism-empty-tab-layouts"
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
      data-testid="prism-empty-tab-layouts"
      className="tw:flex tw:h-full tw:w-full tw:flex-col tw:overflow-auto tw:bg-background tw:p-[1.7em]"
    >
      {/* Favorites Section */}
      {favoriteEntries.length > 0 && (
        <section className="tw:mb-[2.3em] tw:last:mb-0">
          <h2 className="tw:mb-[1.1em] tw:text-[1em] tw:font-medium tw:tracking-wide tw:text-muted-foreground tw:uppercase">
            Favorites
          </h2>
          <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(15em,1fr))] tw:gap-[1.1em]">
            {favoriteEntries.map(([id, meta]) => (
              <LayoutCard
                key={id}
                id={id}
                meta={meta}
                isFavorite={true}
                onLayoutClick={handleLayoutClick}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}

      {/* Layouts Section */}
      {otherEntries.length > 0 && (
        <section className="tw:mb-[2.3em] tw:last:mb-0">
          <h2 className="tw:mb-[1.1em] tw:text-[1em] tw:font-medium tw:tracking-wide tw:text-muted-foreground tw:uppercase">
            Layouts
          </h2>
          <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(15em,1fr))] tw:gap-[1.1em]">
            {otherEntries.map(([id, meta]) => (
              <LayoutCard
                key={id}
                id={id}
                meta={meta}
                isFavorite={favoriteLayouts.includes(id)}
                onLayoutClick={handleLayoutClick}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
