import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import {
  BarChart3,
  Cpu,
  Download,
  MessageSquare,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { apiClient as api } from '@/shared/api/client';
import { chatKeys, useChatsQuery } from '@/entities/chat/queries';
import { useModelsQuery } from '@/entities/model/api';
import { useSelectedModel } from '@/features/select-model';
import { useToggleTheme } from '@/features/toggle-theme/use-toggle-theme';
import { toast } from '@/shared/ui/toast';
import type { Chat } from '@/entities/chat/types';
import { usePalette } from '../store';

interface PaletteCommand {
  id: string;
  title: string;
  hint?: string;
  Icon: typeof Plus;
  section: 'Действия' | 'Чаты' | 'Модели';
  run: (close: () => void) => void;
  keywords?: string[];
}

export function CommandPalette() {
  const { open, query, setOpen, setQuery } = usePalette();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);

  const { data: chats = [] } = useChatsQuery();
  const { data: models = [] } = useModelsQuery();
  const setSelectedModel = useSelectedModel((s) => s.setSelectedModel);
  const { toggle: toggleTheme, isDark } = useToggleTheme();

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  const close = () => setOpen(false);

  const actionCommands: PaletteCommand[] = useMemo(
    () => [
      {
        id: 'new-chat',
        title: 'Новый чат',
        hint: '⌘N',
        Icon: Plus,
        section: 'Действия',
        run: async (cls) => {
          try {
            const chat = await api.post('chats').json<Chat>();
            await qc.invalidateQueries({ queryKey: chatKeys.list() });
            cls();
            navigate({ to: '/chats/$chatId', params: { chatId: chat.id } });
          } catch {
            toast('Не удалось создать чат', 'destructive');
          }
        },
        keywords: ['new', 'create'],
      },
      {
        id: 'toggle-theme',
        title: isDark ? 'Светлая тема' : 'Тёмная тема',
        hint: '⌘⇧L',
        Icon: isDark ? Sun : Moon,
        section: 'Действия',
        run: (cls) => {
          toggleTheme();
          cls();
        },
        keywords: ['theme', 'dark', 'light'],
      },
      {
        id: 'open-stats',
        title: 'Статистика',
        hint: '⌘⇧S',
        Icon: BarChart3,
        section: 'Действия',
        run: (cls) => {
          cls();
          // /stats route is registered separately — bypass type-checked navigate.
          window.location.assign('/stats');
        },
        keywords: ['stats', 'статистика'],
      },
      {
        id: 'export-pdf',
        title: 'Экспорт текущего чата в PDF',
        hint: '⌘⇧E',
        Icon: Download,
        section: 'Действия',
        run: (cls) => {
          const m = window.location.pathname.match(/^\/chats\/([^/]+)/);
          if (!m) {
            toast('Открой чат, чтобы экспортировать', 'destructive');
            return;
          }
          cls();
          window.open(`/chats/${m[1]}/print`, '_blank');
        },
        keywords: ['pdf', 'export', 'экспорт', 'печать'],
      },
      {
        id: 'open-settings',
        title: 'Настройки текущего чата',
        Icon: Settings,
        section: 'Действия',
        run: (cls) => {
          const m = window.location.pathname.match(/^\/chats\/([^/]+)/);
          if (!m) {
            toast('Открой чат, чтобы настроить', 'destructive');
            return;
          }
          cls();
          window.dispatchEvent(new CustomEvent('nova:open-chat-settings'));
        },
        keywords: ['settings', 'system prompt', 'настройки'],
      },
    ],
    [isDark, navigate, qc, toggleTheme],
  );

  const chatCommands: PaletteCommand[] = useMemo(
    () =>
      chats.map((c) => ({
        id: `chat-${c.id}`,
        title: c.title || 'Без названия',
        Icon: MessageSquare,
        section: 'Чаты' as const,
        keywords: [c.title ?? ''],
        run: (cls) => {
          cls();
          navigate({ to: '/chats/$chatId', params: { chatId: c.id } });
        },
      })),
    [chats, navigate],
  );

  const modelCommands: PaletteCommand[] = useMemo(
    () =>
      models.map((m) => ({
        id: `model-${m.id}`,
        title: `Модель · ${m.name}`,
        Icon: Cpu,
        section: 'Модели' as const,
        keywords: [m.id, m.name],
        run: (cls) => {
          setSelectedModel(m.id);
          toast(`Активна модель: ${m.name}`);
          cls();
        },
      })),
    [models, setSelectedModel],
  );

  const all = useMemo(
    () => [...actionCommands, ...chatCommands, ...modelCommands],
    [actionCommands, chatCommands, modelCommands],
  );

  const results = useMemo(() => {
    if (!query.trim()) return all.slice(0, 14);
    const fuse = new Fuse(all, {
      keys: ['title', 'keywords'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    return fuse.search(query).slice(0, 14).map((r) => r.item);
  }, [all, query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      results[active]?.run(close);
    }
  };

  // Group results by section for sectioned rendering.
  const grouped = useMemo(() => {
    const out: { section: PaletteCommand['section']; items: PaletteCommand[] }[] = [];
    for (const r of results) {
      const last = out[out.length - 1];
      if (last && last.section === r.section) last.items.push(r);
      else out.push({ section: r.section, items: [r] });
    }
    return out;
  }, [results]);

  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Командная панель</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-[--color-border] px-4 py-3">
          <Search className="h-4 w-4 text-[--color-muted-foreground]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск чатов, действий, моделей…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[--color-muted-foreground]"
          />
          <kbd className="hidden rounded border border-[--color-border] bg-[--color-muted] px-1.5 py-0.5 text-[10px] text-[--color-muted-foreground] sm:inline">
            ESC
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-[--color-muted-foreground]">
              Ничего не найдено
            </div>
          )}
          {grouped.map((g) => (
            <div key={g.section} className="mb-1">
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[--color-muted-foreground]">
                {g.section}
              </div>
              {g.items.map((cmd) => {
                runningIndex += 1;
                const idx = runningIndex;
                return (
                  <button
                    key={cmd.id}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => cmd.run(close)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      idx === active
                        ? 'bg-[--color-primary]/10 text-[--color-foreground]'
                        : 'hover:bg-[--color-muted]'
                    }`}
                  >
                    <cmd.Icon className="h-4 w-4 text-[--color-muted-foreground]" />
                    <span className="flex-1 truncate">{cmd.title}</span>
                    {cmd.hint && (
                      <kbd className="rounded border border-[--color-border] bg-[--color-muted] px-1.5 py-0.5 text-[10px] text-[--color-muted-foreground]">
                        {cmd.hint}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
