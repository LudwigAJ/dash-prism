import React, { useState, useEffect, useCallback } from 'react';
import { Info, Undo2, Lock, Trash2 } from 'lucide-react';
import { useConfig } from '@context/ConfigContext';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Separator,
} from '@components/ui';
import { cn } from '@utils/cn';
import { SHORTCUTS, formatShortcut, isMacPlatform } from '@constants/shortcuts';
import { TabInfoRows } from '@components/TabInfoRows';
import type { StatusBarItem, DashComponent, DashComponentApi } from '@types';
import {
  useAppDispatch,
  useAppSelector,
  selectTabs,
  selectPanelCount,
  selectTabCount,
  selectActiveTabIds,
  selectActivePanelId,
  selectSearchBarModes,
  selectCanUndo,
  undo,
  resetWorkspace,
  clearPersistedWorkspace,
} from '@store';

interface StatusBarProps {
  /** The PrismAction components of the `actions` prop, as Dash component specs. */
  actions?: DashComponent[];
  /** The time of the last workspace change, in ms since the epoch */
  lastSyncTime: number;
  onOpenHelp?: () => void;
}

/**
 * Renders the status bar of the workspace: the segments that the `statusBarItems` prop selects,
 * then the PrismAction components of the `actions` prop.
 */
export function StatusBar({ actions = [], lastSyncTime, onOpenHelp }: StatusBarProps) {
  const dispatch = useAppDispatch();
  const { maxTabs, componentId, persistenceType, statusBarItems, enableKeyboardShortcuts } =
    useConfig();
  const [syncTimeDisplay, setSyncTimeDisplay] = useState('just now');

  // Select state from Redux
  const tabs = useAppSelector(selectTabs);
  const tabCount = useAppSelector(selectTabCount);
  const panelCount = useAppSelector(selectPanelCount);
  const activeTabIds = useAppSelector(selectActiveTabIds);
  const activePanelId = useAppSelector(selectActivePanelId);
  const searchBarModes = useAppSelector(selectSearchBarModes);
  const canUndo = useAppSelector(selectCanUndo);

  // Get Dash API for rendering action components
  const api: DashComponentApi | undefined = window.dash_component_api;

  // Get active tab and search bar mode for active panel
  const activeTabId = activeTabIds[activePanelId];
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const searchBarMode = searchBarModes[activePanelId] ?? 'display';

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
      clearPersistedWorkspace(componentId, persistenceType);
      // Reset reducer state to initial
      dispatch(resetWorkspace());
    }
  }, [componentId, persistenceType, dispatch]);

  const leftItems = statusBarItems.filter((item) => item !== 'updated');
  const showUpdated = statusBarItems.includes('updated');

  const segments: Record<Exclude<StatusBarItem, 'updated'>, React.ReactNode> = {
    reset: (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-testid="prism-status-bar-reset"
            aria-label="Reset workspace"
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
            type="button"
            data-testid="prism-status-bar-help"
            aria-label="Help"
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
            type="button"
            data-testid="prism-status-bar-undo"
            aria-label="Undo last change"
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
              ? `Undo last change (${formatShortcut(SHORTCUTS.undo, isMacPlatform())})`
              : 'Undo last change'
            : 'Nothing to undo'}
        </TooltipContent>
      </Tooltip>
    ),
    mode: (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="tw:flex tw:items-center tw:gap-1" data-testid="prism-status-bar-mode">
            <span className="tw:text-muted-foreground">Mode:</span>
            <span className="tw:font-medium tw:text-foreground">{searchBarMode}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>SearchBar mode for active panel</TooltipContent>
      </Tooltip>
    ),
    panels: (
      <div className="tw:flex tw:items-center tw:gap-1" data-testid="prism-status-bar-panels">
        Panels: <span className="tw:font-medium tw:text-foreground">{panelCount}</span>
        {panelCount > 1 && (
          <span className="tw:text-muted-foreground">({activePanelId.slice(0, 8)})</span>
        )}
      </div>
    ),
    tab: (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="tw:flex tw:cursor-pointer tw:items-center tw:gap-1 tw:rounded-sm tw:px-1.5 tw:py-0.5 tw:transition-colors tw:hover:bg-muted"
            data-testid="prism-status-bar-tab"
          >
            Tab: <span className="tw:text-foreground">{activeTab?.name || '--'}</span>
            {activeTab?.locked && <Lock className="tw:size-[1em] tw:text-muted-foreground" />}
          </button>
        </PopoverTrigger>
        {activeTab && (
          <PopoverContent
            className="tw:w-auto tw:min-w-48 tw:p-3"
            side="top"
            sideOffset={0}
            align="start"
          >
            <div className="tw:space-y-0">
              <TabInfoRows tab={activeTab} variant="popover" />
            </div>
          </PopoverContent>
        )}
      </Popover>
    ),
    count: (
      <div className="tw:flex tw:items-center tw:gap-1" data-testid="prism-status-bar-count">
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

      {/* ExternalWrapper renders each action at its path in the Prism props, so the
          action gets its own callbacks. */}
      {api?.ExternalWrapper && actions.length > 0 && (
        <>
          {actions.map((action, index) => {
            const actionId = action.props.id;
            const key =
              typeof actionId === 'string'
                ? actionId
                : actionId
                  ? JSON.stringify(actionId)
                  : `action-${index}`;
            return (
              <React.Fragment key={key}>
                {index > 0 && <Sep />}
                <api.ExternalWrapper
                  component={action}
                  componentPath={[componentId, 'actions', index]}
                />
              </React.Fragment>
            );
          })}
          {showUpdated && <Sep />}
        </>
      )}

      {/* Last Updated */}
      {showUpdated && (
        <div
          className="tw:flex tw:items-center tw:gap-1 tw:text-muted-foreground"
          data-testid="prism-status-bar-updated"
        >
          Updated: <span className="tw:text-foreground">{syncTimeDisplay}</span>
        </div>
      )}
    </div>
  );
}

/** Thin vertical separator between status bar segments. */
function Sep() {
  return <Separator orientation="vertical" className="tw:h-3" />;
}
