import {
  IonBackButton, IonBadge, IonButton, IonButtons, IonContent, IonHeader, IonIcon,
  IonPage, IonRefresher, IonRefresherContent, IonSegment, IonSegmentButton, IonLabel,
  IonTitle, IonToolbar,
} from "@ionic/react";
import { notificationsOutline, chatbubbleOutline, personAddOutline, checkmarkCircleOutline, shieldCheckmarkOutline, megaphoneOutline, settingsOutline, checkmarkDoneOutline } from "ionicons/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router";
import toast from "react-hot-toast";
import { AppNotification, getNotifications, readAllNotifications, readNotification } from "../../service/notificationService";
import { useNotifications } from "../../contexts/NotificationContext";
import { NotificationSkeletonList } from "../../components/Skeleton";
import "./NotificationsPage.scss";

const icons = { MESSAGE: chatbubbleOutline, FRIEND_REQUEST: personAddOutline, FRIEND_ACCEPTED: checkmarkCircleOutline, REPORT_UPDATE: shieldCheckmarkOutline, SYSTEM: megaphoneOutline };
// Each notification type gets its own icon color, so the list is
// scannable by category at a glance instead of every row looking the same.
const iconTones = { MESSAGE: "primary", FRIEND_REQUEST: "secondary", FRIEND_ACCEPTED: "success", REPORT_UPDATE: "warning", SYSTEM: "medium" } as const;

// Buckets items into recency groups. Items already arrive newest-first
// from the backend, so the first time each label is seen sets that
// section's position — no separate sort needed.
function groupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);
  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  if (date >= startOfWeek) return "This week";
  return "Earlier";
}

function groupItems(items: AppNotification[]) {
  const groups: { label: string; items: AppNotification[] }[] = [];
  for (const item of items) {
    const label = groupLabel(item.createdAt);
    const bucket = groups.find(g => g.label === label);
    if (bucket) bucket.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/** One row with a lightweight swipe-left-to-mark-read gesture. */
function NotificationRow({ item, onOpen, onMarkRead }: { item: AppNotification; onOpen: () => void; onMarkRead: () => void }) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  const onPointerDown = (event: React.PointerEvent) => {
    if (item.readAt) return; // nothing to mark read
    startX.current = event.clientX;
    dragging.current = true;
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current || startX.current === null) return;
    const delta = Math.min(0, Math.max(-88, event.clientX - startX.current));
    setDragX(delta);
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX < -56) onMarkRead();
    setDragX(0);
  };

  return (
    <div className="notification-row-wrap">
      <span className="notification-swipe-hint" aria-hidden="true">
        <IonIcon icon={checkmarkDoneOutline} /> Read
      </span>
      <button
        className={`notification-row ${item.readAt ? "" : "is-unread"}`}
        style={{ transform: `translateX(${dragX}px)` }}
        onClick={() => { if (dragX === 0) onOpen(); }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        <span className={`notification-icon notification-icon--${iconTones[item.type]}`}>
          <IonIcon icon={icons[item.type]} />
        </span>
        <span className="notification-copy">
          <strong>{item.title}</strong>
          <span>{item.body}</span>
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
        </span>
        {!item.readAt && <span className="notification-dot" aria-label="Unread" />}
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const history = useHistory();
  const { revision, refresh, open, counts } = useNotifications();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [marking, setMarking] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async (nextPage = 0) => {
    const request = ++generation.current;
    setLoading(true); setError("");
    try {
      const result = await getNotifications(nextPage, filter === "unread");
      if (request !== generation.current) return;
      setItems(previous => nextPage === 0 ? result.content : [...previous, ...result.content.filter(n => !previous.some(old => old.id === n.id))]);
      setPage(nextPage); setLast(result.last);
    } catch { if (request === generation.current) setError("Couldn't load notifications. Please try again."); }
    finally { if (request === generation.current) setLoading(false); }
  }, [filter]);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load, revision]);
  const markAll = async () => {
    if (!items.length) return;
    setMarking(true);
    try { await readAllNotifications(Math.max(...items.map(item => item.id))); await Promise.all([load(), refresh()]); }
    catch { toast.error("Couldn't mark notifications as read."); }
    finally { setMarking(false); }
  };
  const markOne = async (item: AppNotification) => {
    if (item.readAt) return;
    setItems(previous => previous.map(n => n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n));
    try { await readNotification(item.id); await refresh(); }
    catch {
      toast.error("Couldn't mark as read.");
      setItems(previous => previous.map(n => n.id === item.id ? { ...n, readAt: null } : n)); // revert
    }
  };
  const groups = groupItems(items);
  return <IonPage>
    <IonHeader><IonToolbar>
      <IonButtons slot="start"><IonBackButton defaultHref="/app/home" /></IonButtons>
      <IonTitle>Notifications</IonTitle>
      <IonButtons slot="end"><IonButton aria-label="Notification settings" onClick={() => history.push("/app/notifications/settings")}><IonIcon slot="icon-only" icon={settingsOutline} /></IonButton></IonButtons>
    </IonToolbar></IonHeader>
    <IonContent className="notifications-content">
      <IonRefresher slot="fixed" onIonRefresh={event => { void Promise.all([load(), refresh()]).finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>
      <div className="notifications-container">
        <div className="notifications-intro"><div><h1>Your updates</h1><p>Requests, conversations, and news from LinkUp.</p></div>
          <IonButton fill="clear" disabled={marking || loading || !counts.total || !items.length} onClick={() => void markAll()}>Mark all read</IonButton>
        </div>
        <IonSegment value={filter} onIonChange={event => setFilter(event.detail.value as "all" | "unread")}>
          <IonSegmentButton value="all"><IonLabel>All</IonLabel></IonSegmentButton>
          <IonSegmentButton value="unread"><IonLabel>Unread {counts.total > 0 && <IonBadge>{counts.total > 99 ? "99+" : counts.total}</IonBadge>}</IonLabel></IonSegmentButton>
        </IonSegment>
        {error && <div className="notification-empty" role="alert"><p>{error}</p><IonButton onClick={() => void load()}>Try again</IonButton></div>}
        {!error && loading && !items.length && <NotificationSkeletonList />}
        {!error && !loading && !items.length && (
          <div className="notification-empty notification-empty--illustrated">
            <div className="notification-empty-badge"><IonIcon icon={notificationsOutline} /></div>
            <h2>{filter === "unread" ? "You're all caught up" : "Nothing here yet"}</h2>
            <p>New requests and conversation updates will appear here.</p>
          </div>
        )}
        {groups.map(group => (
          <div className="notification-group" key={group.label}>
            <h3 className="notification-group-label">{group.label}</h3>
            <div className="notification-list">
              {group.items.map(item => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  onOpen={() => void open(item)}
                  onMarkRead={() => void markOne(item)}
                />
              ))}
            </div>
          </div>
        ))}
        {loading && items.length > 0 && <NotificationSkeletonList count={2} />}
        {!last && !loading && <IonButton fill="clear" expand="block" onClick={() => void load(page + 1)}>Load earlier notifications</IonButton>}
      </div>
    </IonContent>
  </IonPage>;
}

