import { Menu } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useChatQuery } from '@/entities/chat/queries';
import { useParams } from '@tanstack/react-router';

export function Topbar() {
  const { toggleSidebar } = useUiStore();
  const isMobile = !useMediaQuery('(min-width: 768px)');

  let title = 'Nova';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { chatId } = useParams({ from: '/chats/$chatId' });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useChatQuery(chatId);
    if (data?.title) title = data.title;
  } catch {
    // Not on a chat route
  }

  return (
    <header className="flex h-12 items-center bg-[--color-background] px-4 shadow-sm">
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
