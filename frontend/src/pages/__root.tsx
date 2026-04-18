import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { SidebarPlaceholder } from '@/widgets/sidebar/sidebar-placeholder';
import { Topbar } from '@/widgets/topbar/topbar';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { ErrorBoundary } from '@/app/error-boundary';
import { Toaster } from '@/shared/ui/sonner';

function RootLayout() {
  const { sidebarOpen, closeSidebar } = useUiStore();
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Close mobile drawer when resizing to desktop
  useEffect(() => {
    if (isDesktop && sidebarOpen) {
      closeSidebar();
    }
  }, [isDesktop, sidebarOpen, closeSidebar]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col overflow-hidden bg-[--color-background] text-[--color-foreground]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar — always visible */}
          {isDesktop && <SidebarPlaceholder />}

          {/* Mobile sidebar — Sheet drawer */}
          {!isDesktop && (
            <Dialog open={sidebarOpen} onOpenChange={(open) => !open && closeSidebar()}>
              <DialogContent className="left-0 top-0 h-full max-w-[280px] translate-x-0 translate-y-0 rounded-none p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
                <DialogHeader className="sr-only">
                  <DialogTitle>Navigation</DialogTitle>
                </DialogHeader>
                <SidebarPlaceholder className="w-full border-0" />
              </DialogContent>
            </Dialog>
          )}

          {/* Main content area */}
          <main className="flex flex-1 flex-col overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ErrorBoundary>
    <Toaster />
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
