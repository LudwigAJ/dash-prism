import React, { Component, type ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@components/ui';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@utils/logger';

/**
 * Error boundary level determines the recovery options shown.
 * - 'panel': Shows "Try again" to retry rendering the panel content (default)
 * - 'workspace': Shows "Refresh page" and "Clear storage & refresh" for critical failures
 *
 * Use this component to wrap content at any level:
 * - Tab content: catches errors in individual tab layouts
 * - Panel: catches errors in panel rendering
 * - Workspace: catches catastrophic errors at the top level
 */
export type ErrorBoundaryLevel = 'panel' | 'workspace';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /**
   * The level of this error boundary.
   * @default 'panel'
   */
  level?: ErrorBoundaryLevel;
  /**
   * Callback to clear persisted storage (for workspace level reset).
   */
  onClearStorage?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * ErrorBoundary catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI.
 *
 * Can be used at different levels:
 * - Wrap tab content to isolate tab crashes
 * - Wrap panels to prevent one panel from crashing others
 * - Wrap the entire workspace for catastrophic error handling
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRefreshPage = () => {
    window.location.reload();
  };

  handleClearStorageAndRefresh = () => {
    this.props.onClearStorage?.();
    window.location.reload();
  };

  render() {
    const { level = 'panel' } = this.props;

    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="prism-scrollable tw:flex tw:h-full tw:items-center tw:justify-center tw:p-6">
            <Card className="tw:w-full tw:max-w-md">
              <CardHeader>
                <div className="tw:flex tw:items-center tw:gap-2">
                  <AlertTriangle className="tw:size-[1.25em] tw:text-destructive" />
                  <CardTitle>Something went wrong</CardTitle>
                </div>
                <CardDescription>
                  {level === 'workspace'
                    ? 'A critical error occurred. The workspace cannot continue.'
                    : 'An error occurred while rendering this content.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="tw:space-y-4">
                <p className="tw:rounded tw:bg-muted tw:p-2 tw:font-mono tw:text-sm tw:text-muted-foreground">
                  {this.state.error?.message}
                </p>

                <div className="tw:text-sm tw:text-secondary">
                  {level === 'workspace' ? (
                    <>
                      <button
                        type="button"
                        className="tw:cursor-pointer tw:text-primary tw:hover:underline"
                        onClick={this.handleRefreshPage}
                        data-testid="prism-error-action-refresh"
                      >
                        Refresh page
                      </button>
                      {this.props.onClearStorage && (
                        <>
                          <span className="tw:mx-2">or</span>
                          <button
                            type="button"
                            className="tw:cursor-pointer tw:text-destructive tw:hover:underline"
                            onClick={this.handleClearStorageAndRefresh}
                            data-testid="prism-error-action-clear-storage"
                          >
                            clear storage & refresh
                          </button>
                        </>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      className="tw:cursor-pointer tw:text-primary tw:hover:underline"
                      onClick={this.handleRetry}
                      data-testid="prism-error-action-retry"
                    >
                      Try again
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
