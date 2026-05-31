import { createFileRoute, redirect, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { queryClient } from '@/app/providers/query-provider';
import { meQueryOptions } from '@/entities/user/api';
import { useStatsQuery } from '@/features/stats/api';
import { MessagesByDayChart } from '@/widgets/stats/MessagesByDayChart';

export const Route = createFileRoute('/stats')({
  beforeLoad: async () => {
    try {
      const u = await queryClient.ensureQueryData(meQueryOptions);
      if (!u) throw redirect({ to: '/auth' });
    } catch (e) {
      if (e && typeof e === 'object' && 'to' in e) throw e;
      throw redirect({ to: '/auth' });
    }
  },
  component: StatsPage,
});

interface CardProps {
  label: string;
  value: string | number;
  sub?: string;
}
function Card({ label, value, sub }: CardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StatsPage() {
  const { data, isLoading, isError, error } = useStatsQuery();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Статистика
        </h1>
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          В чаты
        </Link>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      )}
      {isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Не удалось загрузить статистику: {(error as Error).message}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card label="Чатов" value={data.total_chats} />
            <Card label="Сообщений" value={data.total_messages} />
            <Card
              label="Знаков от вас"
              value={data.total_chars_sent.toLocaleString('ru-RU')}
            />
            <Card
              label="Знаков от Nova"
              value={data.total_chars_generated.toLocaleString('ru-RU')}
            />
            <Card
              label="Средн. ответ"
              value={`${data.avg_assistant_response_chars} симв`}
            />
            <Card label="Самый длинный чат" value={`${data.longest_chat_messages} сообщ`} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Активность за 14 дней
            </div>
            <MessagesByDayChart data={data.messages_by_day} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Использование моделей
            </div>
            <ul className="space-y-1 text-sm">
              {data.model_usage.map((m) => (
                <li key={m.model} className="flex items-center justify-between">
                  <span className="text-foreground">{m.model}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {m.messages}
                  </span>
                </li>
              ))}
              {data.model_usage.length === 0 && (
                <li className="text-muted-foreground">Пока нет данных</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
