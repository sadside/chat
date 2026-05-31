import { useEffect, useState } from 'react';
import { Menu, Sliders } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useChatQuery } from '@/entities/chat/queries';
import { useRouterState } from '@tanstack/react-router';
import { ChatSettingsDialog } from '@/features/chat-settings';

export function Topbar() {
  const { toggleSidebar } = useUiStore();
  const isMobile = !useMediaQuery('(min-width: 768px)');

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const match = pathname.match(/^\/chats\/([^/]+)/);
  const chatId = match ? match[1] : undefined;
  const { data } = useChatQuery(chatId);
  const title = data?.title ?? 'Nova';

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Listen to the global "open-chat-settings" event fired by the command palette.
  useEffect(() => {
    const onOpen = () => {
      if (chatId) setSettingsOpen(true);
    };
    window.addEventListener('nova:open-chat-settings', onOpen);
    return () => window.removeEventListener('nova:open-chat-settings', onOpen);
  }, [chatId]);

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

      <div className="flex flex-1 items-center justify-center gap-2">
        <span className="max-w-[60vw] truncate text-sm font-medium tracking-tight text-[--color-foreground]">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {chatId && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Настройки чата"
            className="rounded p-1.5 text-[--color-muted-foreground] transition-colors hover:bg-[--color-muted] hover:text-[--color-foreground]"
          >
            <Sliders className="h-4 w-4" />
          </button>
        )}
        <ThemeToggle />
        <UserMenu />
      </div>

      {chatId && (
        <ChatSettingsDialog
          chatId={chatId}
          initialPrompt={data?.system_prompt ?? null}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </header>
  );
}
