import { motion } from 'motion/react';
import { Cpu, Code2, BookOpen, Sparkles } from 'lucide-react';

const EXAMPLE_PROMPTS = [
  {
    icon: Cpu,
    title: 'Как работает vLLM?',
    subtitle: 'Объясни архитектуру и PagedAttention',
  },
  {
    icon: Code2,
    title: 'Помоги с кодом',
    subtitle: 'Напиши, отладь или объясни фрагмент',
  },
  {
    icon: BookOpen,
    title: 'Объясни алгоритм',
    subtitle: 'Простым языком с примерами',
  },
  {
    icon: Sparkles,
    title: 'Расскажи короткую историю',
    subtitle: 'На любую тему по твоему выбору',
  },
];

interface EmptyStateProps {
  onPromptClick?: ((prompt: string) => void) | undefined;
}

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <div className="rounded-2xl bg-[--color-primary]/10 p-4">
          <Sparkles className="h-8 w-8 text-[--color-primary]" />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">С чего начнём?</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Задайте вопрос, попросите помощи с кодом или просто поговорите.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 w-full max-w-xl">
        {EXAMPLE_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.08 + idx * 0.06 }}
              onClick={() => onPromptClick?.(item.title)}
              className="group flex items-start gap-3 rounded-xl border border-[--color-border-soft]
                         bg-[--color-card] px-4 py-3.5 text-left
                         hover:border-[--color-primary]/30 hover:bg-[--color-primary]/5
                         transition-colors duration-150"
            >
              <span className="mt-0.5 rounded-lg bg-[--color-primary]/10 p-1.5 text-[--color-primary]
                               group-hover:bg-[--color-primary]/20 transition-colors">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium leading-tight">{item.title}</span>
                <span className="text-xs text-muted-foreground leading-tight">{item.subtitle}</span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
