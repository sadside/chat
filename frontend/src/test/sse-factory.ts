import type { EventSourceMessage } from '@microsoft/fetch-event-source';

export interface FakeSseScript {
  event: string;
  data: unknown;
}

/**
 * Creates a jest/vitest-compatible mock for fetchEventSource that
 * plays through `script` synchronously (or with microtask delays).
 */
export function createFakeEventSource(script: FakeSseScript[]) {
  return async (
    _url: string,
    opts: {
      onopen?: (r: Response) => Promise<void>;
      onmessage?: (ev: EventSourceMessage) => void;
      onerror?: (err: unknown) => void;
      onclose?: () => void;
    }
  ) => {
    await opts.onopen?.(new Response(null, { status: 200 }));
    for (const item of script) {
      const msg: EventSourceMessage = {
        event: item.event,
        data: JSON.stringify(item.data),
        id: '',
      };
      opts.onmessage?.(msg);
      await Promise.resolve(); // yield to allow state updates
    }
    opts.onclose?.();
  };
}
