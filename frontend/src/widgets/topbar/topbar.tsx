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
    <header className="flex h-14 items-center border-b border-[--color-border] bg-[--color-background] px-4">
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Open navigation"
          className="mr-2"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}

      <div className="flex items-center gap-2">
        {/* Brand mark / current chat title */}
        <span className="text-lg font-semibold tracking-tight text-[--color-foreground]">
          {title}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
