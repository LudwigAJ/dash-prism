import React from 'react';
import { useConfig } from '@context/ConfigContext';
import { NewLayout } from '@components/layouts/NewLayout';
import { SHORTCUTS, formatShortcut, isMacPlatform } from '@constants/shortcuts';
import type { TabId, EmptyTabView as EmptyTabViewKind } from '@types';

type EmptyTabViewProps = {
  tabId: TabId;
};

/**
 * Normalises the `emptyTabView` prop. Dash props are untyped at runtime, so an
 * unknown value (a typo in Python) falls back to the layout grid rather than
 * blanking the tab. Pure; exported for unit tests.
 */
export function resolveEmptyTabView(view: EmptyTabViewKind | undefined): EmptyTabViewKind {
  return view === 'hint' || view === 'none' ? view : 'layouts';
}

/**
 * Renders the body of a tab that has no layout selected, according to the
 * `emptyTabView` config prop.
 */
export function EmptyTabView({ tabId }: EmptyTabViewProps) {
  const { emptyTabView, enableKeyboardShortcuts } = useConfig();
  const view = resolveEmptyTabView(emptyTabView);

  if (view === 'layouts') {
    return <NewLayout tabId={tabId} />;
  }

  if (view === 'hint') {
    return (
      <div
        data-testid="prism-empty-tab-hint"
        className="tw:flex tw:h-full tw:w-full tw:items-center tw:justify-center tw:bg-background tw:p-6 tw:text-center tw:text-[0.95em] tw:text-muted-foreground"
      >
        <p>
          Use the search bar to open a layout
          {enableKeyboardShortcuts && (
            <span className="tw:ml-2 tw:opacity-70">
              (
              <kbd className="tw:font-mono">
                {formatShortcut(SHORTCUTS.focusSearch, isMacPlatform())}
              </kbd>
              )
            </span>
          )}
        </p>
      </div>
    );
  }

  // 'none'
  return (
    <div data-testid="prism-empty-tab-blank" className="tw:h-full tw:w-full tw:bg-background" />
  );
}
