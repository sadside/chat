export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatCreateResponse {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatUpdatePayload {
  title: string;
}
