import React, { useEffect, useCallback, memo, useRef } from 'react';
import { OutPortal } from 'react-reverse-portal';
import { SplitPane, Pane } from 'react-split-pane';
import { Tabs, TabsContent } from '@components/ui/tabs';
import { TabBar } from '@components/TabBar';
import { SearchBar } from '@components/SearchBar';
import { PanelDropzone } from '@components/PanelDropzone';
import type { PanelNode, Tab, PanelId } from '@types';
import { isLeafPanel } from '@utils/panels';
import { findTabById, getActiveTabForPanel } from '@utils/tabs';
import { EmptyTabView } from '@components/emptyTab/EmptyTabView';
import { ErrorBoundary } from '@components/ErrorBoundary';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectPanelTabs,
  selectActiveTabIds,
  selectActivePanelId,
  activateTab,
  setActivePanel,
  resizePanel,
} from '@store';
import type { AppDispatch } from '@store';
import { usePortal } from '@context/PortalContext';

interface PanelProps {
  panel: PanelNode;
}

// =============================================================================
// useNativePanelFocus — Native pointerdown (capture) listener
// to detect clicks inside Dash layouts, whose separate React
// root prevents synthetic events from reaching Prism's tree.
// =============================================================================

function useNativePanelFocus(panelId: PanelId, activePanelId: PanelId, dispatch: AppDispatch) {
  const panelRef = useRef<HTMLDivElement>(null);
  const activePanelIdRef = useRef(activePanelId);
  activePanelIdRef.current = activePanelId;

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    const handler = () => {
      if (activePanelIdRef.current !== panelId) {
        dispatch(setActivePanel({ panelId }));
      }
    };

    el.addEventListener('pointerdown', handler, true);
    return () => el.removeEventListener('pointerdown', handler, true);
  }, [dispatch, panelId]);

  return panelRef;
}

// =============================================================================
// LeafPanel - Renders a leaf panel with tabs
// =============================================================================

interface LeafPanelProps {
  panel: PanelNode;
}

const LeafPanel = memo(function LeafPanel({ panel }: LeafPanelProps) {
  const dispatch = useAppDispatch();
  const { getPortalNode } = usePortal();
  const allTabs = useAppSelector(selectTabs);
  const panelTabsMap = useAppSelector(selectPanelTabs);
  const activeTabIds = useAppSelector(selectActiveTabIds);
  const activePanelId = useAppSelector(selectActivePanelId);

  const panelTabIds = panelTabsMap[panel.id] || [];
  const tabs = panelTabIds
    .map((tabId) => findTabById(allTabs, tabId))
    .filter((tab): tab is Tab => tab !== undefined);

  const isActive = activePanelId === panel.id;
  const activeTabId = getActiveTabForPanel(allTabs, activeTabIds, panel.id)?.id ?? null;
  const isPinned = panel.pinned ?? false;

  const handleTabChange = useCallback(
    (tabId: string) => {
      dispatch(activateTab({ tabId, panelId: panel.id }));
    },
    [dispatch, panel.id]
  );

  const panelRef = useNativePanelFocus(panel.id, activePanelId, dispatch);

  return (
    <div
      ref={panelRef}
      className="prism-panel"
      data-testid={`prism-panel-${panel.id}`}
      data-panel-id={panel.id}
      data-active={isActive || undefined}
    >
      <Tabs
        value={activeTabId ?? ''}
        onValueChange={handleTabChange}
        activationMode="manual"
        className="tw:flex tw:h-full tw:flex-col tw:gap-0 tw:overflow-hidden"
      >
        <TabBar
          panelId={panel.id}
          tabs={tabs}
          activeTabId={activeTabId}
          isPinned={isPinned}
          isActive={isActive}
        />

        <SearchBar panelId={panel.id} />

        <PanelDropzone panelId={panel.id} isPinned={isPinned}>
          <div className="tw:relative tw:flex tw:h-full tw:w-full tw:flex-col tw:overflow-auto">
            {tabs.map((tab) => {
              // Get portal node for tabs with layouts (content rendered via InPortal in WorkspaceView)
              const portalNode = tab.layoutId ? getPortalNode(tab.id) : null;

              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  forceMount={true}
                  className="tw:h-full tw:min-h-full tw:w-full"
                >
                  {/* An error in the Dash content of a tab goes to its React parent, the boundary
                      around InPortal in WorkspaceView. This boundary catches an error in the
                      empty-tab view. */}
                  <ErrorBoundary>
                    {!tab.layoutId ? (
                      <EmptyTabView tabId={tab.id} />
                    ) : portalNode ? (
                      <OutPortal node={portalNode} />
                    ) : (
                      <div className="tw:flex tw:h-full tw:items-center tw:justify-center tw:text-muted-foreground">
                        <p>Loading...</p>
                      </div>
                    )}
                  </ErrorBoundary>
                </TabsContent>
              );
            })}
          </div>
        </PanelDropzone>
      </Tabs>
    </div>
  );
});

/**
 * Renders a node of the panel tree. A leaf panel shows its tab bar, its search bar and its tab
 * content. A container panel splits its area between its children, and the component calls itself
 * for each child container.
 */
export const Panel = memo(function Panel({ panel }: PanelProps) {
  const dispatch = useAppDispatch();
  const isLeaf = isLeafPanel(panel);

  const handleResizeEnd = useCallback(
    (sizes: Array<string | number>) => {
      panel.children.forEach((child, index) => {
        if (sizes[index] !== undefined) {
          dispatch(resizePanel({ panelId: child.id, size: sizes[index] }));
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

  const renderedChildren = panel.children.map((child) => {
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
          className="tw:h-full tw:w-full tw:overflow-hidden"
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
      className="tw:h-full tw:w-full"
      dividerClassName="tw:bg-border tw:hover:bg-primary/50 tw:transition-colors"
      onResizeEnd={handleResizeEnd}
    >
      {renderedChildren}
    </SplitPane>
  );
});
