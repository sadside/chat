import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';
import { Button } from '@/shared/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { ChatListItem } from './chat-list-item';
import { useSearchChats } from '@/features/search-chats';
import { useCreateChat } from '@/features/create-chat';
import { useRenameChat } from '@/features/rename-chat';
import { useDeleteChat } from '@/features/delete-chat';
import { useExportChat } from '@/features/export-chat';
import { apiClient as api } from '@/shared/api/client';
import { useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/entities/chat/queries';
import { toast } from '@/shared/ui/toast';
import { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';

export function Sidebar() {
  const { query, setQuery, results, clearQuery, isFiltering } = useSearchChats();
  const createChat = useCreateChat();
  const renameChat = useRenameChat();
  const deleteChat = useDeleteChat();
  const { exportChat } = useExportChat();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const togglePin = async (id: string, pinned: boolean) => {
    try {
      await api.patch(`chats/${id}`, { json: { pinned } });
      qc.invalidateQueries({ queryKey: chatKeys.list() });
      toast(pinned ? 'Чат закреплён' : 'Чат откреплён');
    } catch {
      toast('Не удалось обновить', 'destructive');
    }
  };

  const { pinned, recent } = useMemo(() => {
    return {
      pinned: results.filter((c) => c.pinned),
      recent: results.filter((c) => !c.pinned),
    };
  }, [results]);

  // Derive currentChatId from pathname without using route-typed useParams,
  // which would require a conditional hook and break the rules-of-hooks.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const match = pathname.match(/^\/chats\/([^/]+)/);
  const currentChatId = match ? match[1] : undefined;

  return (
    <nav data-tour="sidebar" className="flex h-full flex-col gap-1 px-2 py-3 bg-[--color-sidebar]/80 backdrop-blur-xl">
      {/* New chat button */}
      <Button
        onClick={() => createChat.mutate()}
        disabled={createChat.isPending}
        className="w-full justify-between gap-2 rounded-xl px-3 h-10 mb-1"
        variant="outline"
        aria-label="Создать новый чат"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4 shrink-0" />
          <span>Новый чат</span>
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
          <span>⌘</span><span>K</span>
        </kbd>
      </Button>

      {/* Search box */}
      <div className="relative mb-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          className={cn(
            'w-full rounded-lg bg-[--color-background]/50 pl-8 pr-8 h-8 text-sm outline-none',
            'placeholder:text-muted-foreground border-0 ring-0',
            'focus:ring-1 focus:ring-[--color-ring]/40 transition-shadow'
          )}
          placeholder="Поиск по чатам…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Поиск по чатам"
        />
        {isFiltering && (
          <button
            onClick={clearQuery}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Очистить поиск"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Chat list */}
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {results.length === 0 && isFiltering && (
          <p className="px-3 py-4 text-center text-xs text-[--color-muted-foreground]">
            Ничего не найдено
          </p>
        )}

        {pinned.length > 0 && (
          <>
            <p className="select-none px-2 pt-3 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[--color-muted-foreground]">
              Закреплённые
            </p>
            {pinned.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === currentChatId}
                onRename={(id, title) => renameChat.mutate({ id, title })}
                onDelete={(id) => setDeleteTarget({ id, title: chat.title })}
                onExport={exportChat}
                onTogglePin={togglePin}
              />
            ))}
          </>
        )}

        {recent.length > 0 && (
          <>
            <p className="select-none px-2 pt-3 pb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[--color-muted-foreground]">
              Недавнее
            </p>
            {recent.map((chat) => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === currentChatId}
                onRename={(id, title) => renameChat.mutate({ id, title })}
                onDelete={(id) => setDeleteTarget({ id, title: chat.title })}
                onExport={exportChat}
                onTogglePin={togglePin}
              />
            ))}
          </>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; будет удалён вместе со всей историей. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteChat.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}
