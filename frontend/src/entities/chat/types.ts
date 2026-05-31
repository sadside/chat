export interface Chat {
  id: string;
  title: string;
  pinned: boolean;
  system_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export type ChatCreateResponse = Chat;

export interface ChatUpdatePayload {
  title?: string;
  system_prompt?: string | null;
  pinned?: boolean;
}
