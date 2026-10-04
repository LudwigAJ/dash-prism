import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@components/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@utils/logger';
import type { LayoutId } from '@types';
import { type DashComponentProps } from 'props';
import { normalizeLayoutTimeout } from '@utils/dashSpec';

interface ContentData {
  layoutId?: LayoutId;
  layoutParams?: Record<string, string>;
  layoutOption?: string;
  /** Server-side render timeout in seconds (the Prism layoutTimeout prop). */
  timeout?: number;
}

type PrismContentProps = {
  /**
   * Child Dash Components.
   */
  children?: React.ReactNode;
  /**
   * Tab request passed to the render callback (layoutId, layoutParams,
   * layoutOption, timeout). The tab ID is not in it: the callback reads the
   * tab ID from the `index` of `id`. Set by Prism; not meant to be edited by hand.
   */
  data?: ContentData;
  /**
   * Client-side timeout in seconds for layout loading, set by Prism from its
   * own layoutTimeout prop. If the rendered content has not arrived within this
   * time after a layout is selected, a timeout card is shown. Default is 30.
   */
  layoutTimeout?: number;
} & DashComponentProps;

/**
 * Renders Dash component content within Prism tabs.
 * Used internally by Prism to render tab content.
 * Exposes props `id` and `data` for Dash to pass tab/layout info.
 */
export function PrismContent({ children, data, layoutTimeout = 30 }: PrismContentProps) {
  // Get Dash loading state directly from Dash context
  // This allows both PrismContent and TabBar (via TabItem) to react to loading changes
  const ctx = window.dash_component_api?.useDashContext?.();
  const loadingState = ctx?.useLoading() ?? false;

  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hasLayout = Boolean(data?.layoutId);
  // Prism already normalises the value it passes; guard again for standalone use.
  const effectiveTimeout = normalizeLayoutTimeout(layoutTimeout);
  const timeoutMs = effectiveTimeout * 1000;

  // Reset timeout state when children arrive or layoutId changes
  useEffect(() => {
    if (children) {
      setTimedOut(false);
    }
  }, [children]);

  // Start timeout when layoutId is set but children haven't arrived
  useEffect(() => {
    // Only start timeout if:
    // 1. We have a layoutId (user selected a layout)
    // 2. Children haven't arrived yet
    // 3. We're in loading state (callback is processing)
    if (hasLayout && !children && loadingState) {
      timeoutRef.current = setTimeout(() => {
        logger.error(
          `[Prism] Layout loading timed out after ${effectiveTimeout}s for layout: ${data?.layoutId}`
        );
        setTimedOut(true);
      }, timeoutMs);

      return () => clearTimeout(timeoutRef.current);
    }

    // Clear timeout if conditions are no longer met
    clearTimeout(timeoutRef.current);
    return undefined;
  }, [hasLayout, children, loadingState, timeoutMs, effectiveTimeout, data?.layoutId]);

  // ===== STATE 1: Timed out =====
  if (timedOut && !children) {
    return (
      <div className="tw:flex tw:h-full tw:items-center tw:justify-center tw:p-6">
        <Card className="tw:w-full tw:max-w-md">
          <CardHeader>
            <div className="tw:flex tw:items-center tw:gap-2">
              <AlertTriangle className="tw:size-[1.25em] tw:text-destructive" />
              <CardTitle>Layout Loading Timeout</CardTitle>
            </div>
            <CardDescription>
              The layout &quot;{data?.layoutId}&quot; did not respond within {effectiveTimeout}{' '}
              seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="tw:space-y-4">
            <p className="tw:text-sm tw:text-muted-foreground">
              The server may be overloaded or the layout callback encountered an issue.
            </p>
            <Button variant="default" onClick={() => setTimedOut(false)}>
              <RefreshCw className="tw:mr-2 tw:size-[1em]" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== STATE 2: Loading (callback is processing) =====
  if (loadingState) {
    return (
      <div className="tw:flex tw:h-full tw:w-full tw:items-center tw:justify-center">
        <span className="tw:ml-2 tw:text-muted-foreground">Loading layout...</span>
      </div>
    );
  }

  // ===== STATE 3: Render content (children received) =====
  if (children) {
    return <div className="tw:h-full tw:w-full">{children}</div>;
  }

  // ===== STATE 4: No layout selected (empty tab) =====
  return null;
}

PrismContent.dashChildrenUpdate = true;
