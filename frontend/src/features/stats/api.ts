import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from '@/shared/api/client';

export interface StatsData {
  total_chats: number;
  total_messages: number;
  total_chars_sent: number;
  total_chars_generated: number;
  model_usage: { model: string; messages: number }[];
  messages_by_day: { date: string; count: number }[];
  avg_assistant_response_chars: number;
  longest_chat_messages: number;
}

export function useStatsQuery() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.get('stats').json<StatsData>(),
    staleTime: 60_000,
    retry: false,
  });
}
