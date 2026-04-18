import { Menu } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from './theme-toggle';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';

export function Topbar() {
  const { toggleSidebar } = useUiStore();
  const isMobile = !useMediaQuery('(min-width: 768px)');

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
        {/* Brand mark */}
        <span className="text-lg font-semibold tracking-tight text-[--color-foreground]">
          Nova
        </span>
      </div>

      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
