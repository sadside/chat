import { useEffect, useRef } from 'react';

/**
 * Persists `value` to `localStorage` under `nova-draft-${key}` (debounced 200ms).
 * On mount, restores any saved draft into `setValue` if the textarea is empty.
 * Returns a `clear()` to drop the saved entry — call it on successful send.
 *
 * Pass key = '__noop__' to disable (the hook is always called for stable hook
 * order, but reads/writes are skipped).
 */
export function useDraft(
  key: string,
  value: string,
  setValue: (v: string) => void,
): { clear: () => void } {
  const storageKey = `nova-draft-${key}`;
  const restored = useRef(false);
  const enabled = key !== '__noop__';

  useEffect(() => {
    if (!enabled) return;
    if (restored.current) return;
    restored.current = true;
    const saved = localStorage.getItem(storageKey);
    if (saved && !value) setValue(saved);
  }, [enabled, storageKey, setValue, value]);

  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => {
      if (value) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    }, 200);
    return () => clearTimeout(id);
  }, [enabled, storageKey, value]);

  return {
    clear: () => {
      if (enabled) localStorage.removeItem(storageKey);
    },
  };
}
