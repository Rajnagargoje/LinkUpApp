import { Capacitor, PluginListenerHandle } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import axiosClient from "./axiosClient";
import { API_BASE_URL } from "../config/api.config";
import { getToken, getSessionEpoch } from "./tokenStorage";

const TOKEN_KEY = "linkup_push_token";
export const supportsPush = () => Capacitor.getPlatform() === "android";
export type PushPermission = "granted" | "denied" | "prompt" | "unsupported";
export async function pushPermission(): Promise<PushPermission> {
  if (!supportsPush()) return "unsupported";
  const result = await PushNotifications.checkPermissions();
  return result.receive === "granted" ? "granted" : result.receive === "denied" ? "denied" : "prompt";
}
export async function registerPush(requestPermission: boolean) {
  if (!supportsPush()) throw new Error("Push alerts are available in the Android app. Your in-app inbox works here.");
  let permission = await pushPermission();
  if (requestPermission && permission === "prompt") {
    const result = await PushNotifications.requestPermissions();
    permission = result.receive === "granted" ? "granted" : "denied";
  }
  if (permission !== "granted") throw new Error("Notifications are disabled. Allow LinkUp notifications in your device settings.");
  for (const [id, name] of [["linkup_messages", "Messages"], ["linkup_friends", "Friend requests"], ["linkup_updates", "LinkUp updates"]]) {
    await PushNotifications.createChannel({ id, name, importance: 4, visibility: 0, vibration: true });
  }
  await PushNotifications.register();
}
export async function attachPushListeners(callbacks: {
  received: (id: number) => void;
  opened: (id: number, recipientId: string) => void;
  registered: () => void;
  error: (message: string) => void;
}): Promise<() => void> {
  if (!supportsPush()) return () => {};
  const handles: PluginListenerHandle[] = [];
  handles.push(await PushNotifications.addListener("registration", async token => {
    const session = getSessionEpoch();
    if (!getToken()) return;
    try {
      await axiosClient.post("/notifications/devices", { token: token.value });
      if (getSessionEpoch() === session) { localStorage.setItem(TOKEN_KEY, token.value); callbacks.registered(); }
    } catch { if (getSessionEpoch() === session) callbacks.error("Couldn't register this device. Try enabling notifications again."); }
  }));
  handles.push(await PushNotifications.addListener("registrationError", () => callbacks.error("Push setup is unavailable. Check the Firebase configuration and try again.")));
  handles.push(await PushNotifications.addListener("pushNotificationReceived", notification => {
    const id = Number(notification.data?.notificationId);
    if (Number.isSafeInteger(id) && id > 0) callbacks.received(id);
  }));
  handles.push(await PushNotifications.addListener("pushNotificationActionPerformed", event => {
    const id = Number(event.notification.data?.notificationId);
    if (Number.isSafeInteger(id) && id > 0) callbacks.opened(id, String(event.notification.data?.recipientId || ""));
  }));
  return () => { handles.forEach(handle => void handle.remove()); };
}
export async function detachPushDevice() {
  if (!supportsPush()) return;
  const deviceToken = localStorage.getItem(TOKEN_KEY);
  const authToken = getToken();
  const owner = getSessionEpoch();
  localStorage.removeItem(TOKEN_KEY);
  // Raw fetch avoids a forced-logout interceptor loop when a session has already expired.
  if (deviceToken && authToken) {
    await fetch(API_BASE_URL + "/notifications/devices", {
      method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ token: deviceToken }), signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
  if (getSessionEpoch() !== owner && getToken()) return; // A newer login owns push registration now.
  await PushNotifications.removeAllDeliveredNotifications().catch(() => {});
  if (deviceToken) await PushNotifications.unregister().catch(() => {});
}
export async function clearDeliveredNotification(id: number) {
  if (!supportsPush()) return;
  const delivered = await PushNotifications.getDeliveredNotifications();
  const matching = delivered.notifications.filter(n => String(n.data?.notificationId) === String(id));
  if (matching.length) await PushNotifications.removeDeliveredNotifications({ notifications: matching });
}

export async function clearDeliveredThrough(notificationId: number) {
  await clearDeliveredWhere(data => Number(data?.notificationId) <= notificationId);
}
export async function clearDeliveredMessages(conversationId: number, throughMessage: number) {
  await clearDeliveredWhere(data => data?.type === "MESSAGE" && Number(data.referenceId) === conversationId && Number(data.messageId) <= throughMessage);
}
export async function clearDeliveredRequests(connectionIds: number[]) {
  await clearDeliveredWhere(data => data?.type === "FRIEND_REQUEST" && connectionIds.includes(Number(data.referenceId)));
}
async function clearDeliveredWhere(matches: (data: Record<string, string> | undefined) => boolean) {
  if (!supportsPush()) return;
  try {
    const delivered = await PushNotifications.getDeliveredNotifications();
    const matching = delivered.notifications.filter(n => matches(n.data));
    if (matching.length) await PushNotifications.removeDeliveredNotifications({ notifications: matching });
  } catch { /* The server remains authoritative for unread counts. */ }
}
