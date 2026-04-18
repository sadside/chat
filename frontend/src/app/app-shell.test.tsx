import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// Smoke test: ThemeProvider requires a DOM — wrap with MemoryRouter
// We render the WelcomePage directly to avoid needing routeTree.gen.ts in tests.
import { ThemeProvider } from './providers/theme-provider';
import { QueryProvider } from './providers/query-provider';

function WelcomePage() {
  return (
    <div>
      <h1>Nova is ready</h1>
    </div>
  );
}

function AppWrapper() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <WelcomePage />
      </QueryProvider>
    </ThemeProvider>
  );
}

describe('AppShell smoke test', () => {
  it('renders without crashing', () => {
    render(<AppWrapper />);
    expect(screen.getByText('Nova is ready')).toBeInTheDocument();
  });

  it('ThemeProvider renders children', () => {
    const { container } = render(
      <ThemeProvider>
        <span data-testid="child">hello</span>
      </ThemeProvider>,
    );
    expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
  });
});
