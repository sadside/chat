import { useState, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useChatsQuery } from '@/entities/chat/queries';
import type { Chat } from '@/entities/chat/types';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSearchChats() {
  const { data: chats = [] } = useChatsQuery();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const fuse = useMemo(
    () =>
      new Fuse<Chat>(chats, {
        keys: ['title'],
        threshold: 0.4,
        includeScore: true,
      }),
    [chats]
  );

  const results: Chat[] = useMemo(() => {
    if (!debouncedQuery.trim()) return chats;
    return fuse.search(debouncedQuery).map((r) => r.item);
  }, [debouncedQuery, fuse, chats]);

  const clearQuery = useCallback(() => setQuery(''), []);

  return { query, setQuery, results, clearQuery, isFiltering: Boolean(debouncedQuery.trim()) };
}
