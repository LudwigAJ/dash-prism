import React, { memo, useMemo, useRef } from 'react';
import { InPortal } from 'react-reverse-portal';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';
import { useLastChangeTime } from '@hooks/useLastChangeTime';
import { useShareLinkListener } from '@hooks/useShareLinks';
import { useConfig } from '@context/ConfigContext';
import { usePortal } from '@context/PortalContext';
import { Panel } from '@components/Panel';
import { StatusBar } from '@components/StatusBar';
import { HelpModal } from '@components/modals/HelpModal';
import { InfoModal } from '@components/modals/InfoModal';
import { SetIconModal } from '@components/modals/SetIconModal';
import { ErrorBoundary } from '@components/ErrorBoundary';
import type { Tab, DashComponent, DashComponentApi } from '@types';
import { buildDashSpec, makeComponentPath } from '@utils/dashSpec';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectPanel,
  selectHelpModalOpen,
  selectInfoModalTab,
  selectSetIconModalTab,
  setTabIcon,
  openHelpModal,
  closeHelpModal,
  closeInfoModal,
  closeSetIconModal,
} from '@store';

// =============================================================================
// DashContentRenderer - Memoized component that renders Dash layout content
// =============================================================================

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
      () => buildDashSpec(id, layoutId, layoutParams, layoutOption, layoutTimeout),
      [id, layoutId, layoutParams, layoutOption, layoutTimeout]
    );

    const componentPath = useMemo(() => makeComponentPath(componentId, id), [componentId, id]);

    if (!api?.ExternalWrapper) {
      return (
        <div className="tw:flex tw:h-full tw:items-center tw:justify-center tw:text-muted-foreground">
          <p>Dash API not available. Ensure you&apos;re using Dash 3.1.1+.</p>
        </div>
      );
    }

    const { ExternalWrapper } = api;

    return (
      <div className="tw:h-full">
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

/**
 * Renders the workspace of one Prism component: the panel tree, the status bar and the modals. It
 * also keeps the content of each tab mounted in a portal, so a tab keeps its Dash state when it
 * moves to another panel.
 */
export function WorkspaceView({ actions = [], children }: WorkspaceViewProps) {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector(selectTabs);
  const panel = useAppSelector(selectPanel);
  const helpModalOpen = useAppSelector(selectHelpModalOpen);
  const infoModalTab = useAppSelector(selectInfoModalTab);
  const setIconModalTab = useAppSelector(selectSetIconModalTab);
  const { getPortalNode } = usePortal();
  const rootRef = useRef<HTMLDivElement>(null);

  // Hooks that use Redux
  useKeyboardShortcuts(rootRef);
  useShareLinkListener();
  const { lastSyncTime } = useLastChangeTime();
  const handleOpenHelp = () => {
    dispatch(openHelpModal());
  };

  const { statusBarPosition, showStatusBar } = useConfig();

  return (
    <div className="prism-view-workspace" ref={rootRef}>
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

      {showStatusBar && statusBarPosition === 'top' && (
        <StatusBar actions={actions} onOpenHelp={handleOpenHelp} lastSyncTime={lastSyncTime} />
      )}

      <div className="prism-view-panels">
        <Panel panel={panel} />
      </div>

      {showStatusBar && statusBarPosition === 'bottom' && (
        <StatusBar actions={actions} onOpenHelp={handleOpenHelp} lastSyncTime={lastSyncTime} />
      )}
      {/* The ui slice holds which modal is open and for which tab */}
      <HelpModal open={helpModalOpen} onOpenChange={() => dispatch(closeHelpModal())} />
      <InfoModal
        open={infoModalTab !== null}
        tab={infoModalTab}
        onOpenChange={() => dispatch(closeInfoModal())}
      />
      <SetIconModal
        open={setIconModalTab !== null}
        tab={setIconModalTab}
        onOpenChange={() => dispatch(closeSetIconModal())}
        onSelectIcon={(tabId, icon) => {
          dispatch(setTabIcon({ tabId, icon }));
        }}
      />

      {/* Render children (layout components from Dash) */}
      {children}
    </div>
  );
}
