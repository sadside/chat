import { useEffect } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useMessagesQuery } from '@/entities/message/queries';
import { useChatQuery } from '@/entities/chat/queries';
import { MarkdownContent } from '@/shared/ui/markdown-content';
import { queryClient } from '@/app/providers/query-provider';
import { meQueryOptions } from '@/entities/user/api';

export const Route = createFileRoute('/chats/$chatId/print')({
  beforeLoad: async () => {
    try {
      const u = await queryClient.ensureQueryData(meQueryOptions);
      if (!u) throw redirect({ to: '/auth' });
    } catch (e) {
      if (e && typeof e === 'object' && 'to' in e) throw e;
      throw redirect({ to: '/auth' });
    }
  },
  component: PrintPage,
});

function PrintPage() {
  const { chatId } = Route.useParams();
  const { data: messages = [], isLoading: msgsLoading } = useMessagesQuery(chatId);
  const { data: chat } = useChatQuery(chatId);

  // Auto-trigger the browser print dialog as soon as content is ready.
  useEffect(() => {
    if (msgsLoading) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [msgsLoading]);

  return (
    <div className="print-layout mx-auto max-w-3xl bg-white p-8 text-black">
      <header className="mb-6 border-b border-gray-200 pb-3">
        <h1 className="text-xl font-semibold">{chat?.title ?? 'Чат'}</h1>
        <p className="text-xs text-gray-500">
          Экспортировано {new Date().toLocaleString('ru-RU')}
        </p>
      </header>
      <main className="space-y-6">
        {messages.map((m) => (
          <article key={m.id} className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              {m.role === 'user' ? 'Вы' : 'Nova'}
            </div>
            {m.role === 'user' ? (
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{m.content}</p>
            ) : (
              <MarkdownContent content={m.content} streaming={false} />
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
