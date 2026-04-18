import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchChats } from '../model';
import type { Chat } from '@/entities/chat/types';

// Mock useChatsQuery
vi.mock('@/entities/chat/queries', () => ({
  useChatsQuery: () => ({
    data: [
      { id: '1', title: 'JavaScript basics', created_at: '', updated_at: '' },
      { id: '2', title: 'Python async', created_at: '', updated_at: '' },
      { id: '3', title: 'React patterns', created_at: '', updated_at: '' },
    ] satisfies Chat[],
  }),
}));

describe('useSearchChats', () => {
  it('returns all chats when query is empty', () => {
    const { result } = renderHook(() => useSearchChats());
    expect(result.current.results).toHaveLength(3);
    expect(result.current.isFiltering).toBe(false);
  });

  it('filters chats by title', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useSearchChats());
    act(() => { result.current.setQuery('python'); });
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.results.length).toBeLessThan(3);
    vi.useRealTimers();
  });

  it('clearQuery resets results', () => {
    const { result } = renderHook(() => useSearchChats());
    act(() => { result.current.setQuery('python'); });
    act(() => { result.current.clearQuery(); });
    expect(result.current.query).toBe('');
    expect(result.current.isFiltering).toBe(false);
  });
});
