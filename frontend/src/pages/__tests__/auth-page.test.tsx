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
  it('renders sign-in card', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/auth/me', () =>
        new HttpResponse(null, { status: 401 })
      )
    );
    await renderAuthPage();
    expect(screen.getByText(/sign in to nova/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
