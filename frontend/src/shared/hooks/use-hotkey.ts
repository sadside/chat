import { useEffect } from 'react';

export interface HotkeyCombo {
  key: string;        // case-insensitive single key, e.g. 'k'
  meta?: boolean;     // ⌘ on mac, Ctrl elsewhere
  shift?: boolean;
}

/**
 * Global hotkey hook. Binds to window keydown. By default does NOT fire
 * while focus is inside an editable input/textarea/contentEditable element
 * — pass `allowInInput` to override (e.g. ⌘K should still open the palette
 * when typing in the composer).
 */
export function useHotkey(combo: HotkeyCombo, handler: () => void, allowInInput = false) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!allowInInput) {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
          return;
        }
      }
      if (e.key.toLowerCase() !== combo.key.toLowerCase()) return;
      const metaWanted = !!combo.meta;
      const shiftWanted = !!combo.shift;
      const metaActive = e.metaKey || e.ctrlKey;
      if (metaWanted !== metaActive) return;
      if (shiftWanted !== e.shiftKey) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo.key, combo.meta, combo.shift, handler, allowInInput]);
}
