import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@utils/cn';

/** Holds the props of `FavoriteStar`. */
interface FavoriteStarProps {
  layoutName: string;
  isFavorite: boolean;
  onToggle: () => void;
  /** Places and sizes the button for its container. */
  className?: string;
  testId?: string;
}

/**
 * Renders the star button that adds a layout to the favorites or removes it. The layout cards of
 * an empty tab and the layout list of the search bar show it.
 */
export function FavoriteStar({
  layoutName,
  isFavorite,
  onToggle,
  className,
  testId,
}: FavoriteStarProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={
        isFavorite ? `Remove ${layoutName} from favorites` : `Add ${layoutName} to favorites`
      }
      className={cn(
        'tw:transition-colors tw:hover:bg-muted tw:focus-visible:ring-ring tw:focus-visible:outline-none',
        isFavorite ? 'tw:text-primary' : 'tw:text-muted-foreground tw:hover:text-primary',
        className
      )}
      // The focus stays in the search input, so the search bar does not close on the blur
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        // The click must not also select the layout item under the star
        e.stopPropagation();
        onToggle();
      }}
    >
      {/* The command item of the search bar colors its icons. The star keeps the button color. */}
      <Star className={cn('tw:size-[1em] tw:text-current', isFavorite && 'tw:fill-current')} />
    </button>
  );
}
