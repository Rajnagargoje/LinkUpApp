import axiosClient from "./axiosClient";
import { clearDeliveredThrough, clearDeliveredRequests } from "./pushService";

export type NotificationType = "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "MESSAGE" | "REPORT_UPDATE" | "SYSTEM";
export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  actorId: string | null;
  referenceId: number | null;
  messageId: number | null;
  createdAt: string;
  readAt: string | null;
}
export interface NotificationCounts { total: number; requests: number; messages: number; }
export interface NotificationPreferences {
  pushEnabled: boolean; messages: boolean; friendRequests: boolean; updates: boolean; messagePreview: boolean;
}
export interface NotificationPage { content: AppNotification[]; last: boolean; }
export const getNotifications = async (page = 0, unread = false) =>
  (await axiosClient.get<NotificationPage>("/notifications", { params: { page, unread } })).data;
export const getNotification = async (id: number) => (await axiosClient.get<AppNotification>(`/notifications/${id}`)).data;
export const getNotificationCounts = async () => (await axiosClient.get<NotificationCounts>("/notifications/counts")).data;
export const readNotification = (id: number) => axiosClient.patch(`/notifications/${id}/read`);
export const readAllNotifications = async (throughId: number) => { await axiosClient.patch("/notifications/read-all", { throughId }); await clearDeliveredThrough(throughId); };
export const readRequestNotifications = async (connectionIds: number[]) => { await axiosClient.patch("/notifications/requests/read", { connectionIds: connectionIds.slice(0, 100) }); await clearDeliveredRequests(connectionIds); };
export const getNotificationPreferences = async () => (await axiosClient.get<NotificationPreferences>("/notifications/preferences")).data;
export const saveNotificationPreferences = async (preferences: NotificationPreferences) =>
  (await axiosClient.put<NotificationPreferences>("/notifications/preferences", preferences)).data;
export const getPushStatus = async () => (await axiosClient.get<{ configured: boolean }>("/notifications/push-status")).data;

export function notificationDestination(item: AppNotification): string {
  switch (item.type) {
    case "MESSAGE": return item.referenceId && item.referenceId > 0 ? `/app/friend-chat/${item.referenceId}` : "/app/friends";
    case "FRIEND_REQUEST": return "/app/friends?tab=requests";
    case "FRIEND_ACCEPTED": return item.actorId ? `/app/person/${encodeURIComponent(item.actorId)}` : "/app/friends";
    default: return "/app/notifications";
  }
}
export const badgeCount = (count: number) => count > 99 ? "99+" : String(Math.max(0, count));
