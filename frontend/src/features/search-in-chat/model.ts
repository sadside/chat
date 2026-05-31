import { useMemo } from 'react';
import Fuse from 'fuse.js';
import type { Message } from '@/entities/message/types';

/**
 * Returns the set of message ids whose content fuzzy-matches `query`.
 * Empty set for empty queries — callers should branch on `query.trim() === ''`
 * to decide between "no filter" and "no matches".
 */
export function useSearchInChat(messages: Message[], query: string): Set<string> {
  return useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return new Set<string>();
    const fuse = new Fuse(messages, {
      keys: ['content'],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    return new Set(fuse.search(trimmed).map((r) => r.item.id));
  }, [messages, query]);
}
