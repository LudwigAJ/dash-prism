import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@components/ui/card';
import { useConfig } from '@context/ConfigContext';
import { usePrism } from '@hooks/usePrism';
import { cn } from '@utils/cn';
import { Star, Layers } from 'lucide-react';
import type { TabId } from '@types';

type NewLayoutProps = {
  tabId: TabId;
};

/**
 * Displays available layouts as cards for new/empty tabs.
 * Shows favorites at top, then remaining layouts.
 */
export function NewLayout({ tabId }: NewLayoutProps) {
  const { registeredLayouts } = useConfig();
  const { state, dispatch } = usePrism();
  const favoriteLayouts = state.favoriteLayouts ?? [];

  const layoutEntries = Object.entries(registeredLayouts);

  // Split into favorites and non-favorites
  const favoriteEntries = layoutEntries.filter(([id]) => favoriteLayouts.includes(id));
  const otherEntries = layoutEntries.filter(([id]) => !favoriteLayouts.includes(id));

  const isFavorite = (layoutId: string) => favoriteLayouts.includes(layoutId);

  const handleToggleFavorite = (e: React.MouseEvent, layoutId: string) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_FAVORITE_LAYOUT', payload: { layoutId } });
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
              <Layers className="text-muted-foreground h-5 w-5" />
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
        'hover:border-primary/50 relative cursor-pointer transition-all hover:shadow-md',
        'focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2',
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
          isFavorite(id) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        )}
        aria-label={isFavorite(id) ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Star className={cn('h-4 w-4', isFavorite(id) && 'fill-primary')} />
      </button>

      <CardHeader className="flex-1 pr-10 pb-2">
        <CardTitle className="prism-newlayout-card-title">{meta.name}</CardTitle>
        {meta.description && (
          <CardDescription className="prism-newlayout-card-description line-clamp-3">
            {meta.description}
          </CardDescription>
        )}
      </CardHeader>
      {meta.params && meta.params.length > 0 && (
        <CardContent className="pt-0">
          <p className="prism-newlayout-card-meta text-muted-foreground">
            {meta.params.length} parameter{meta.params.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      )}
    </Card>
  );

  return (
    <div className="prism-newlayout flex min-h-full flex-col overflow-auto">
      {/* Favorites Section */}
      {favoriteEntries.length > 0 && (
        <section className="prism-newlayout-section">
          <h2 className="prism-newlayout-heading text-muted-foreground font-medium tracking-wide uppercase">
            Favorites
          </h2>
          <div className="prism-newlayout-grid">
            {favoriteEntries.map(([id, meta]) => (
              <LayoutCard key={id} id={id} meta={meta} />
            ))}
          </div>
        </section>
      )}

      {/* Layouts Section */}
      {otherEntries.length > 0 && (
        <section className="prism-newlayout-section">
          <h2 className="prism-newlayout-heading text-muted-foreground font-medium tracking-wide uppercase">
            Layouts
          </h2>
          <div className="prism-newlayout-grid">
            {otherEntries.map(([id, meta]) => (
              <LayoutCard key={id} id={id} meta={meta} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
