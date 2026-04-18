import { createRootRoute, Outlet } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Sidebar } from '@/widgets/sidebar';
import { Topbar } from '@/widgets/topbar/topbar';
import { useUiStore } from '@/shared/store/ui-store';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { ErrorBoundary } from '@/app/error-boundary';
import { Toaster } from '@/shared/ui/sonner';
import { useMeQuery } from '@/entities/user/api';
import { useAuthStore } from '@/shared/store/auth-store';

function RootLayout() {
  const { sidebarOpen, closeSidebar } = useUiStore();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { data: meUser } = useMeQuery();
  const { setUser, clearUser } = useAuthStore();

  // Close mobile drawer when resizing to desktop
  useEffect(() => {
    if (isDesktop && sidebarOpen) {
      closeSidebar();
    }
  }, [isDesktop, sidebarOpen, closeSidebar]);

  // Sync server auth state into the zustand store
  useEffect(() => {
    if (meUser) {
      setUser(meUser);
    } else {
      clearUser();
    }
  }, [meUser, setUser, clearUser]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col overflow-hidden bg-[--color-background] text-[--color-foreground]">
        <Topbar />
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar — always visible */}
          {isDesktop && (
            <aside className="flex h-full w-64 flex-col border-r border-[--color-border] bg-[--color-background]">
              <Sidebar />
            </aside>
          )}

          {/* Mobile sidebar — Sheet drawer */}
          {!isDesktop && (
            <Dialog open={sidebarOpen} onOpenChange={(open) => !open && closeSidebar()}>
              <DialogContent className="left-0 top-0 h-full max-w-[280px] translate-x-0 translate-y-0 rounded-none p-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
                <DialogHeader className="sr-only">
                  <DialogTitle>Navigation</DialogTitle>
                </DialogHeader>
                <Sidebar />
              </DialogContent>
            </Dialog>
          )}

          {/* Main content area */}
          <main className="flex flex-1 flex-col overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster />
    </ErrorBoundary>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});
