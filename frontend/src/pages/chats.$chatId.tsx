import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMessagesQuery } from '@/entities/message/queries';
import { ChatView } from '@/widgets/chat-view';
import { Composer } from '@/widgets/composer';
import { useStreamChat } from '@/features/send-message';
import { useRegenerateMessage } from '@/features/regenerate-message';
import { useStreamStore } from '@/shared/store/stream-store';
import { Skeleton } from '@/shared/ui/skeleton';
import { queryClient } from '@/app/providers/query-provider';
import { meQueryOptions } from '@/entities/user/api';

export const Route = createFileRoute('/chats/$chatId')({
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
  component: ChatPage,
});

function ChatPage() {
  const { chatId } = Route.useParams();

  const { data: messages = [], isLoading } = useMessagesQuery(chatId);
  const { send, stop, isStreaming, status } = useStreamChat(chatId);
  const { regenerate } = useRegenerateMessage(chatId);

  // When we arrived here from the Home submit handler, a stream for this
  // chat was already started before navigation. We no longer need a
  // pending-message handshake.
  //
  // NB: call both selectors UNCONDITIONALLY (no short-circuit) to keep the
  // hook count stable across renders — a `&&` between two hook calls would
  // skip the second one when the first is falsy and crash React with
  // "Rendered fewer hooks than expected".
  const storeChatId = useStreamStore((s) => s.chatId);
  const storeStatus = useStreamStore((s) => s.status);
  const streamForThisChat = storeChatId === chatId && storeStatus !== 'idle';

  if (isLoading && !streamForThisChat) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className={`h-12 ${i % 2 === 0 ? 'w-3/4 self-end' : 'w-2/3'}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatView
        messages={messages}
        chatId={chatId}
        onRegenerate={regenerate}
        onExamplePrompt={(p) => send(p)}
      />
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <Composer
          onSend={send}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={status === 'error'}
        />
        {status === 'error' && (
          <p className="mt-1 text-xs text-destructive text-center">
            Не удалось отправить сообщение. Попробуйте ещё раз.
          </p>
        )}
      </div>
    </div>
  );
}
