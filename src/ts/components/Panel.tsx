import React, { useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { usePrism, usePanelTabs, useActiveTab } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { SplitPane, Pane } from 'react-split-pane';
import { Tabs, TabsContent } from '@components/ui/tabs';
import { TabBar } from '@components/TabBar';
import { SearchBar } from '@components/SearchBar';
import { PanelDropZone } from '@components/PanelDropzone';
import type { Panel as PanelType, Tab, DashComponentApi } from '@types';
import type { TabId, DashComponent } from '@types';
import { cn } from '@utils/cn';
import { isLeafPanel, getLeafPanelIds } from '@utils/panels';
import { findTabById } from '@utils/tabs';
import { NewLayout } from '@components/layouts';
import { ErrorBoundary } from '@components/ErrorBoundary';

type PanelProps = {
  panel: PanelType;
  onOpenInfo?: (tab: Tab) => void;
};

function makeSpec(
  id: string,
  layoutId: string | undefined,
  layoutParams: Record<string, string> | undefined,
  layoutOption: string | undefined
): DashComponent {
  return {
    namespace: 'dash_prism',
    type: 'PrismContent',
    props: {
      // CRITICAL: ID must be an OBJECT, not stringified!
      id: { type: 'prism-content', index: id },
      data: {
        tabId: id,
        layoutId,
        // Use null instead of {} for stable references
        layoutParams: layoutParams ?? null,
        layoutOption: layoutOption ?? null,
      },
    },
  };
}

export function makeComponentPath(componentId: string, tabId: string): string[] {
  return [componentId, 'content', tabId];
}

/**
 * Memoized Dash content renderer.
 * Only re-renders when layout-affecting properties change (id, layoutId, layoutParams, layoutOption).
 * UI-only properties like `locked`, `name`, `icon`, `style` do NOT trigger re-renders.
 */
const DashContentRenderer = memo(
  ({ tab }: { tab: Tab }) => {
    const api: DashComponentApi | undefined = window.dash_component_api;
    const { componentId = 'prism' } = useConfig();

    // Destructure only layout-affecting properties for stable memoization
    const { id, layoutId, layoutParams, layoutOption } = tab;

    const spec = useMemo<DashComponent>(
      () => makeSpec(id, layoutId, layoutParams, layoutOption),
      [id, layoutId, layoutParams, layoutOption]
    );

    const componentPath = useMemo(() => makeComponentPath(componentId, id), [componentId, id]);

    if (!api?.ExternalWrapper) {
      return (
        <div className="text-muted-foreground flex h-full items-center justify-center">
          <p>Dash API not available. Ensure you're using Dash 3.1.1+.</p>
        </div>
      );
    }

    const { ExternalWrapper } = api;

    return (
      <div className="prism-content-container h-full">
        <ExternalWrapper component={spec} componentPath={componentPath} temp={false} />
      </div>
    );
  },
  // Custom comparator: only re-render when layout-affecting properties change
  (prevProps, nextProps) => {
    const prev = prevProps.tab;
    const next = nextProps.tab;
    return (
      prev.id === next.id &&
      prev.layoutId === next.layoutId &&
      prev.layoutOption === next.layoutOption &&
      JSON.stringify(prev.layoutParams) === JSON.stringify(next.layoutParams)
    );
  }
);

DashContentRenderer.displayName = 'DashContentRenderer';

// =============================================================================
// LeafPanel - Renders a leaf panel with tabs
// =============================================================================

type LeafPanelProps = {
  panel: PanelType;
};

const LeafPanel = memo(function LeafPanel({ panel }: LeafPanelProps) {
  const { state, dispatch } = usePrism();

  const panelTabIds = state.panelTabs[panel.id] || [];
  const tabs = panelTabIds
    .map((tabId) => findTabById(state.tabs, tabId))
    .filter((tab): tab is Tab => tab !== undefined);

  const activeTab = useActiveTab(panel.id);
  const isActive = state.activePanelId === panel.id;
  const activeTabId = activeTab?.id ?? null;
  const isPinned = panel.pinned ?? false;

  const handleTabChange = useCallback(
    (tabId: string) => {
      dispatch({ type: 'SELECT_TAB', payload: { tabId, panelId: panel.id } });
    },
    [dispatch, panel.id]
  );

  const handlePanelClick = useCallback(() => {
    if (state.activePanelId !== panel.id) {
      dispatch({ type: 'SET_ACTIVE_PANEL', payload: { panelId: panel.id } });
    }
  }, [dispatch, panel.id, state.activePanelId]);

  return (
    <div
      className={cn('prism-panel', isActive && 'prism-panel-active')}
      onClick={handlePanelClick}
      data-testid={`prism-panel-${panel.id}`}
      data-panel-id={panel.id}
      data-active={isActive || undefined}
    >
      <Tabs
        value={activeTabId ?? ''}
        onValueChange={handleTabChange}
        activationMode="manual"
        className="flex h-full flex-col overflow-hidden"
      >
        <TabBar panelId={panel.id} tabs={tabs} activeTabId={activeTabId} isPinned={isPinned} />

        {!state.searchBarsHidden && <SearchBar panelId={panel.id} isPinned={isPinned} />}

        <PanelDropZone panelId={panel.id} isPinned={isPinned}>
          <div className="relative flex-1 overflow-auto">
            {tabs.map((tab) => (
              <TabsContent
                key={tab.id}
                value={tab.id}
                forceMount={true}
                className="min-h-full data-[state=inactive]:hidden"
              >
                <ErrorBoundary>
                  {!tab.layoutId ? <NewLayout tabId={tab.id} /> : <DashContentRenderer tab={tab} />}
                </ErrorBoundary>
              </TabsContent>
            ))}
          </div>
        </PanelDropZone>
      </Tabs>
    </div>
  );
});

LeafPanel.displayName = 'LeafPanel';

// =============================================================================
// Panel - Recursively renders SplitPane for containers, LeafPanel for leaves
// =============================================================================

export const Panel = memo(function Panel({ panel }: PanelProps) {
  const { dispatch } = usePrism();
  const isLeaf = isLeafPanel(panel);

  const handleResizeEnd = useCallback(
    (sizes: (string | number)[]) => {
      panel.children.forEach((child, index) => {
        if (sizes[index] !== undefined) {
          dispatch({
            type: 'RESIZE_PANEL',
            payload: { panelId: child.id, size: sizes[index] },
          });
        }
      });
    },
    [panel.children, dispatch]
  );

  // Leaf panel → render LeafPanel directly (caller wraps in Pane if needed)
  if (isLeaf) {
    return (
      <ErrorBoundary>
        <LeafPanel panel={panel} />
      </ErrorBoundary>
    );
  }

  // Container panel → SplitPane
  // Children: Pane for leaves, SplitPane (via recursion) for containers

  const renderedChildren = panel.children.map((child, index) => {
    const childIsLeaf = isLeafPanel(child);

    // Calculate size - use stored size or distribute evenly
    if (childIsLeaf) {
      // Leaf → wrap in Pane with error boundary
      // Use stored size or default to 50% for even distribution
      const storedSize = child.size ?? '50%';
      return (
        <Pane
          key={child.id}
          size={storedSize}
          defaultSize={storedSize}
          minSize="10%"
          maxSize="100%"
          className="h-full w-full overflow-hidden"
        >
          <ErrorBoundary>
            <LeafPanel panel={child} />
          </ErrorBoundary>
        </Pane>
      );
    } else {
      // Container → recurse directly (no Pane wrapper) with error boundary
      return (
        <ErrorBoundary key={child.id}>
          <Panel panel={child} />
        </ErrorBoundary>
      );
    }
  });

  return (
    <SplitPane
      direction={panel.direction}
      className="h-full w-full"
      dividerClassName="bg-border hover:bg-primary/50 transition-colors"
      onResizeEnd={handleResizeEnd}
    >
      {renderedChildren}
    </SplitPane>
  );
});
