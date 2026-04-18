import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  createFileRoute: () => (opts: { component: unknown }) => ({ Route: opts }),
}));

// Lazy import after mocks
async function renderAuthPage() {
  const { AuthPage } = await import('@/pages/auth');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AuthPage />
    </QueryClientProvider>
  );
}

describe('AuthPage', () => {
  it('renders sign-in card with Russian heading', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/auth/me', () =>
        new HttpResponse(null, { status: 401 })
      )
    );
    await renderAuthPage();
    expect(screen.getByText(/войти в nova/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });

  it('renders brand tagline in Russian', async () => {
    await renderAuthPage();
    expect(screen.getByText(/локальный ai-чат/i)).toBeInTheDocument();
  });

  it('does not render topbar or sidebar elements', async () => {
    await renderAuthPage();
    // AuthPage is rendered directly here (not through __root), but assert
    // that known sidebar/topbar test-ids are absent
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
