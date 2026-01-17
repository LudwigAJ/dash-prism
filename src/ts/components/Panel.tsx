import React, { useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { OutPortal } from 'react-reverse-portal';
import { usePrism, usePanelTabs, useActiveTab } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { SplitPane, Pane } from 'react-split-pane';
import { Tabs, TabsContent } from '@components/ui/tabs';
import { TabBar } from '@components/TabBar';
import { SearchBar } from '@components/SearchBar';
import { PanelDropZone } from '@components/PanelDropzone';
import type { Panel as PanelType, Tab } from '@types';
import type { TabId } from '@types';
import { cn } from '@utils/cn';
import { isLeafPanel, getLeafPanelIds } from '@utils/panels';
import { findTabById } from '@utils/tabs';
import { NewLayout } from '@components/layouts';
import { ErrorBoundary } from '@components/ErrorBoundary';

type PanelProps = {
  panel: PanelType;
  onOpenInfo?: (tab: Tab) => void;
};

export function makeComponentPath(componentId: string, tabId: string): string[] {
  return [componentId, 'content', tabId];
}

// =============================================================================
// LeafPanel - Renders a leaf panel with tabs
// =============================================================================

type LeafPanelProps = {
  panel: PanelType;
};

const LeafPanel = memo(function LeafPanel({ panel }: LeafPanelProps) {
  const { state, dispatch, getPortalNode } = usePrism();

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
        className="flex h-full flex-col gap-0 overflow-hidden"
      >
        <TabBar panelId={panel.id} tabs={tabs} activeTabId={activeTabId} isPinned={isPinned} />

        <SearchBar panelId={panel.id} isPinned={isPinned} />

        <PanelDropZone panelId={panel.id} isPinned={isPinned}>
          <div className="relative flex h-full w-full flex-col overflow-auto">
            {tabs.map((tab) => {
              // Get portal node for tabs with layouts (content rendered via InPortal in WorkspaceView)
              const portalNode = tab.layoutId ? getPortalNode(tab.id) : null;

              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  forceMount={true}
                  className="h-full min-h-full w-full data-[state=inactive]:hidden"
                >
                  <ErrorBoundary>
                    {!tab.layoutId ? (
                      <NewLayout tabId={tab.id} />
                    ) : portalNode ? (
                      <OutPortal node={portalNode} />
                    ) : (
                      <div className="text-muted-foreground flex h-full items-center justify-center">
                        <p>Loading...</p>
                      </div>
                    )}
                  </ErrorBoundary>
                </TabsContent>
              );
            })}
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
