import React, { memo, useMemo } from 'react';
import { InPortal } from 'react-reverse-portal';
import { usePrism } from '@hooks/usePrism';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';
import { useDashSync } from '@hooks/useDashSync';
import { useConfig } from '@context/ConfigContext';
import { usePortal } from '@context/PortalContext';
import { Panel, makeComponentPath } from '@components/Panel';
import { StatusBar } from '@components/StatusBar';
import { HelpModal } from '@components/modals/HelpModal';
import { InfoModal } from '@components/modals/InfoModal';
import { SetIconModal } from '@components/modals/SetIconModal';
import { ErrorBoundary } from '@components/ErrorBoundary';
import type { Tab, DashComponent, DashComponentApi } from '@types';
import { useAppDispatch, useAppSelector, selectTabs, selectPanel, setTabIcon } from '@store';

// =============================================================================
// DashContentRenderer - Memoized component that renders Dash layout content
// =============================================================================

function makeSpec(
  id: string,
  layoutId: string | undefined,
  layoutParams: Record<string, string> | undefined,
  layoutOption: string | undefined,
  timeout: number
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
        // Keep undefined for absent values (consistent with Tab type)
        layoutParams,
        layoutOption,
        timeout,
      },
    },
  };
}

/**
 * Memoized Dash content renderer.
 * Only re-renders when layout-affecting properties change (id, layoutId, layoutParams, layoutOption).
 * UI-only properties like `locked`, `name`, `icon`, `style` do NOT trigger re-renders.
 */
const DashContentRenderer = memo(
  ({ tab }: { tab: Tab }) => {
    const api: DashComponentApi | undefined = window.dash_component_api;
    const { componentId = 'prism', layoutTimeout } = useConfig();

    // Destructure only layout-affecting properties for stable memoization
    const { id, layoutId, layoutParams, layoutOption } = tab;

    const spec = useMemo<DashComponent>(
      () => makeSpec(id, layoutId, layoutParams, layoutOption, layoutTimeout),
      [id, layoutId, layoutParams, layoutOption, layoutTimeout]
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

type WorkspaceViewProps = {
  /** Array of PrismAction component specs */
  actions?: JSX.Element[];
  children?: React.ReactNode;
};

export function WorkspaceView({ actions = [], children }: WorkspaceViewProps) {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const panel = useAppSelector(selectPanel);
  const { getPortalNode } = usePortal();

  // Hooks that use Redux
  useKeyboardShortcuts();
  const { lastSyncTime } = useDashSync();
  const {
    infoModalTab,
    helpModalOpen,
    setIconModalTab,
    closeInfoModal,
    closeHelpModal,
    closeSetIconModal,
    openHelpModal,
  } = usePrism();

  const { statusBarPosition } = useConfig();

  return (
    <div className="prism-view-workspace">
      {/* PORTAL HOST: Stable mount point for all tab content with layouts.
          Content rendered here stays mounted even when tabs move between panels.
          Uses mountKey in key to force remount when user triggers refresh. */}
      {tabs
        .filter((tab) => Boolean(tab.layoutId))
        .map((tab) => {
          const node = getPortalNode(tab.id);
          if (!node) return null;
          return (
            <InPortal key={tab.mountKey ?? tab.id} node={node}>
              <ErrorBoundary>
                <DashContentRenderer tab={tab} />
              </ErrorBoundary>
            </InPortal>
          );
        })}

      {statusBarPosition === 'top' && (
        <StatusBar actions={actions} onOpenHelp={openHelpModal} lastSyncTime={lastSyncTime} />
      )}

      <div className="prism-view-panels">
        <Panel panel={panel} />
      </div>

      {statusBarPosition === 'bottom' && (
        <StatusBar actions={actions} onOpenHelp={openHelpModal} lastSyncTime={lastSyncTime} />
      )}
      {/* Modals - local state only */}
      <HelpModal open={helpModalOpen} onOpenChange={closeHelpModal} />
      <InfoModal open={infoModalTab !== null} tab={infoModalTab} onOpenChange={closeInfoModal} />
      <SetIconModal
        open={setIconModalTab !== null}
        tab={setIconModalTab}
        onOpenChange={closeSetIconModal}
        onSelectIcon={(tabId, icon) => {
          dispatch(setTabIcon({ tabId, icon }));
        }}
      />

      {/* Render children (layout components from Dash) */}
      {children}
    </div>
  );
}
