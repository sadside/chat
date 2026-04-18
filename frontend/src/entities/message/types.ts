export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  chat_id: string;
  role: MessageRole;
  content: string;
  aborted: boolean;
  created_at: string;
}

export interface SendMessagePayload {
  content: string;
}

// SSE event shapes
export interface SseUserMessageEvent {
  id: string;
  role: 'user';
  content: string;
  created_at: string;
}

export interface SseAssistantStartEvent {
  id: string;
}

export interface SseDeltaEvent {
  text: string;
}

export interface SseAssistantDoneEvent {
  id: string;
  content: string;
  aborted: boolean;
}

export interface SseErrorEvent {
  code: string;
  message: string;
}

export type SseEventData =
  | { event: 'user_message'; data: SseUserMessageEvent }
  | { event: 'assistant_start'; data: SseAssistantStartEvent }
  | { event: 'delta'; data: SseDeltaEvent }
  | { event: 'assistant_done'; data: SseAssistantDoneEvent }
  | { event: 'error'; data: SseErrorEvent };
