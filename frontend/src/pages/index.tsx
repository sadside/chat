import { useState, useCallback } from 'react';
import { useRouter } from '@tanstack/react-router';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { apiClient as api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';
import { useQueryClient } from '@tanstack/react-query';
import { Composer } from '@/widgets/composer';
import { EmptyState } from '@/widgets/chat-view';
import { useStreamStore } from '@/shared/store/stream-store';
import { startMessageStream } from '@/features/send-message';
import { queryClient } from '@/app/providers/query-provider';
import { meQueryOptions } from '@/entities/user/api';
import type { Chat } from '@/entities/chat/types';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // Check auth — redirect to /auth if unauthenticated
    try {
      const user = await queryClient.ensureQueryData(meQueryOptions);
      if (!user) throw redirect({ to: '/auth' });
    } catch (err) {
      if (err && typeof err === 'object' && 'to' in err) throw err;
      throw redirect({ to: '/auth' });
    }
  },
  component: HomePage,
});

function HomePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const stream = useStreamStore();

  const handleSend = useCallback(
    async (content: string) => {
      setCreating(true);
      try {
        // 1. Create the chat shell server-side.
        const chat = await api.post('chats').json<Chat>();
        qc.invalidateQueries({ queryKey: chatKeys.list() });

        // 2. Kick off the SSE stream BEFORE navigating so the chat page
        // already sees an active overlay on its first render — no flash
        // of skeleton → empty-state → chat view during hand-off.
        void startMessageStream({ chatId: chat.id, content, qc });

        // 3. Navigate to the chat route. No state handoff needed anymore.
        await router.navigate({
          to: '/chats/$chatId',
          params: { chatId: chat.id },
        });
      } finally {
        setCreating(false);
      }
    },
    [router, qc]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <EmptyState onPromptClick={(p) => handleSend(p)} />
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <Composer
          onSend={handleSend}
          disabled={creating || stream.status === 'streaming'}
          placeholder="Начните новый разговор…"
        />
      </div>
    </div>
  );
}
