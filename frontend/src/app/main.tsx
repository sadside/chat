import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryProvider } from './providers/query-provider';
import { ThemeProvider } from './providers/theme-provider';
import { router } from './router';
import '@/styles/globals.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('[nova] #root element not found in index.html');

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryProvider>
        <RouterProvider router={router} />
      </QueryProvider>
    </ThemeProvider>
  </StrictMode>,
);
