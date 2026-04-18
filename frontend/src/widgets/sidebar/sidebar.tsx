import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useParams } from '@tanstack/react-router';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
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

export function Sidebar() {
  const { query, setQuery, results, clearQuery, isFiltering } = useSearchChats();
  const createChat = useCreateChat();
  const renameChat = useRenameChat();
  const deleteChat = useDeleteChat();
  const { exportChat } = useExportChat();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  let currentChatId: string | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const params = useParams({ from: '/chats/$chatId' });
    currentChatId = params.chatId;
  } catch {
    currentChatId = undefined;
  }

  return (
    <nav className="flex h-full flex-col gap-2 px-2 py-3">
      {/* New chat button */}
      <Button
        onClick={() => createChat.mutate()}
        disabled={createChat.isPending}
        className="w-full justify-start gap-2"
        variant="outline"
      >
        <Plus className="h-4 w-4" />
        New chat
      </Button>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-8 pr-8 h-8 text-sm"
          placeholder="Search chats…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isFiltering && (
          <button
            onClick={clearQuery}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto space-y-0.5">
        {results.length === 0 && isFiltering && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">No chats found</p>
        )}
        {results.map((chat) => (
          <ChatListItem
            key={chat.id}
            chat={chat}
            isActive={chat.id === currentChatId}
            onRename={(id, title) => renameChat.mutate({ id, title })}
            onDelete={(id) => setDeleteTarget({ id, title: chat.title })}
            onExport={exportChat}
          />
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted along with all its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteChat.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}
