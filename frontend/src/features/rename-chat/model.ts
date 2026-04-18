import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';
import type { Chat, ChatUpdatePayload } from '@/entities/chat/types';

export function useRenameChat() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch(`chats/${id}`, { json: { title } satisfies ChatUpdatePayload }).json<Chat>(),

    onMutate: async ({ id, title }) => {
      await qc.cancelQueries({ queryKey: chatKeys.list() });
      const previous = qc.getQueryData<Chat[]>(chatKeys.list());
      qc.setQueryData<Chat[]>(chatKeys.list(), (old) =>
        old?.map((c) => (c.id === id ? { ...c, title } : c)) ?? []
      );
      return { previous };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(chatKeys.list(), ctx.previous);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: chatKeys.list() });
    },
  });
}
