import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { useChatsQuery } from '@/entities/chat/queries';
import { messageKeys } from '@/entities/message/queries';
import { apiClient as api } from '@/shared/api/client';
import { useGlobalSearch } from './store';
import type { Message } from '@/entities/message/types';

interface Hit {
  chatId: string;
  chatTitle: string;
  message: Message;
  snippet: string;
}

function snippetAround(text: string, query: string, span = 120): string {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text.slice(0, span);
  const start = Math.max(0, idx - Math.floor(span / 2));
  const end = Math.min(text.length, idx + query.length + Math.floor(span / 2));
  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end) +
    (end < text.length ? '…' : '')
  );
}

export function GlobalSearch() {
  const { open, setOpen } = useGlobalSearch();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { data: chats = [] } = useChatsQuery();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Whenever the overlay opens, fire missing message queries in parallel so
  // search results aren't limited to chats the user already visited.
  const ensureCaches = useMemo(() => {
    return async () => {
      await Promise.all(
        chats.map(async (c) => {
          if (qc.getQueryData(messageKeys.list(c.id))) return;
          try {
            const data = await api.get(`chats/${c.id}/messages`).json<Message[]>();
            qc.setQueryData(messageKeys.list(c.id), data);
          } catch {
            /* ignore — chat may be deleted by another tab */
          }
        }),
      );
    };
  }, [chats, qc]);

  // Kick the fetch off on open without blocking render.
  useMemo(() => {
    if (open) void ensureCaches();
  }, [open, ensureCaches]);

  const allMessages = useMemo<Hit[]>(() => {
    const out: Hit[] = [];
    for (const c of chats) {
      const data = qc.getQueryData<Message[]>(messageKeys.list(c.id));
      if (!data) continue;
      for (const m of data) {
        out.push({ chatId: c.id, chatTitle: c.title, message: m, snippet: '' });
      }
    }
    return out;
  }, [chats, qc, open]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const fuse = new Fuse(allMessages, {
      keys: ['message.content', 'chatTitle'],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    return fuse
      .search(q)
      .slice(0, 30)
      .map((r) => ({ ...r.item, snippet: snippetAround(r.item.message.content, q) }));
  }, [allMessages, query]);

  const go = (h: Hit) => {
    setOpen(false);
    navigate({
      to: '/chats/$chatId',
      params: { chatId: h.chatId },
      search: { focus: h.message.id },
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[active];
      if (hit) go(hit);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[15%] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Поиск по чатам</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Поиск по всем сообщениям…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-2">
          {query.trim() && results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </div>
          )}
          {!query.trim() && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              Введите запрос для поиска по всем чатам
            </div>
          )}
          {results.map((h, i) => (
            <button
              key={h.message.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(h)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                i === active ? 'bg-primary/10' : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                  {h.message.role === 'user' ? 'Вы' : 'Nova'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {h.chatTitle}
                </span>
              </div>
              <div className="mt-1 line-clamp-2 text-foreground">{h.snippet}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
