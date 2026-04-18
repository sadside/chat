import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from '../sidebar';
import type { Chat } from '@/entities/chat/types';

// Mock hooks
vi.mock('@/features/search-chats', () => ({
  useSearchChats: () => ({
    query: '',
    setQuery: vi.fn(),
    results: [
      { id: 'c1', title: 'Test Chat', created_at: '', updated_at: '' },
    ] as Chat[],
    clearQuery: vi.fn(),
    isFiltering: false,
  }),
}));
vi.mock('@/features/create-chat', () => ({
  useCreateChat: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/rename-chat', () => ({
  useRenameChat: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/delete-chat', () => ({
  useDeleteChat: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/features/export-chat', () => ({
  useExportChat: () => ({ exportChat: vi.fn() }),
}));
vi.mock('@tanstack/react-router', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await importOriginal() as any;
  return {
    ...mod,
    useParams: vi.fn().mockImplementation(() => { throw new Error('Not on chat route'); }),
    Link: ({ children, ...props }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string }) => <a href={String(props.to)}>{children}</a>,
  };
});

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('Sidebar', () => {
  it('renders New chat button', () => {
    render(<Wrapper><Sidebar /></Wrapper>);
    expect(screen.getByText('New chat')).toBeInTheDocument();
  });

  it('renders chat list item', () => {
    render(<Wrapper><Sidebar /></Wrapper>);
    expect(screen.getByText('Test Chat')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<Wrapper><Sidebar /></Wrapper>);
    expect(screen.getByPlaceholderText('Search chats…')).toBeInTheDocument();
  });
});
