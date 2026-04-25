import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { clientLogger, newTraceId } from '@/shared/logger';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

router.subscribe('onResolved', ({ toLocation }) => {
  clientLogger.log('info', 'nav', {
    traceId: newTraceId(),
    route: toLocation?.pathname ?? router.state.location.pathname,
  });
});
