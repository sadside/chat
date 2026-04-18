import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from '@tanstack/react-router';
import { apiClient as api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';

export function useDeleteChat() {
  const qc = useQueryClient();
  const router = useRouter();

  // Try to read the current chatId param; may not exist on home page.
  let currentChatId: string | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const params = useParams({ from: '/chats/$chatId' });
    currentChatId = params.chatId;
  } catch {
    currentChatId = undefined;
  }

  return useMutation({
    mutationFn: (id: string) => api.delete(`chats/${id}`),

    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      qc.removeQueries({ queryKey: chatKeys.detail(id) });
      if (currentChatId === id) {
        router.navigate({ to: '/' });
      }
    },
  });
}
