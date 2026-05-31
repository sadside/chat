import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { MoreHorizontal, Pencil, Trash2, Download, Check, X, Pin, PinOff } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import type { Chat } from '@/entities/chat/types';

interface ChatListItemProps {
  chat: Chat;
  isActive: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
}

export function ChatListItem({
  chat,
  isActive,
  onRename,
  onDelete,
  onExport,
  onTogglePin,
}: ChatListItemProps) {
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditTitle(chat.title);
    setEditMode(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = () => {
    const t = editTitle.trim();
    if (t && t !== chat.title) onRename(chat.id, t);
    setEditMode(false);
  };

  const cancelEdit = () => {
    setEditTitle(chat.title);
    setEditMode(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.12 }}
      className={cn(
        'group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
        isActive
          ? 'bg-[--color-primary]/10 text-foreground border-l-2 border-l-[--color-primary] pl-[10px]'
          : 'hover:bg-[--color-primary]/5 border-l-2 border-l-transparent',
        'cursor-pointer transition-colors'
      )}
    >
      {editMode ? (
        <div className="flex flex-1 items-center gap-1">
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            className="flex-1 bg-transparent outline-none text-sm"
            maxLength={200}
            autoFocus
            placeholder="Название чата"
            aria-label="Название чата"
          />
          <button onClick={commitEdit} aria-label="Подтвердить переименование">
            <Check className="h-3.5 w-3.5 text-green-500" />
          </button>
          <button onClick={cancelEdit} aria-label="Отменить переименование">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <>
          <Link
            to="/chats/$chatId"
            params={{ chatId: chat.id }}
            className="flex flex-1 items-center gap-1.5 truncate"
          >
            {chat.pinned && <Pin className="h-3 w-3 shrink-0 text-[--color-primary]" />}
            <span className="truncate">{chat.title}</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'transition-opacity rounded p-0.5 hover:bg-background/80',
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
                onClick={(e) => e.preventDefault()}
                aria-label="Параметры чата"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={startEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Переименовать
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onTogglePin(chat.id, !chat.pinned)}>
                {chat.pinned ? (
                  <PinOff className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Pin className="mr-2 h-3.5 w-3.5" />
                )}
                {chat.pinned ? 'Открепить' : 'Закрепить'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(chat.id, chat.title)}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Экспорт
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(chat.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </motion.div>
  );
}
