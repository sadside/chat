import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { MoreHorizontal, Pencil, Trash2, Download, Check, X } from 'lucide-react';
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
}

export function ChatListItem({
  chat,
  isActive,
  onRename,
  onDelete,
  onExport,
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
        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
        'cursor-pointer'
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
          />
          <button onClick={commitEdit} aria-label="Confirm rename">
            <Check className="h-3.5 w-3.5 text-green-500" />
          </button>
          <button onClick={cancelEdit} aria-label="Cancel rename">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <>
          <Link
            to="/chats/$chatId"
            params={{ chatId: chat.id }}
            className="flex-1 truncate"
          >
            {chat.title}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5
                           hover:bg-background/80"
                onClick={(e) => e.preventDefault()}
                aria-label="Chat options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={startEdit}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(chat.id, chat.title)}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(chat.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </motion.div>
  );
}
