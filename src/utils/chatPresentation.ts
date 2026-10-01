import { ChatMessageResponse } from "../common/chat.model";

export const CHAT_LIST_CHANGED = "linkup:conversations-changed";
export const CHAT_TIME_ZONE = "Asia/Kolkata";

const clock = new Intl.DateTimeFormat("en-IN", {
  timeZone: CHAT_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: true,
});
const date = new Intl.DateTimeFormat("en-IN", {
  timeZone: CHAT_TIME_ZONE, day: "2-digit", month: "2-digit", year: "2-digit",
});
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: CHAT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
});

export function chatTimestamp(value?: string | null): number {
  if (!value) return NaN;
  let iso = value.trim().replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  // Compatibility with the previous UTC-hosted API. New responses include an offset.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso)) iso += "Z";
  return new Date(iso).getTime();
}

export function formatChatTime(value?: string | null): string {
  const timestamp = chatTimestamp(value);
  return Number.isFinite(timestamp) ? clock.format(timestamp) : "";
}

export function formatChatListTime(value?: string | null, now = Date.now()): string {
  const timestamp = chatTimestamp(value);
  if (!Number.isFinite(timestamp)) return "";
  if (day.format(timestamp) === day.format(now)) return clock.format(timestamp);
  if (day.format(timestamp) === day.format(now - 86_400_000)) return "Yesterday";
  return date.format(timestamp);
}

const statusRank: Record<string, number> = { SENT: 0, DELIVERED: 1, READ: 2 };

/** Merge REST snapshots and socket events without duplicates or receipt regressions. */
export function mergeChatMessages(
  previous: ChatMessageResponse[], incoming: ChatMessageResponse[],
): ChatMessageResponse[] {
  const byId = new Map(previous.map(message => [message.id, message]));
  for (const message of incoming) {
    const old = byId.get(message.id);
    if (!old) { byId.set(message.id, message); continue; }
    const oldEdited = chatTimestamp(old.editedAt) || 0;
    const newEdited = chatTimestamp(message.editedAt) || 0;
    byId.set(message.id, {
      ...old, ...message,
      content: oldEdited > newEdited ? old.content : message.content,
      editedAt: oldEdited > newEdited ? old.editedAt : message.editedAt,
      deletedForEveryone: old.deletedForEveryone || message.deletedForEveryone,
      status: (statusRank[old.status] ?? 0) > (statusRank[message.status] ?? 0) ? old.status : message.status,
      readAt: message.readAt || old.readAt,
      deliveredAt: message.deliveredAt || old.deliveredAt,
    });
  }
  return [...byId.values()].sort((a, b) =>
    (chatTimestamp(a.createdAt) - chatTimestamp(b.createdAt)) || a.id - b.id);
}

export function notifyChatListChanged() {
  window.dispatchEvent(new Event(CHAT_LIST_CHANGED));
}
