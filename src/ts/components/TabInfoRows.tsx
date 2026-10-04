import React from 'react';
import type { Tab } from '@types';
import { cn } from '@utils/cn';

/** Names the place of the rows: the tab popover of the status bar, or the info modal. */
type TabInfoVariant = 'popover' | 'modal';

/** Holds the props of `TabInfoRows`. */
interface TabInfoRowsProps {
  tab: Tab;
  /**
   * The popover is small: it has tighter rows and smaller text, and it shows the parameters on
   * one line. The modal also shows the icon and the style of the tab.
   */
  variant: TabInfoVariant;
}

/** Holds the props of `InfoRow`. */
interface InfoRowProps {
  label: string;
  value: string;
  variant: TabInfoVariant;
  /** Writes the value in a monospace font, for an id. */
  mono?: boolean;
}

const ROW_CLASS =
  'tw:flex tw:items-center tw:justify-between tw:gap-4 tw:border-b tw:border-border/50 tw:last:border-0';

function InfoRow({ label, value, variant, mono = false }: InfoRowProps) {
  const isModal = variant === 'modal';
  const textClass = isModal ? 'tw:text-sm' : 'tw:text-xs';
  const valueClass = mono
    ? cn('tw:font-mono tw:text-xs tw:text-muted-foreground', !isModal && 'tw:font-medium')
    : cn(textClass, 'tw:font-medium tw:text-foreground');
  return (
    <div className={cn(ROW_CLASS, isModal ? 'tw:py-2.5' : 'tw:py-2')}>
      <span className={cn(textClass, 'tw:text-muted-foreground')}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

/**
 * Renders the facts of a tab as label and value rows. The status bar popover and the info modal
 * show them. The caller gives the container, and the last row has no bottom border in it.
 */
export function TabInfoRows({ tab, variant }: TabInfoRowsProps) {
  const isModal = variant === 'modal';
  const params = tab.layoutParams;

  return (
    <>
      <InfoRow label="Name" value={tab.name} variant={variant} />
      <InfoRow label={isModal ? 'ID' : 'Tab ID'} value={tab.id} variant={variant} mono />
      <InfoRow label="Panel ID" value={tab.panelId || 'None'} variant={variant} mono />
      <InfoRow label="Created" value={new Date(tab.createdAt).toLocaleString()} variant={variant} />
      <InfoRow label="Layout" value={tab.layoutId || 'None'} variant={variant} />
      <InfoRow label="Locked" value={tab.locked ? 'Yes' : 'No'} variant={variant} />
      {isModal && tab.icon && <InfoRow label="Icon" value={tab.icon} variant={variant} />}
      {isModal && tab.style && tab.style !== 'default' && (
        <InfoRow label="Style" value={tab.style} variant={variant} />
      )}
      {!isModal && params && (
        <InfoRow label="Params" value={JSON.stringify(params)} variant={variant} />
      )}
      {isModal && params && Object.keys(params).length > 0 && (
        <div
          className={cn(ROW_CLASS, 'tw:flex-col tw:items-start tw:gap-2 tw:border-b-0 tw:py-2.5')}
        >
          <span className="tw:text-sm tw:text-muted-foreground">Parameters</span>
          <pre className="tw:w-full tw:overflow-x-auto tw:rounded-md tw:bg-muted tw:p-2 tw:font-mono tw:text-xs tw:text-muted-foreground">
            {JSON.stringify(params, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
