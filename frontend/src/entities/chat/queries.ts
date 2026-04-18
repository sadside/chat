import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/shared/api/client';
import type { Chat } from './types';

export const chatKeys = {
  all: ['chats'] as const,
  list: () => [...chatKeys.all, 'list'] as const,
  detail: (id: string) => [...chatKeys.all, 'detail', id] as const,
};

export function useChatsQuery() {
  return useQuery({
    queryKey: chatKeys.list(),
    queryFn: () => api.get('chats').json<Chat[]>(),
    staleTime: 30_000,
  });
}

export function useChatQuery(id: string | undefined) {
  return useQuery({
    queryKey: chatKeys.detail(id ?? '__none__'),
    queryFn: () => api.get(`chats/${id}`).json<Chat>(),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useInvalidateChats() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: chatKeys.list() });
}
