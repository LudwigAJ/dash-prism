import React, { useState, useEffect, useCallback } from 'react';
import { Info, Undo2, Lock } from 'lucide-react';
import { countLeafPanels } from '@utils/panels';
import { usePrism } from '@hooks/usePrism';
import { useConfig } from '@context/ConfigContext';
import { Tooltip, Popover, PopoverTrigger, PopoverContent } from '@components/ui';
import { cn } from '@utils/cn';
import type { DashComponent, DashComponentApi } from '@types';
import { isDashComponent } from '@types';

type StatusBarProps = {
  /** Array of PrismAction component specs to render */
  actions?: JSX.Element[];
  lastSyncTime?: number;
  onOpenHelp?: () => void;
  onOpenInfo?: (tabId: string) => void;
};

export function StatusBar({
  actions = [],
  lastSyncTime = Date.now(),
  onOpenHelp,
  onOpenInfo,
}: StatusBarProps) {
  const { state, dispatch } = usePrism();
  const { theme, maxTabs, componentId = 'prism' } = useConfig();
  const [syncTimeDisplay, setSyncTimeDisplay] = useState('just now');

  // Get Dash API for rendering action components
  const api: DashComponentApi | undefined = window.dash_component_api;

  // Get active tab and search bar mode for active panel
  const activeTabId = state.activeTabIds[state.activePanelId];
  const activeTab = state.tabs?.find((t) => t.id === activeTabId);
  const searchBarMode = state.searchBarModes[state.activePanelId] ?? 'display';

  // Counts
  const tabCount = state.tabs?.length ?? 0;
  const panelCount = countLeafPanels(state.panel);
  const canUndo = state.undoStack.length > 0;

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
    if (canUndo) dispatch({ type: 'POP_UNDO' });
  }, [canUndo, dispatch]);

  return (
    <div className="prism-status-bar bg-surface border-border text-secondary flex items-center gap-2 border-t px-3 py-1.5 text-xs">
      {/* Help Button */}
      <Tooltip content="Help" delayDuration={300}>
        <button
          data-testid="prism-statusbar-help"
          className="text-secondary hover:text-foreground hover:bg-surface-dim rounded-sm p-1 transition-colors"
          onClick={() => onOpenHelp?.()}
        >
          <Info className="h-3 w-3" />
        </button>
      </Tooltip>

      <span className="text-border opacity-60">|</span>

      {/* Undo Button */}
      <Tooltip
        content={canUndo ? 'Undo last closed tab (Ctrl+Z)' : 'No tabs to undo'}
        delayDuration={300}
      >
        <button
          data-testid="prism-statusbar-undo"
          className={cn(
            'rounded-sm p-1 transition-colors',
            canUndo
              ? 'text-secondary hover:text-foreground hover:bg-surface-dim cursor-pointer'
              : 'text-muted-foreground/40 cursor-not-allowed'
          )}
          onClick={handleUndo}
          disabled={!canUndo}
        >
          <Undo2 className="h-3 w-3" />
        </button>
      </Tooltip>

      <span className="text-border opacity-60">|</span>

      {/* SearchBar Mode */}
      <Tooltip content="SearchBar mode for active panel" delayDuration={300}>
        <div className="flex items-center gap-1">
          <span className="text-secondary">Mode:</span>
          <span className="text-foreground font-medium">{searchBarMode}</span>
        </div>
      </Tooltip>

      <span className="text-border opacity-60">|</span>

      {/* Panel Count + Active Panel ID */}
      <div className="flex items-center gap-1">
        Panels: <span className="text-foreground font-medium">{panelCount}</span>
        {panelCount > 1 && (
          <span className="text-secondary">({state.activePanelId.slice(0, 8)})</span>
        )}
      </div>

      <span className="text-border opacity-60">|</span>

      {/* Active Tab Info with Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <div className="hover:bg-surface-dim flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 transition-colors">
            Tab: <span className="text-foreground">{activeTab?.name || '--'}</span>
            {activeTab?.locked && <Lock className="text-secondary h-3 w-3" />}
          </div>
        </PopoverTrigger>
        {activeTab && (
          <PopoverContent
            className="w-auto min-w-48 p-3"
            side="top"
            sideOffset={0}
            align="start"
            theme={theme}
          >
            <div className="space-y-0">
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

      <span className="text-border opacity-60">|</span>

      {/* Tab Count */}
      <div className="flex items-center gap-1">
        <span className="text-foreground">{maxTabs > 0 ? `${tabCount}/${maxTabs}` : tabCount}</span>
        {tabCount === 1 ? 'tab' : 'tabs'}
      </div>

      <div className="flex-1" />

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
                  {index > 0 && <span className="text-border opacity-60">|</span>}
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
                  {index > 0 && <span className="text-border opacity-60">|</span>}
                  {actionSpec}
                </React.Fragment>
              );
            }
          })}
          <span className="text-border opacity-60">|</span>
        </>
      )}

      {/* Last Updated */}
      <div className="text-secondary flex items-center gap-1">
        Updated: <span className="text-foreground">{syncTimeDisplay}</span>
      </div>
    </div>
  );
}

// Helper component for info rows
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border-border/50 flex items-center justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-secondary text-xs">{label}</span>
      <span
        className={cn('text-foreground text-xs font-medium', mono && 'text-secondary font-mono')}
      >
        {value}
      </span>
    </div>
  );
}
