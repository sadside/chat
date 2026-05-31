import { Component, type ReactNode, type ErrorInfo } from 'react';
import { clientLogger, newTraceId } from '@/shared/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Forward to telemetry pipeline. Wrap in try so a logger failure cannot
    // cascade and re-trigger the error boundary.
    try {
      clientLogger.log('error', 'ui.boundary', {
        traceId: newTraceId(),
        message: error.message,
        stack: (error.stack ?? '').slice(0, 2000),
        componentStack: (info.componentStack ?? '').slice(0, 2000),
      });
    } catch {
      /* swallow */
    }
  }

  private handleReset = () => {
    // A bare state-reset only works if the underlying cause is gone. Reload
    // the page so derived state (TanStack Query caches, zustand stores,
    // hung SSE streams) is rebuilt from scratch.
    if (typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-lg font-semibold text-[--color-destructive]">
              Что-то пошло не так
            </p>
            <p className="text-sm text-[--color-muted-foreground]">
              {this.state.error?.message ?? 'Произошла непредвиденная ошибка.'}
            </p>
            <button
              className="mt-4 rounded-md bg-[--color-primary] px-4 py-2 text-sm text-[--color-primary-foreground] hover:opacity-90"
              onClick={this.handleReset}
            >
              Перезагрузить
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
