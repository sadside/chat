import { Cpu, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { useModelsQuery } from '@/entities/model/api';
import { useSelectedModel } from '@/features/select-model';

export function ModelPicker() {
  const { data: models = [], isLoading, isError } = useModelsQuery();
  const { selectedModel, setSelectedModel } = useSelectedModel();

  const currentLabel = isLoading
    ? '…'
    : isError
      ? 'модель?'
      : (selectedModel ?? models[0]?.id ?? '—');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-tour="model-picker"
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
        aria-label="Выбрать модель"
      >
        <Cpu className="h-3.5 w-3.5" />
        <span className="max-w-[160px] truncate">{currentLabel}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {models.length === 0 ? (
          <DropdownMenuItem disabled>
            {isError ? 'Нет связи с LLM' : 'Нет доступных моделей'}
          </DropdownMenuItem>
        ) : (
          models.map((m) => (
            <DropdownMenuItem key={m.id} onSelect={() => setSelectedModel(m.id)}>
              {m.name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
