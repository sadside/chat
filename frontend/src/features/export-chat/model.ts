import { useCallback } from 'react';
import { apiClient as api } from '@/shared/api/client';

export function useExportChat() {
  const exportChat = useCallback(async (id: string, title: string) => {
    const blob = await api.get(`chats/${id}/export`).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9\-_ ]/gi, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  return { exportChat };
}
