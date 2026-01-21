import React, { useState, useEffect, useRef, memo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@components/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '@utils/logger';
import type { TabId, LayoutId } from '@types';
import { DashComponentProps } from 'props';

type ContentData = {
  tabId?: TabId;
  layoutId?: LayoutId;
  layoutParams?: Record<string, string>;
  layoutOption?: string;
};

type PrismContentProps = {
  /**
   * Child Dash Components.
   */
  children?: React.ReactNode;
  /**
   * Data props passed from Dash (tabId, layoutId, layoutParams, layoutOption).
   */
  data?: ContentData;
  /**
   * Timeout in seconds for layout loading.
   * Only triggers when layoutId is set but children don't arrive.
   * Default is 30 seconds.
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
  const timeoutMs = layoutTimeout * 1000;

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
          `[Prism] Layout loading timed out after ${layoutTimeout}s for layout: ${data?.layoutId}`
        );
        setTimedOut(true);
      }, timeoutMs);

      return () => clearTimeout(timeoutRef.current);
    }

    // Clear timeout if conditions are no longer met
    clearTimeout(timeoutRef.current);
  }, [hasLayout, children, loadingState, timeoutMs, data?.layoutId]);

  // ===== STATE 1: Timed out =====
  if (timedOut && !children) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-destructive h-5 w-5" />
              <CardTitle>Layout Loading Timeout</CardTitle>
            </div>
            <CardDescription>
              The layout "{data?.layoutId}" did not respond within {layoutTimeout} seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm">
              The server may be overloaded or the layout callback encountered an issue.
            </p>
            <Button variant="default" onClick={() => setTimedOut(false)}>
              <RefreshCw className="mr-2 h-4 w-4" />
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
      <div className="prism-content-loading flex h-full w-full items-center justify-center">
        <span className="text-muted-foreground ml-2">Loading layout...</span>
      </div>
    );
  }

  // ===== STATE 3: Render content (children received) =====
  if (children) {
    return <div className="prism-content-loaded h-full w-full">{children}</div>;
  }

  // ===== STATE 4: No layout selected (empty tab) =====
  return null;
}

PrismContent.dashChildrenUpdate = true;
