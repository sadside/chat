import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryProvider } from './providers/query-provider';
import { ThemeProvider } from './providers/theme-provider';
import { router } from './router';
import { clientLogger, newTraceId } from '@/shared/logger';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('[nova] #root element not found in index.html');

// Named handlers so HMR can detach them on module reload.
const _origConsoleError = console.error.bind(console);
const _origConsoleWarn = console.warn.bind(console);

const _onError = (ev: ErrorEvent) => {
  clientLogger.log('error', 'unhandled.error', {
    traceId: newTraceId(),
    message: String(ev.message ?? ''),
    source: String(ev.filename ?? ''),
    line: Number(ev.lineno ?? 0),
    col: Number(ev.colno ?? 0),
  });
};

const _onRejection = (ev: PromiseRejectionEvent) => {
  const reason = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
  clientLogger.log('error', 'unhandled.rejection', {
    traceId: newTraceId(),
    reason,
  });
};

const _onBeforeUnload = () => {
  clientLogger.flushSync();
};

const _patchedConsoleError = (...args: unknown[]) => {
  _origConsoleError(...args);
  clientLogger.log('error', 'console.error', {
    traceId: newTraceId(),
    args: args
      .map((a) => {
        if (a instanceof Error) return a.message;
        if (typeof a === 'object') {
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      })
      .join(' ')
      .slice(0, 1000),
  });
};

const _patchedConsoleWarn = (...args: unknown[]) => {
  _origConsoleWarn(...args);
  clientLogger.log('warn', 'console.warn', {
    traceId: newTraceId(),
    args: args
      .map((a) => (a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ')
      .slice(0, 1000),
  });
};

window.addEventListener('error', _onError);
window.addEventListener('unhandledrejection', _onRejection);
window.addEventListener('beforeunload', _onBeforeUnload);
console.error = _patchedConsoleError;
console.warn = _patchedConsoleWarn;

// Vite HMR may reload this module while the page stays live. Without these
// disposers each reload would stack a fresh copy of every listener and the
// console-patch chain would grow without bound.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('error', _onError);
    window.removeEventListener('unhandledrejection', _onRejection);
    window.removeEventListener('beforeunload', _onBeforeUnload);
    console.error = _origConsoleError;
    console.warn = _origConsoleWarn;
  });
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
);
