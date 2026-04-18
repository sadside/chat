import { Component, type ReactNode, type ErrorInfo } from 'react';

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
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-2">
            <p className="text-lg font-semibold text-[--color-destructive]">
              Something went wrong
            </p>
            <p className="text-sm text-[--color-muted-foreground]">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              className="mt-4 rounded-md bg-[--color-primary] px-4 py-2 text-sm text-[--color-primary-foreground] hover:opacity-90"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
