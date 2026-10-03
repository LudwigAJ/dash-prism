import React, { useState, useEffect, useCallback } from 'react';
import { Info, Undo2, Lock, Trash2 } from 'lucide-react';
import { countLeafPanels } from '@utils/panels';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@components/ui';
import { cn } from '@utils/cn';
import { resolveStatusBarItems } from '@constants/statusBar';
import type { StatusBarItem } from '@types';
import type { DashComponent, DashComponentApi } from '@types';
import { isDashComponent } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectPanel,
  selectActiveTabIds,
  selectActivePanelId,
  selectSearchBarModes,
  selectCanUndo,
  undo,
  resetWorkspace,
} from '@store';

type StatusBarProps = {
  /** Array of PrismAction component specs to render */
  actions?: JSX.Element[];
  lastSyncTime?: number;
  onOpenHelp?: () => void;
};

export function StatusBar({ actions = [], lastSyncTime = Date.now(), onOpenHelp }: StatusBarProps) {
  const dispatch = useAppDispatch();
  const { clearPersistedState } = usePrism();
  const { maxTabs, componentId = 'prism', statusBarItems, enableKeyboardShortcuts } = useConfig();
  const [syncTimeDisplay, setSyncTimeDisplay] = useState('just now');

  // Select state from Redux
  const tabs = useAppSelector(selectTabs);
  const panel = useAppSelector(selectPanel);
  const activeTabIds = useAppSelector(selectActiveTabIds);
  const activePanelId = useAppSelector(selectActivePanelId);
  const searchBarModes = useAppSelector(selectSearchBarModes);
  const canUndo = useAppSelector(selectCanUndo);

  // Get Dash API for rendering action components
  const api: DashComponentApi | undefined = window.dash_component_api;

  // Get active tab and search bar mode for active panel
  const activeTabId = activeTabIds[activePanelId];
  const activeTab = tabs?.find((t) => t.id === activeTabId);
  const searchBarMode = searchBarModes[activePanelId] ?? 'display';

  // Counts
  const tabCount = tabs?.length ?? 0;
  const panelCount = countLeafPanels(panel);

  // Update sync time display every 5 seconds
  useEffect(() => {
    const updateSyncDisplay = () => {
      const elapsed = Date.now() - lastSyncTime;
      if (elapsed < 10000) setSyncTimeDisplay('just now');
      else if (elapsed < 60000) setSyncTimeDisplay(`${Math.floor(elapsed / 1000)}s ago`);
      else if (elapsed < 3600000) setSyncTimeDisplay(`${Math.floor(elapsed / 60000)}m ago`);
      else setSyncTimeDisplay(`${Math.floor(elapsed / 3600000)}h ago`);
    };
    updateSyncDisplay();
    const interval = setInterval(updateSyncDisplay, 5000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  const handleUndo = useCallback(() => {
    if (canUndo) dispatch(undo());
  }, [canUndo, dispatch]);

  const handleReset = useCallback(() => {
    const confirmed = window.confirm(
      'Are you sure you want to reset the workspace?\n\n' +
        'This will clear all saved state and restore default settings.\n' +
        'This action cannot be undone.'
    );

    if (confirmed) {
      // Clear persisted storage (localStorage/sessionStorage)
      clearPersistedState();
      // Reset reducer state to initial
      dispatch(resetWorkspace());
    }
  }, [clearPersistedState, dispatch]);

  const items = resolveStatusBarItems(statusBarItems);
  const leftItems = items.filter((item) => item !== 'updated');
  const showUpdated = items.includes('updated');

  const segments: Record<Exclude<StatusBarItem, 'updated'>, React.ReactNode> = {
    reset: (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid="prism-statusbar-reset"
            className="tw:rounded-sm tw:p-1 tw:text-muted-foreground tw:transition-colors tw:hover:bg-muted tw:hover:text-destructive"
            onClick={handleReset}
          >
            <Trash2 className="tw:size-[1em]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Reset workspace (clear saved state)</TooltipContent>
      </Tooltip>
    ),
    help: (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid="prism-statusbar-help"
            className="tw:rounded-sm tw:p-1 tw:text-muted-foreground tw:transition-colors tw:hover:bg-muted tw:hover:text-foreground"
            onClick={() => onOpenHelp?.()}
          >
            <Info className="tw:size-[1em]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Help</TooltipContent>
      </Tooltip>
    ),
    undo: (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            data-testid="prism-statusbar-undo"
            className={cn(
              'tw:rounded-sm tw:p-1 tw:transition-colors',
              canUndo
                ? 'tw:cursor-pointer tw:text-muted-foreground tw:hover:bg-muted tw:hover:text-foreground'
                : 'tw:cursor-not-allowed tw:text-muted-foreground/40'
            )}
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo2 className="tw:size-[1em]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {canUndo
            ? enableKeyboardShortcuts
              ? 'Undo last change (Ctrl+U)'
              : 'Undo last change'
            : 'Nothing to undo'}
        </TooltipContent>
      </Tooltip>
    ),
    mode: (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="tw:flex tw:items-center tw:gap-1" data-testid="prism-statusbar-mode">
            <span className="tw:text-muted-foreground">Mode:</span>
            <span className="tw:font-medium tw:text-foreground">{searchBarMode}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>SearchBar mode for active panel</TooltipContent>
      </Tooltip>
    ),
    panels: (
      <div className="tw:flex tw:items-center tw:gap-1" data-testid="prism-statusbar-panels">
        Panels: <span className="tw:font-medium tw:text-foreground">{panelCount}</span>
        {panelCount > 1 && (
          <span className="tw:text-muted-foreground">({activePanelId.slice(0, 8)})</span>
        )}
      </div>
    ),
    tab: (
      <Popover>
        <PopoverTrigger asChild>
          <div
            className="tw:flex tw:cursor-pointer tw:items-center tw:gap-1 tw:rounded-sm tw:px-1.5 tw:py-0.5 tw:transition-colors tw:hover:bg-muted"
            data-testid="prism-statusbar-tab"
          >
            Tab: <span className="tw:text-foreground">{activeTab?.name || '--'}</span>
            {activeTab?.locked && <Lock className="tw:size-[1em] tw:text-muted-foreground" />}
          </div>
        </PopoverTrigger>
        {activeTab && (
          <PopoverContent
            className="tw:w-auto tw:min-w-48 tw:p-3"
            side="top"
            sideOffset={0}
            align="start"
          >
            <div className="tw:space-y-0">
              <InfoRow label="Name" value={activeTab.name} />
              <InfoRow label="Tab ID" value={activeTab.id} mono />
              <InfoRow label="Panel ID" value={activeTab.panelId} mono />
              <InfoRow label="Created" value={new Date(activeTab.createdAt).toLocaleString()} />
              <InfoRow label="Layout" value={activeTab.layoutId || 'None'} />
              <InfoRow label="Locked" value={activeTab.locked ? 'Yes' : 'No'} />
              {activeTab.layoutParams && (
                <InfoRow label="Params" value={JSON.stringify(activeTab.layoutParams)} />
              )}
            </div>
          </PopoverContent>
        )}
      </Popover>
    ),
    count: (
      <div className="tw:flex tw:items-center tw:gap-1" data-testid="prism-statusbar-count">
        <span className="tw:text-foreground">
          {maxTabs >= 1 ? `${tabCount}/${maxTabs}` : tabCount}
        </span>
        {tabCount === 1 ? 'tab' : 'tabs'}
      </div>
    ),
  };

  return (
    <div className="prism-status-bar tw:flex tw:items-center tw:gap-2 tw:border-t tw:border-border tw:bg-card tw:px-3 tw:py-1.5 tw:text-xs tw:text-card-foreground">
      {leftItems.map((item, index) => (
        <React.Fragment key={item}>
          {index > 0 && <Sep />}
          {segments[item]}
        </React.Fragment>
      ))}

      <div className="tw:flex-1" />

      {/* Action Buttons - rendered via ExternalWrapper or directly */}
      {actions.length > 0 && (
        <>
          {actions.map((actionSpec, index) => {
            // Check if this is a DashComponent spec or already a rendered element
            if (isDashComponent(actionSpec)) {
              // It's a DashComponent spec - render via ExternalWrapper if available
              if (!api?.ExternalWrapper) return null;

              const actionId = actionSpec.props.id;
              const key =
                typeof actionId === 'string'
                  ? actionId
                  : actionId
                    ? JSON.stringify(actionId)
                    : `action-${index}`;

              // Add data-testid to action props for testing
              const enhancedActionSpec: DashComponent = {
                ...actionSpec,
                props: {
                  ...actionSpec.props,
                  'data-testid': `prism-action-${typeof actionId === 'string' ? actionId : index}`,
                },
              };

              return (
                <React.Fragment key={key}>
                  {index > 0 && <Sep />}
                  <api.ExternalWrapper
                    component={enhancedActionSpec}
                    componentPath={[componentId, 'actions', index]}
                  />
                </React.Fragment>
              );
            } else {
              // It's already a React element - render directly
              return (
                <React.Fragment key={index}>
                  {index > 0 && <Sep />}
                  {actionSpec}
                </React.Fragment>
              );
            }
          })}
          {showUpdated && <Sep />}
        </>
      )}

      {/* Last Updated */}
      {showUpdated && (
        <div
          className="tw:flex tw:items-center tw:gap-1 tw:text-muted-foreground"
          data-testid="prism-statusbar-updated"
        >
          Updated: <span className="tw:text-foreground">{syncTimeDisplay}</span>
        </div>
      )}
    </div>
  );
}

/** Thin vertical separator between status bar segments. */
function Sep() {
  return <span className="tw:text-border tw:opacity-60">|</span>;
}

// Helper component for info rows
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="tw:flex tw:items-center tw:justify-between tw:gap-4 tw:border-b tw:border-border/50 tw:py-2 tw:last:border-0">
      <span className="tw:text-xs tw:text-muted-foreground">{label}</span>
      <span
        className={cn(
          'tw:text-xs tw:font-medium tw:text-foreground',
          mono && 'tw:font-mono tw:text-muted-foreground'
        )}
      >
        {value}
      </span>
    </div>
  );
}
