import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/shared/api/client';
import type { Message } from './types';

export const messageKeys = {
  all: ['messages'] as const,
  list: (chatId: string) => [...messageKeys.all, chatId] as const,
};

export function useMessagesQuery(chatId: string) {
  return useQuery({
    queryKey: messageKeys.list(chatId),
    queryFn: () => api.get(`chats/${chatId}/messages`).json<Message[]>(),
    enabled: Boolean(chatId),
    staleTime: 0,
  });
}

export function useInvalidateMessages(chatId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: messageKeys.list(chatId) });
}
