export interface ChatUser {
  id: number;
  name: string;
  email: string;
  role: string;
  profile_picture_url?: string | null;
  is_online?: boolean;
}

export interface GlobalMessage {
  id: number;
  user_id?: number | null;
  author_name: string;
  author_role: string;
  author_avatar?: string | null;
  message_body: string;
  created_at: string;
}

export interface PrivateMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  message_body: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
  receiver_name?: string;
  receiver_avatar?: string | null;
}

export interface Conversation {
  user: ChatUser;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  last_sender_id: number;
}

export type WSEventType =
  | 'init_state'
  | 'auth_success'
  | 'guest_connected'
  | 'presence_update'
  | 'global_message'
  | 'private_message'
  | 'typing'
  | 'stop_typing'
  | 'read_receipt'
  | 'error';

export interface WSMessagePayload {
  type: WSEventType;
  data: any;
}
