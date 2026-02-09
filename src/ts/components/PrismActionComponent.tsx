import React, { useCallback, memo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger, Spinner } from '@components/ui';
import { cn } from '@utils/cn';
import { DashComponentProps } from 'props';

/** Style variants for action buttons */
const ACTION_VARIANT_CLASSES: Record<string, string> = {
  default: '',
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  success: 'bg-green-600 text-white hover:bg-green-600/90',
  warning: 'bg-amber-500 text-white hover:bg-amber-500/90',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
};

/**
 * Check if a string is a valid hex color
 */
function isHexColor(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(value);
}

type PrismActionProps = {
  /**
   * Button label text displayed in the StatusBar.
   */
  label: string;

  /**
   * Tooltip text shown on hover.
   * If not provided, defaults to "Click to trigger {label}".
   */
  tooltip?: string;

  /**
   * Button style variant.
   * Can be a preset ('default', 'primary', 'secondary', 'success', 'warning', 'danger')
   * or a hex color (e.g., '#FF5500').
   */
  variant?: string;

  /**
   * Whether the button is disabled.
   * Can be controlled via Dash callbacks.
   */
  disabled?: boolean;

  /**
   * Whether to show a loading spinner.
   * Can be controlled via Dash callbacks.
   */
  loading?: boolean;

  /**
   * Number of times the button has been clicked.
   * Use as Input in Dash callbacks to respond to clicks.
   */
  n_clicks?: number;
} & DashComponentProps;

/**
 * A clickable action button for the Prism StatusBar.
 * Each PrismAction is a Dash component with its own n_clicks prop,
 * allowing individual callbacks per action button.
 */
export function PrismAction({
  id,
  setProps,
  label,
  tooltip,
  variant = 'default',
  disabled = false,
  loading = false,
  n_clicks = 0,
}: PrismActionProps) {
  const handleClick = useCallback(() => {
    if (disabled || loading) return;
    setProps?.({ n_clicks: n_clicks + 1 });
  }, [disabled, loading, n_clicks, setProps]);

  // Determine button styling
  const isCustomColor = variant && isHexColor(variant);
  const variantClasses =
    !isCustomColor && variant in ACTION_VARIANT_CLASSES ? ACTION_VARIANT_CLASSES[variant] : '';
  const customStyle = isCustomColor ? { backgroundColor: variant, color: '#fff' } : undefined;

  // Tooltip content
  const tooltipContent = tooltip ?? `Click to trigger "${label}"`;

  // Generate test id from component id for testing
  const testId = id ? `prism-action-${id}` : undefined;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          id={id}
          data-testid={testId}
          className={cn(
            'rounded-sm px-2 py-0.5 text-xs font-medium transition-colors',
            'hover:bg-muted/70 border border-transparent',
            'flex items-center gap-1.5',
            variantClasses,
            disabled && 'cursor-not-allowed opacity-50',
            loading && 'cursor-wait'
          )}
          style={customStyle}
          onClick={handleClick}
          disabled={disabled || loading}
          aria-busy={loading}
        >
          {loading ? <Spinner size="sm" /> : null}
          <span>{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltipContent}</TooltipContent>
    </Tooltip>
  );
}

PrismAction.dashChildrenUpdate = false;
