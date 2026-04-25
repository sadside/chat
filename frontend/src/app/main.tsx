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

window.addEventListener('error', (ev) => {
  clientLogger.log('error', 'unhandled.error', {
    traceId: newTraceId(),
    message: String(ev.message ?? ''),
    source: String(ev.filename ?? ''),
    line: Number(ev.lineno ?? 0),
    col: Number(ev.colno ?? 0),
  });
});

window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
  clientLogger.log('error', 'unhandled.rejection', {
    traceId: newTraceId(),
    reason,
  });
});

window.addEventListener('beforeunload', () => {
  clientLogger.flushSync();
});

const _origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
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

const _origConsoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  _origConsoleWarn(...args);
  clientLogger.log('warn', 'console.warn', {
    traceId: newTraceId(),
    args: args
      .map((a) => (a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ')
      .slice(0, 1000),
  });
};

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
);
