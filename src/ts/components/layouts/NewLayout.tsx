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

  const isFavorite = (layoutId: string) => favoriteLayouts.includes(layoutId);

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
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="text-muted-foreground size-[1.25em]" />
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

  const LayoutCard = ({ id, meta }: { id: string; meta: (typeof registeredLayouts)[string] }) => (
    <Card
      key={id}
      className={cn(
        'hover:border-accent relative cursor-pointer transition-colors hover:shadow-md',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset',
        'flex flex-col'
      )}
      onClick={() => handleLayoutClick(id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleLayoutClick(id);
        }
      }}
    >
      {/* Favorite star button */}
      <button
        type="button"
        onClick={(e) => handleToggleFavorite(e, id)}
        className={cn(
          'absolute top-2 right-2 rounded-md p-1.5 transition-colors',
          'hover:bg-muted focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          isFavorite(id) ? 'text-primary' : 'text-muted-foreground hover:text-primary'
        )}
        aria-label={isFavorite(id) ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={cn('size-[1em]', isFavorite(id) && 'fill-current')} />
      </button>

      <CardHeader className="flex-1 pr-10 pb-2">
        <CardTitle className="text-[1.15em]">{meta.name}</CardTitle>
        {meta.description && (
          <CardDescription className="line-clamp-3 text-[1em]">{meta.description}</CardDescription>
        )}
      </CardHeader>
      {meta.params && meta.params.length > 0 && (
        <CardContent className="pt-0">
          <p className="text-muted-foreground text-[0.85em]">
            {meta.params.length} parameter{meta.params.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="bg-background flex h-full w-full flex-col overflow-auto p-[1.7em]">
      {/* Favorites Section */}
      {favoriteEntries.length > 0 && (
        <section className="mb-[2.3em] last:mb-0">
          <h2 className="text-muted-foreground mb-[1.1em] text-[1em] font-medium tracking-wide uppercase">
            Favorites
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15em,1fr))] gap-[1.1em]">
            {favoriteEntries.map(([id, meta]) => (
              <LayoutCard key={id} id={id} meta={meta} />
            ))}
          </div>
        </section>
      )}

      {/* Layouts Section */}
      {otherEntries.length > 0 && (
        <section className="mb-[2.3em] last:mb-0">
          <h2 className="text-muted-foreground mb-[1.1em] text-[1em] font-medium tracking-wide uppercase">
            Layouts
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(15em,1fr))] gap-[1.1em]">
            {otherEntries.map(([id, meta]) => (
              <LayoutCard key={id} id={id} meta={meta} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
