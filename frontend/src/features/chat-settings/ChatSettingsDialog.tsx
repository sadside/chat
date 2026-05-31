import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { apiClient as api } from '@/shared/api/client';
import { chatKeys } from '@/entities/chat/queries';
import { toast } from '@/shared/ui/toast';

interface Props {
  chatId: string;
  initialPrompt: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSettingsDialog({ chatId, initialPrompt, open, onOpenChange }: Props) {
  const [value, setValue] = useState(initialPrompt ?? '');
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setValue(initialPrompt ?? '');
  }, [open, initialPrompt]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`chats/${chatId}`, { json: { system_prompt: value } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
        qc.invalidateQueries({ queryKey: chatKeys.list() }),
      ]);
      toast('Настройки чата сохранены');
      onOpenChange(false);
    } catch {
      toast('Не удалось сохранить', 'destructive');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Настройки чата</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.12em] text-[--color-muted-foreground]">
            System prompt
          </label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="Например: «Ты эксперт по Python. Отвечай кратко, с примерами кода.»"
            className="w-full resize-none rounded-md border border-[--color-border] bg-[--color-background] p-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-[--color-ring]/40"
          />
          <div className="flex items-center justify-between text-[11px] text-[--color-muted-foreground]">
            <span>Промпт добавится после системного — Nova останется собой.</span>
            <span className="tabular-nums">{value.length}/4000</span>
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
