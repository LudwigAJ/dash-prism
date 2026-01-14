import React, { ReactElement } from 'react';
import { usePrism } from '@hooks/usePrism';
import { useKeyboardShortcuts } from '@hooks/useKeyboardShortcuts';
import { useDashSync } from '@hooks/useDashSync';
import { useConfig } from '@context/ConfigContext';
import { Panel } from '@components/Panel';
import { StatusBar } from '@components/StatusBar';
import { HelpModal } from '@components/modals/HelpModal';
import { InfoModal } from '@components/modals/InfoModal';
import { SetIconModal } from '@components/modals/SetIconModal';
import type { Tab } from '@types';

type WorkspaceViewProps = {
  /** Array of PrismAction component specs */
  actions?: JSX.Element[];
  children?: React.ReactNode;
};

export function WorkspaceView({ actions = [], children }: WorkspaceViewProps) {
  // Hooks that use Redux and setProps
  useKeyboardShortcuts();
  const { lastSyncTime } = useDashSync();
  const {
    state,
    dispatch,
    setProps,
    infoModalTab,
    helpModalOpen,
    setIconModalTab,
    closeInfoModal,
    closeHelpModal,
    closeSetIconModal,
    openHelpModal,
  } = usePrism();

  const { statusBarPosition, theme } = useConfig();

  return (
    <div className="prism-view-workspace">
      {statusBarPosition === 'top' && (
        <StatusBar actions={actions} onOpenHelp={openHelpModal} lastSyncTime={lastSyncTime} />
      )}

      <div className="prism-view-panels">
        <Panel panel={state.panel} />
      </div>

      {statusBarPosition === 'bottom' && (
        <StatusBar actions={actions} onOpenHelp={openHelpModal} lastSyncTime={lastSyncTime} />
      )}
      {/* Modals - local state only */}
      <HelpModal open={helpModalOpen} onOpenChange={closeHelpModal} theme={theme} />
      <InfoModal
        open={infoModalTab !== null}
        tab={infoModalTab}
        onOpenChange={closeInfoModal}
        theme={theme}
      />
      <SetIconModal
        open={setIconModalTab !== null}
        tab={setIconModalTab}
        onOpenChange={closeSetIconModal}
        onSelectIcon={(tabId, icon) => {
          dispatch({ type: 'SET_TAB_ICON', payload: { tabId, icon } });
        }}
        theme={theme}
      />

      {/* Render children (layout components from Dash) */}
      {children}
    </div>
  );
}
