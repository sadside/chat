import { motion } from 'motion/react';
import { NovaAvatar } from '@/shared/ui/nova-avatar';
import { useModelsQuery } from '@/entities/model/api';
import { useSelectedModel } from '@/features/select-model';
import { toast } from '@/shared/ui/toast';

interface EmptyStateProps {
  onPromptClick?: ((prompt: string) => void) | undefined;
}

function hourGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

type Slot = 'morning' | 'day' | 'evening';

const PROMPT_SETS: Record<Slot, string[]> = {
  morning: [
    'Расскажи свежую новость по технологиям',
    'Объясни концепцию энтропии простыми словами',
    'Помоги составить план на день',
    'Что такое vLLM и зачем он нужен?',
  ],
  day: [
    'Напиши Python-скрипт, который читает CSV и считает среднее',
    'Объясни сортировку слиянием через пример',
    'Помоги улучшить мой текст',
    'Какие книги почитать про системный дизайн?',
  ],
  evening: [
    'Подбери идею для пет-проекта на выходные',
    'Расскажи интересный факт про космос',
    'Напиши короткое стихотворение про код',
    'Идеи для отдыха завтра',
  ],
};

function timeSlot(): Slot {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'day';
  return 'evening';
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  const greeting = hourGreeting();
  const prompts = PROMPT_SETS[timeSlot()];
  const { data: models = [] } = useModelsQuery();
  const setSelectedModel = useSelectedModel((s) => s.setSelectedModel);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-10 px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        <div className="mx-auto mb-5 w-fit">
          <NovaAvatar size={52} />
        </div>
        <h1 className="font-display text-[1.7rem] font-semibold tracking-tight sm:text-3xl">
          {greeting}, <span className="text-accent-gradient">я Nova</span>
        </h1>
        <p className="mx-auto mt-2.5 max-w-md text-sm text-muted-foreground">
          Локальная языковая модель. Полная приватность — ничего не уходит в облако.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {prompts.map((p, i) => (
          <motion.button
            key={p}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1], delay: 0.08 + i * 0.04 }}
            onClick={() => onPromptClick?.(p)}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground transition-all duration-150 hover:border-primary/40 hover:bg-accent hover:text-foreground"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border transition-colors group-hover:bg-primary" aria-hidden="true" />
            <span className="line-clamp-2">{p}</span>
          </motion.button>
        ))}
      </div>

      {models.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Доступные модели
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {models.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSelectedModel(m.id);
                  toast(`Активна модель: ${m.name}`);
                }}
                className="min-w-[240px] rounded-xl border border-border bg-card/60 p-3 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-card hover:shadow-md"
              >
                <div className="text-sm font-medium text-foreground">{m.name}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {m.description}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {m.capabilities.slice(0, 3).map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                    >
                      {c}
                    </span>
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {(m.context_window / 1000).toFixed(0)}k
                  </span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
