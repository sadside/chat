import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from '@/shared/api/client';

export interface LlmModel {
  id: string;
  name: string;
}

export const modelKeys = {
  all: ['models'] as const,
  list: () => [...modelKeys.all, 'list'] as const,
};

export function useModelsQuery() {
  return useQuery({
    queryKey: modelKeys.list(),
    queryFn: () => api.get('models').json<LlmModel[]>(),
    // Models rarely change; a minute of cache is plenty and keeps the picker
    // snappy when the user opens it twice.
    staleTime: 60_000,
    retry: false,
  });
}
