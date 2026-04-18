import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useAuthStore } from '@/shared/store/auth-store';
import { UserMenu } from '@/widgets/topbar/user-menu';
import React from 'react';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouter: () => ({ navigate: mockNavigate }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('UserMenu', () => {
  beforeEach(() => {
    useAuthStore.getState().setUser({ id: 'u1', email: 'john@example.com' });
    mockNavigate.mockReset();
  });

  it('shows initials avatar', () => {
    render(<UserMenu />, { wrapper });
    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('shows email in dropdown', async () => {
    render(<UserMenu />, { wrapper });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    expect(await screen.findByText('john@example.com')).toBeInTheDocument();
  });

  it('calls logout and redirects to /auth', async () => {
    server.use(
      http.post('http://localhost:8080/api/v1/auth/logout', () =>
        new HttpResponse(null, { status: 204 })
      )
    );
    render(<UserMenu />, { wrapper });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText(/log out/i));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith({ to: '/auth' }));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
