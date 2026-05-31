import { Menu } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useChatQuery } from '@/entities/chat/queries';
import { useRouterState } from '@tanstack/react-router';

export function Topbar() {
  const { toggleSidebar } = useUiStore();
  const isMobile = !useMediaQuery('(min-width: 768px)');

  // Derive current chat id from the pathname; always call useChatQuery
  // (with `undefined` when off a chat route) to keep the hook order stable.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const match = pathname.match(/^\/chats\/([^/]+)/);
  const chatId = match ? match[1] : undefined;
  const { data } = useChatQuery(chatId);
  const title = data?.title ?? 'Nova';

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center border-b border-[--color-border]/60 bg-[--color-background]/70 px-4 backdrop-blur-xl">
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Открыть меню навигации"
          className="mr-2"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      <div className="flex items-center gap-2 flex-1 justify-center">
        {/* Current chat title or brand */}
        <span className="text-sm font-medium tracking-tight text-[--color-foreground] truncate max-w-[60vw]">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
