import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { apiClient as api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';

export function useDeleteChat() {
  const qc = useQueryClient();
  const router = useRouter();

  // Derive current chat id from pathname without conditional hooks.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const match = pathname.match(/^\/chats\/([^/]+)/);
  const currentChatId = match ? match[1] : undefined;

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
