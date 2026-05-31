import { useEffect, useState } from 'react';
import { Menu, Sliders, PanelLeft } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { useChatQuery } from '@/entities/chat/queries';
import { useRouterState } from '@tanstack/react-router';
import { ChatSettingsDialog } from '@/features/chat-settings';
import { NovaAvatar } from '@/shared/ui/nova-avatar';

export function Topbar() {
  const { toggleSidebar, toggleDesktopCollapsed } = useUiStore();
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
    <header className="glass sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/50 px-3 sm:px-4">
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Открыть меню навигации"
          className="-ml-1"
        >
          <Menu className="h-4 w-4" />
        </Button>
      ) : (
        <button
          onClick={toggleDesktopCollapsed}
          aria-label="Свернуть/развернуть панель"
          className="-ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* Brand wordmark — anchors the bar on desktop */}
      <div className="hidden items-center gap-2 md:flex">
        <NovaAvatar size={24} />
        <span className="font-display text-[15px] font-semibold tracking-tight">
          <span className="text-accent-gradient">Nova</span>
        </span>
        <span className="h-4 w-px bg-border" />
      </div>

      <div className="flex flex-1 items-center justify-center gap-2 md:justify-start">
        <span className="max-w-[55vw] truncate text-sm font-medium tracking-tight text-foreground md:max-w-md">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        {chatId && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Настройки чата"
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
