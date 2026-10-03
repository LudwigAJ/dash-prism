import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The Tailwind prefix of the stylesheet. The same value is in the prefix option of the theme
 * import in global.css.
 */
const TAILWIND_PREFIX = 'tw';

// With the prefix option, tailwind-merge merges only the tw: classes. It passes a class without the
// prefix through unchanged, so a host class in the className prop of Prism is never dropped.
const twMerge = extendTailwindMerge({ prefix: TAILWIND_PREFIX });

/**
 * Merges class names (shadcn pattern).
 * Combines clsx for conditional classes with tailwind-merge for deduplication
 *
 * @example
 * cn("tw:px-2 tw:py-1", condition && "tw:bg-destructive")
 * cn("tw:text-sm", className)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
