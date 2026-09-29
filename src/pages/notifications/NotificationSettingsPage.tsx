import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonSpinner, IonTitle, IonToggle, IonToolbar } from "@ionic/react";
import { useEffect, useState } from "react";
import { useNotifications } from "../../contexts/NotificationContext";
import { getPushStatus, NotificationPreferences, saveNotificationPreferences } from "../../service/notificationService";
import { pushPermission, PushPermission, registerPush, supportsPush } from "../../service/pushService";
import "./NotificationsPage.scss";

export default function NotificationSettingsPage() {
  const { preferences, refreshPreferences, pushError, pushReady } = useNotifications();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = useState<PushPermission>("unsupported");
  const [configured, setConfigured] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => { void refreshPreferences(); }, [refreshPreferences]);
  useEffect(() => { setDraft(preferences); }, [preferences]);
  useEffect(() => {
    void Promise.all([getPushStatus(), pushPermission()])
      .then(([server, device]) => { setConfigured(server.configured); setPermission(device); })
      .catch(() => setStatus("Couldn't check push availability. Reopen this page to retry."))
      .finally(() => setChecking(false));
  }, []);
  const save = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!draft || saving) return;
    const previous = draft;
    setDraft({ ...draft, [key]: value }); setSaving(true); setStatus("");
    try { await saveNotificationPreferences({ ...draft, [key]: value }); await refreshPreferences(); }
    catch { setDraft(previous); setStatus("Couldn't save your preferences. Please try again."); }
    finally { setSaving(false); }
  };
  const enable = async () => {
    setSaving(true); setStatus("");
    try { await registerPush(true); setPermission(await pushPermission()); }
    catch (error) { setStatus((error as Error).message); }
    finally { setSaving(false); }
  };
  return <IonPage>
    <IonHeader><IonToolbar><IonButtons slot="start"><IonBackButton defaultHref="/app/notifications" /></IonButtons><IonTitle>Notification settings</IonTitle></IonToolbar></IonHeader>
    <IonContent className="notifications-content">
      <div className="notifications-container notification-settings">
        <h1>Stay in the loop</h1><p>Choose your alerts. Your notification inbox remains available even when push alerts are off.</p>
        <section className="notification-settings-card">
          <h2>On this device</h2>
          <p>{checking ? "Checking notification availability…" : !supportsPush() ? "Push alerts are available in the Android app. In-app notifications work in this browser." : !configured ? "Push delivery is not configured yet. Your in-app inbox and badges are ready." : permission === "denied" ? "Notifications are blocked. Enable them in Android Settings → Apps → LinkUp → Notifications." : pushReady ? "This device is registered for push notifications." : "Enable notifications to receive alerts when LinkUp is closed."}</p>
          {supportsPush() && configured && permission !== "denied" && <IonButton disabled={saving || checking || !draft?.pushEnabled} onClick={() => void enable()}>{pushReady ? "Refresh device registration" : "Enable on this device"}</IonButton>}
          {pushError && <p role="alert">{pushError}</p>}
        </section>
        {!draft ? <div className="notification-empty"><IonSpinner /><p>Loading preferences…</p><IonButton onClick={() => void refreshPreferences()}>Retry</IonButton></div> : <section className="notification-settings-card">
          {([
            ["pushEnabled", "Push notifications", "Receive alerts outside the app."],
            ["messages", "Messages", "Alerts for new direct messages. Muted conversations stay quiet."],
            ["friendRequests", "Friend activity", "New friend requests and accepted requests."],
            ["updates", "LinkUp updates", "Report updates and app announcements."],
            ["messagePreview", "Message previews", "Show sender names and message text in push alerts and banners."],
          ] as const).map(([key, label, description]) => <div className="notification-setting" key={key}>
            <IonToggle checked={draft[key]} disabled={saving} onIonChange={event => void save(key, event.detail.checked)}>{label}</IonToggle><p>{description}</p>
          </div>)}
        </section>}
        {status && <p role="status" className="notification-status">{status}</p>}
        <p className="notification-footnote">Android notification channels let you choose sound and vibration in your device settings. Notifications may be delayed by battery restrictions or a force-stopped app.</p>
      </div>
    </IonContent>
  </IonPage>;
}
