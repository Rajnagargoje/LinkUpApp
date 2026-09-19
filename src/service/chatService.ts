import { ConversationResponse, ChatMessageResponse } from "../common/chat.model";
import { ENDPOINTS } from "../config/api.config";
import axiosClient from "./axiosClient";
import { ApiEnvelope } from "./userService";

type MaybeEnvelope<T> = T | ApiEnvelope<T>;

function unwrap<T>(payload: MaybeEnvelope<T>): T {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "status" in payload &&
    "message" in payload
  ) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

export async function getOrCreateDirectConversation(friendPublicId: string) {
  const response = await axiosClient.post<MaybeEnvelope<ConversationResponse>>(
    ENDPOINTS.directConversation(friendPublicId),
  );
  return unwrap(response.data);
}

export async function getMyConversations() {
  const response = await axiosClient.get<MaybeEnvelope<ConversationResponse[]>>(
    ENDPOINTS.conversations,
  );
  return unwrap(response.data);
}

export async function getConversationMessages(
  conversationId: number,
  page = 0,
  size = 30,
) {
  const response = await axiosClient.get<MaybeEnvelope<ChatMessageResponse[]>>(
    ENDPOINTS.conversationMessages(conversationId),
    { params: { page, size } },
  );
  return unwrap(response.data);
}

export async function markConversationRead(
  conversationId: number,
  messageId: number,
) {
  return axiosClient.patch(ENDPOINTS.markConversationRead(conversationId), null, {
    params: { messageId },
  });
}

export async function markMessageDelivered(messageId: number) {
  return axiosClient.patch(ENDPOINTS.markMessageDelivered(messageId));
}

export async function markMessageRead(messageId: number) {
  return axiosClient.patch(ENDPOINTS.markMessageRead(messageId));
}

export async function editMessage(messageId: number, content: string) {
  const response = await axiosClient.patch<MaybeEnvelope<ChatMessageResponse>>(
    ENDPOINTS.message(messageId),
    null,
    { params: { content } },
  );
  return unwrap(response.data);
}

export async function deleteMessageForEveryone(messageId: number) {
  return axiosClient.delete(ENDPOINTS.message(messageId));
}
