import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import toast from "react-hot-toast";
import { useAuth } from "./AuthContext";
import socketService from "../service/socketService";
import {
  AppNotification, NotificationCounts, NotificationPreferences, getNotification, getNotificationCounts,
  getNotificationPreferences, notificationDestination, readNotification, getPushStatus,
} from "../service/notificationService";
import { attachPushListeners, clearDeliveredNotification, registerPush } from "../service/pushService";

interface NotificationContextValue {
  counts: NotificationCounts; revision: number; pushError: string; pushReady: boolean;
  refresh: () => Promise<void>; open: (item: AppNotification) => Promise<void>;
  preferences: NotificationPreferences | null; refreshPreferences: () => Promise<void>;
}
const Context = createContext<NotificationContextValue | null>(null);
const empty: NotificationCounts = { total: 0, requests: 0, messages: 0 };
let nativeActive = true;
export const isNotificationAppActive = () => nativeActive && document.visibilityState === "visible";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const history = useHistory();
  const location = useLocation();
  const [counts, setCounts] = useState(empty);
  const [revision, setRevision] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [pushError, setPushError] = useState("");
  const [pushReady, setPushReady] = useState(false);
  const [pending, setPending] = useState<{ id: number; recipient: string } | null>(null);
  const current = useRef({ userId: user?.publicId, path: location.pathname, preferences });
  current.current = { userId: user?.publicId, path: location.pathname, preferences };
  const seen = useRef(new Set<number>());

  const refresh = useCallback(async () => {
    const owner = user?.publicId;
    if (!owner || !isAuthenticated) return;
    try {
      const result = await getNotificationCounts();
      if (current.current.userId === owner) setCounts(result);
    } catch { /* Keep the last confirmed counts during an outage. */ }
  }, [user?.publicId, isAuthenticated]);
  const refreshPreferences = useCallback(async () => {
    const owner = user?.publicId;
    if (!owner) return;
    try { const result = await getNotificationPreferences(); if (current.current.userId === owner) setPreferences(result); }
    catch { /* Settings screen offers retry. */ }
  }, [user?.publicId]);
  const open = useCallback(async (item: AppNotification) => {
    const owner = current.current.userId;
    try {
      await readNotification(item.id);
      if (current.current.userId !== owner) return;
      void clearDeliveredNotification(item.id).catch(() => {});
      await refresh();
      if (current.current.userId !== owner) return;
      setRevision(value => value + 1);
      history.push(notificationDestination(item));
    } catch { toast.error("Couldn't open this notification. Please try again."); }
  }, [history, refresh]);
  const openRef = useRef(open); openRef.current = open;
  const refreshRef = useRef(refresh); refreshRef.current = refresh;

  useEffect(() => {
    seen.current.forEach(id => toast.dismiss(`notification-${id}`));
    seen.current.clear(); setCounts(empty); setPreferences(null); setPushReady(false); setPushError("");
    void refresh(); void refreshPreferences();
  }, [refresh, refreshPreferences]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const show = (item: AppNotification, silent = false) => {
      if (seen.current.has(item.id)) return;
      seen.current.add(item.id);
      if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value!);
      if (silent || !isNotificationAppActive()) return;
      if (item.type === "MESSAGE" && current.current.path === `/app/friend-chat/${item.referenceId}`) return;
      const prefs = current.current.preferences;
      if (!prefs || (item.type === "MESSAGE" ? !prefs.messages :
        item.type === "FRIEND_REQUEST" || item.type === "FRIEND_ACCEPTED" ? !prefs.friendRequests : !prefs.updates)) return;
      toast(t => <button className="notification-toast" onClick={() => { toast.dismiss(t.id); void openRef.current(item); }}>
        <strong>{item.type === "MESSAGE" && !prefs.messagePreview ? "New message" : item.title}</strong>
        <span>{item.type === "MESSAGE" && !prefs.messagePreview ? "Tap to open your conversation" : item.body}</span>
      </button>, { id: `notification-${item.id}`, duration: 5000 });
    };
    const subscribe = () => {
      if (!socketService.isConnected()) return;
      const owner = user?.publicId;
      socketService.subscribe("notifications", "/user/queue/notifications", (event: { kind: string; notification?: AppNotification; silent?: boolean }) => {
        if (current.current.userId !== owner) return;
        void refreshRef.current(); setRevision(value => value + 1);
        if (event.kind === "NEW" && event.notification) show(event.notification, event.silent);
      });
      void refreshRef.current();
    };
    subscribe();
    const unsubscribe = socketService.onConnectionChange(connected => { if (connected) subscribe(); });
    const pushed = (event: Event) => {
      const id = (event as CustomEvent<number>).detail;
      const owner = current.current.userId;
      void getNotification(id).then(item => {
        if (current.current.userId !== owner) return;
        show(item); void refreshRef.current(); setRevision(value => value + 1);
      }).catch(() => {});
    };
    window.addEventListener("linkup:push-received", pushed);
    return () => { unsubscribe(); socketService.unsubscribe("notifications"); window.removeEventListener("linkup:push-received", pushed); };
  }, [isAuthenticated, user?.publicId]);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void attachPushListeners({
      received: id => window.dispatchEvent(new CustomEvent("linkup:push-received", { detail: id })),
      opened: (id, recipient) => setPending({ id, recipient }),
      registered: () => { setPushReady(true); setPushError(""); },
      error: setPushError,
    }).then(cleanup => { if (cancelled) cleanup(); else dispose = cleanup; }).catch(() => setPushError("Push notifications are unavailable on this device."));
    return () => { cancelled = true; dispose?.(); };
  }, []);
  useEffect(() => {
    if (!pending || !user || !isAuthenticated) return;
    // Never route a previous account's push into the newly signed-in account.
    if (pending.recipient !== user.publicId) { setPending(null); return; }
    setPending(null);
    const owner = user.publicId;
    void getNotification(pending.id).then(item => {
      if (current.current.userId === owner) return openRef.current(item);
    }).catch(() => { if (current.current.userId === owner) toast.error("This notification is no longer available."); });
  }, [pending, user, isAuthenticated]);
  useEffect(() => {
    if (!user || !preferences?.pushEnabled || Capacitor.getPlatform() !== "android") return;
    void getPushStatus().then(status => { if (status.configured) return registerPush(false); }).catch(() => {});
  }, [user?.publicId, preferences?.pushEnabled]);
  useEffect(() => {
    const resume = () => { if (isNotificationAppActive()) { void refreshRef.current(); setRevision(value => value + 1); } };
    document.addEventListener("visibilitychange", resume);
    const timer = window.setInterval(() => { if (isNotificationAppActive()) void refreshRef.current(); }, 30000);
    const handle = Capacitor.isNativePlatform() ? NativeApp.addListener("appStateChange", state => { nativeActive = state.isActive; resume(); if (state.isActive) window.dispatchEvent(new Event("linkup:app-resume")); }) : null;
    return () => { document.removeEventListener("visibilitychange", resume); clearInterval(timer); if (handle) void handle.then(h => h.remove()); };
  }, []);
  return <Context.Provider value={{ counts, revision, refresh, open, preferences, refreshPreferences, pushError, pushReady }}>{children}</Context.Provider>;
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error("NotificationProvider is missing.");
  return value;
}
