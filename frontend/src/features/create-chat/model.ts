import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { apiClient as api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';
import type { Chat } from '@/entities/chat/types';

export function useCreateChat() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post('chats').json<Chat>(),
    onSuccess: (chat: Chat) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      router.navigate({ to: '/chats/$chatId', params: { chatId: chat.id } });
    },
  });
}
