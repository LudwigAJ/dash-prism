import React, { useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { usePrism, usePanelTabs, useActiveTab } from '@hooks/usePrism';
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
import { ErrorLayout, NewLayout } from '@components/layouts';

type PanelProps = {
  panel: PanelType;
  onOpenInfo?: (tab: Tab) => void;
};

function makeSpec(tab: Tab): DashComponent {
  return {
    namespace: 'dash_prism',
    type: 'PrismContent',
    props: {
      // CRITICAL: ID must be an OBJECT, not stringified!
      id: { type: 'prism-content', index: tab.id },
      data: {
        tabId: tab.id,
        layoutId: tab.layoutId,
        layoutParams: tab.layoutParams || {},
        layoutOption: tab.layoutOption || '',
      },
    },
  };
}

export function makeComponentPath(tab: Tab): string[] {
  return ['prism', 'content', tab.id];
}

// Memoized component - only re-renders when tab props actually change
const DashContentRenderer = memo(({ tab }: { tab: Tab }) => {
  const api: DashComponentApi | undefined = window.dash_component_api;

  const spec = useMemo<DashComponent>(() => makeSpec(tab), [tab]);
  const componentPath = useMemo(() => makeComponentPath(tab), [tab]);

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
});

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
      className={cn('prism-panel h-full w-full', isActive && 'prism-panel-active')}
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
                <ErrorLayout>
                  {!tab.layoutId ? <NewLayout tabId={tab.id} /> : <DashContentRenderer tab={tab} />}
                </ErrorLayout>
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

  // DEBUG: Log panel structure on every render
  console.log('Panel render:', {
    id: panel.id,
    isLeaf,
    childCount: panel.children.length,
    children: panel.children.map((c) => ({ id: c.id, isLeaf: c.children.length === 0 })),
  });

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
      <ErrorLayout>
        <LeafPanel panel={panel} />
      </ErrorLayout>
    );
  }

  // Container panel → SplitPane
  // Children: Pane for leaves, SplitPane (via recursion) for containers
  console.log('Rendering SplitPane with children:', panel.children.length);

  const renderedChildren = panel.children.map((child, index) => {
    const childIsLeaf = isLeafPanel(child);
    console.log('Rendering child pane:', { id: child.id, childIsLeaf });

    // Calculate size - use stored size or distribute evenly
    if (childIsLeaf) {
      // Leaf → wrap in Pane with error boundary
      // Use explicit size prop (controlled mode) to ensure rendering in headless browsers
      return (
        <Pane
          key={child.id}
          defaultSize="50%"
          minSize="10%"
          maxSize="100%"
          className="h-full w-full overflow-hidden"
        >
          <ErrorLayout>
            <LeafPanel panel={child} />
          </ErrorLayout>
        </Pane>
      );
    } else {
      // Container → recurse directly (no Pane wrapper) with error boundary
      return (
        <ErrorLayout key={child.id}>
          <Panel panel={child} />
        </ErrorLayout>
      );
    }
  });

  console.log('Rendered children array length:', renderedChildren.length);
  console.log(
    'Rendered children types:',
    renderedChildren.map((c) => c?.type?.name || c?.type || 'unknown')
  );

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
