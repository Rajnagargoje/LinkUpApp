export interface ConversationResponse {
  conversationId: number;
  type: string;
  friendPublicId: string;
  friendUsername: string;
  friendProfilePhoto?: string | null;
  friendAge?: number | null;
  friendOnline?: boolean | null;
  friendLastSeenAt?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unreadCount: number;
  muted: boolean;
  archived: boolean;
  pinned: boolean;
}

export interface ChatMessageResponse {
  id: number;
  conversationId: number;
  senderPublicId: string;
  senderUsername: string;
  senderProfilePhoto?: string | null;
  type: string;
  content?: string | null;
  status: string;
  replyToMessageId?: number | null;
  replyToContent?: string | null;
  createdAt: string;
  editedAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  deletedForEveryone: boolean;
}

export interface SendMessageRequest {
  conversationId: number;
  content: string;
  replyToMessageId?: number | null;
}
