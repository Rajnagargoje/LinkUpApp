import {
  IonActionSheet, IonAvatar, IonBadge, IonButton, IonButtons, IonContent,
  IonIcon, IonItem, IonLabel, IonList, IonPage, IonSearchbar, IonSegment,
  IonSegmentButton, IonSpinner,
} from "@ionic/react";
import { checkmarkOutline, closeOutline, notificationsOffOutline, personCircleSharp } from "ionicons/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useHistory, useLocation } from "react-router";
import toast from "react-hot-toast";
import Header from "../../header/Header";
import {
  acceptConnectionRequest, getFriends, getReceivedRequests, rejectConnectionRequest,
} from "../../service/connectionService";
import { getMyConversations, getOrCreateDirectConversation, setConversationMuted } from "../../service/chatService";
import { ConnectionResponse } from "../../common/connection.model";
import { ConversationResponse } from "../../common/chat.model";
import { useNotifications, isNotificationAppActive } from "../../contexts/NotificationContext";
import { badgeCount, readRequestNotifications } from "../../service/notificationService";
import { CHAT_LIST_CHANGED, chatTimestamp, formatChatListTime, notifyChatListChanged } from "../../utils/chatPresentation";
import "./FriendsPage.scss";

type FriendsTab = "friends" | "requests";

const FriendsPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { counts, revision, refresh: refreshNotifications } = useNotifications();
  const [activeTab, setActiveTab] = useState<FriendsTab>("friends");
  const [friends, setFriends] = useState<ConnectionResponse[]>([]);
  const [requests, setRequests] = useState<ConnectionResponse[]>([]);
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [chatLoadingId, setChatLoadingId] = useState<number | null>(null);
  const [muteLoadingId, setMuteLoadingId] = useState<number | null>(null);
  const [muteMenu, setMuteMenu] = useState<ConnectionResponse | null>(null);
  const loaded = useRef(false);
  const loadInFlight = useRef(false);
  const reloadPending = useRef(false);
  const mutationVersion = useRef(0);
  const pageActive = useRef(false);
  pageActive.current = location.pathname === "/app/friends";
  const seenRequests = useRef(new Set<number>());
  const openingChat = useRef(false);
  const actionBusy = useRef(false);
  const suppressClick = useRef(false);
  const press = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);

  const loadData = useCallback(async () => {
    if (!pageActive.current) return;
    if (loadInFlight.current) { reloadPending.current = true; return; }
    loadInFlight.current = true;
    const version = mutationVersion.current;
    if (!loaded.current) setLoading(true);
    try {
      const [friendsResult, requestsResult, chats] = await Promise.all([
        getFriends(), getReceivedRequests(), getMyConversations(),
      ]);
      if (!pageActive.current) return;
      if (version !== mutationVersion.current) { reloadPending.current = true; return; }
      setFriends(friendsResult.data.data ?? []);
      setRequests(requestsResult.data.data ?? []);
      setConversations(chats ?? []);
      loaded.current = true;
      setLoadError(false);
    } catch {
      if (!loaded.current) setLoadError(true);
    } finally {
      loadInFlight.current = false;
      setLoading(false);
      if (reloadPending.current) { reloadPending.current = false; void loadData(); }
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(location.search).get("tab") === "requests") setActiveTab("requests");
  }, [location.search]);

  // One coalesced refresh for route entry and notification updates; preserve visible rows.
  useEffect(() => {
    if (!pageActive.current) return;
    const timer = setTimeout(() => { void loadData(); }, loaded.current ? 120 : 0);
    return () => clearTimeout(timer);
  }, [revision, location.pathname, loadData]);

  useEffect(() => {
    const refresh = () => { if (pageActive.current && isNotificationAppActive()) void loadData(); };
    window.addEventListener(CHAT_LIST_CHANGED, refresh);
    window.addEventListener("linkup:app-resume", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener(CHAT_LIST_CHANGED, refresh);
      window.removeEventListener("linkup:app-resume", refresh);
      document.removeEventListener("visibilitychange", refresh);
      pageActive.current = false;
      if (press.current) clearTimeout(press.current.timer);
    };
  }, [loadData]);

  useEffect(() => {
    if (activeTab !== "requests" || !pageActive.current || !isNotificationAppActive()) return;
    const ids = requests.map(item => item.connectionId).filter(id => !seenRequests.current.has(id)).slice(0, 100);
    if (!ids.length) return;
    ids.forEach(id => seenRequests.current.add(id));
    void readRequestNotifications(ids).then(() => refreshNotifications())
      .catch(() => ids.forEach(id => seenRequests.current.delete(id)));
  }, [requests, activeTab, location.pathname, refreshNotifications]);

  const conversationByFriend = useMemo(() => new Map(
    conversations.filter(chat => chat.type === "DIRECT").map(chat => [chat.friendPublicId, chat]),
  ), [conversations]);
  const search = searchText.trim().toLowerCase();
  const filteredFriends = useMemo(() => friends
    .filter(friend => friend.username.toLowerCase().includes(search))
    .slice().sort((a, b) => {
      const first = conversationByFriend.get(a.userId), second = conversationByFriend.get(b.userId);
      return (second?.lastMessage ? chatTimestamp(second.lastMessageAt) || 0 : 0)
        - (first?.lastMessage ? chatTimestamp(first.lastMessageAt) || 0 : 0);
    }), [friends, search, conversationByFriend]);
  const filteredRequests = requests.filter(item => item.username.toLowerCase().includes(search));
  const introductions = conversations.filter(chat => chat.friends === false && chat.friendUsername.toLowerCase().includes(search));

  const rememberConversation = (chat: ConversationResponse) => {
    setConversations(previous => [chat, ...previous.filter(item => item.conversationId !== chat.conversationId)]);
  };

  const openChat = async (friend: ConnectionResponse) => {
    if (openingChat.current || actionBusy.current) return;
    openingChat.current = true;
    setChatLoadingId(friend.connectionId);
    try {
      const conversation = conversationByFriend.get(friend.userId) ?? await getOrCreateDirectConversation(friend.userId);
      rememberConversation(conversation);
      if (pageActive.current) history.push(`/app/friend-chat/${conversation.conversationId}`, { conversation, friend });
    } catch { toast.error("Could not open this chat. Please try again."); }
    finally { openingChat.current = false; setChatLoadingId(null); }
  };

  const toggleMute = async (friend: ConnectionResponse) => {
    if (actionBusy.current || openingChat.current) return;
    actionBusy.current = true;
    setMuteLoadingId(friend.connectionId);
    mutationVersion.current++;
    try {
      const chat = conversationByFriend.get(friend.userId) ?? await getOrCreateDirectConversation(friend.userId);
      const muted = !chat.muted;
      await setConversationMuted(chat.conversationId, muted);
      mutationVersion.current++;
      rememberConversation({ ...chat, muted });
      toast.success(muted ? "Chat muted." : "Chat unmuted.");
      notifyChatListChanged();
    } catch { toast.error("Could not change mute settings. Please try again."); }
    finally { actionBusy.current = false; setMuteLoadingId(null); }
  };

  const cancelPress = () => { if (press.current) clearTimeout(press.current.timer); press.current = null; };
  const startPress = (event: ReactPointerEvent<HTMLButtonElement>, friend: ConnectionResponse) => {
    cancelPress(); suppressClick.current = false;
    if (event.button !== 0 || actionBusy.current || openingChat.current) return;
    press.current = { x: event.clientX, y: event.clientY, timer: setTimeout(() => {
      suppressClick.current = true; setMuteMenu(friend); press.current = null;
    }, 500) };
  };
  const movePress = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) cancelPress();
  };

  const respondToRequest = async (request: ConnectionResponse, accept: boolean) => {
    if (actionBusy.current) return;
    actionBusy.current = true; setActionLoading(request.connectionId); mutationVersion.current++;
    try {
      if (accept) {
        const response = await acceptConnectionRequest(request.connectionId);
        const friend = response.data.data;
        if (friend) setFriends(previous => [friend, ...previous.filter(item => item.userId !== friend.userId)]);
      } else await rejectConnectionRequest(request.connectionId);
      mutationVersion.current++;
      setRequests(previous => previous.filter(item => item.connectionId !== request.connectionId));
      void loadData();
    } catch { toast.error(accept ? "Could not accept friend request." : "Could not reject friend request."); }
    finally { actionBusy.current = false; setActionLoading(null); void refreshNotifications(); }
  };

  return (
    <IonPage className="linkup-friends-page">
      <Header />
      <IonContent>
        <IonSearchbar value={searchText} onIonInput={event => setSearchText(event.detail.value ?? "")} placeholder="Search friends" />
        <IonSegment className="friends-tabs" value={activeTab} onIonChange={event => setActiveTab(event.detail.value === "requests" ? "requests" : "friends")}>
          <IonSegmentButton value="friends"><IonLabel>Your friends {counts.messages > 0 && <IonBadge>{badgeCount(counts.messages)}</IonBadge>}</IonLabel></IonSegmentButton>
          <IonSegmentButton value="requests"><IonLabel>Friend requests {counts.requests > 0 && <IonBadge>{badgeCount(counts.requests)}</IonBadge>}</IonLabel></IonSegmentButton>
        </IonSegment>
        {loading ? <div className="friends-loading"><IonSpinner name="crescent" /><p>Loading…</p></div> : loadError ? (
          <div className="friends-empty"><p>Could not load your chats.</p><IonButton onClick={() => { void loadData(); }}>Try again</IonButton></div>
        ) : activeTab === "friends" ? (
          filteredFriends.length ? <ul className="friends-chat-list">
            {filteredFriends.map(friend => {
              const chat = conversationByFriend.get(friend.userId);
              const unread = Math.max(0, chat?.unreadCount ?? 0);
              return <li key={friend.connectionId}>
                <button type="button" className={`friends-chat-row ${unread ? "has-unread" : ""}`}
                  aria-label={`Chat with ${friend.username}${unread ? `, ${unread} unread messages` : ""}`}
                  aria-haspopup="dialog" disabled={chatLoadingId !== null || muteLoadingId !== null || actionLoading !== null}
                  onClick={() => { cancelPress(); if (suppressClick.current) { suppressClick.current = false; return; } void openChat(friend); }}
                  onPointerDown={event => startPress(event, friend)} onPointerMove={movePress}
                  onPointerUp={cancelPress} onPointerCancel={cancelPress} onPointerLeave={cancelPress}
                  onContextMenu={event => { event.preventDefault(); cancelPress(); suppressClick.current = true; setMuteMenu(friend); }}
                  onKeyDown={event => { if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) { event.preventDefault(); cancelPress(); setMuteMenu(friend); } }}>
                  <span className="friends-chat-avatar">
                    {friend.profilePhoto ? <img src={friend.profilePhoto} alt="" loading="lazy" /> : <IonIcon icon={personCircleSharp} aria-hidden="true" />}
                    {friend.online && <span className="friends-online-dot" role="img" aria-label="Online" />}
                  </span>
                  <span className="friends-chat-copy"><strong>{friend.username}</strong><span className="friends-message-preview">{chat?.lastMessage || "Say hello"}</span></span>
                  <span className="friends-chat-meta">
                    {chat?.lastMessage && <time className="friends-message-time" dateTime={chat.lastMessageAt ?? undefined}>{formatChatListTime(chat.lastMessageAt)}</time>}
                    <span className="friends-chat-indicators">
                      {chat?.muted && <IonIcon className="friends-muted" icon={notificationsOffOutline} role="img" aria-label="Muted" />}
                      {(chatLoadingId === friend.connectionId || muteLoadingId === friend.connectionId) ? <IonSpinner name="crescent" /> : unread > 0 && <span className={`friends-unread-badge ${chat?.muted ? "is-muted" : ""}`}>{badgeCount(unread)}</span>}
                    </span>
                  </span>
                </button>
              </li>;
            })}
          </ul> : <div className="friends-empty"><IonIcon icon={personCircleSharp} /><h3>{search ? "No matching friends" : "No friends yet"}</h3><p>{search ? "Try another name." : "Connect with people nearby to build your friend list."}</p></div>
        ) : (
          <IonList className="friends-request-list">
            {introductions.map(chat => <IonItem key={`intro-${chat.conversationId}`} button detail={false} onClick={() => history.push(`/app/friend-chat/${chat.conversationId}`, { conversation: chat })}>
              <IonAvatar slot="start">{chat.friendProfilePhoto ? <img src={chat.friendProfilePhoto} alt="" /> : <IonIcon icon={personCircleSharp} />}</IonAvatar>
              <IonLabel><h2>{chat.friendUsername}</h2><p>{chat.lastMessage || "Introduction conversation"}</p></IonLabel>
              {chat.unreadCount > 0 && <IonBadge slot="end">{badgeCount(chat.unreadCount)}</IonBadge>}
            </IonItem>)}
            {!filteredRequests.length && !introductions.length && <div className="friends-empty"><IonIcon icon={personCircleSharp} /><h3>{search ? "No matching requests" : "No friend requests"}</h3><p>New connection requests will appear here.</p></div>}
            {filteredRequests.map(request => <IonItem key={request.connectionId} lines="none" className="friend-request-item">
              <IonAvatar slot="start">{request.profilePhoto ? <img src={request.profilePhoto} alt="" /> : <IonIcon icon={personCircleSharp} />}</IonAvatar>
              <IonLabel><h2>{request.username}</h2>{request.age ? <p>{request.age} years old</p> : null}<p>Wants to connect with you</p></IonLabel>
              <IonButtons slot="end"><IonButton aria-label={`Accept ${request.username}`} color="success" disabled={actionLoading !== null} onClick={() => { void respondToRequest(request, true); }}><IonIcon slot="icon-only" icon={checkmarkOutline} /></IonButton><IonButton aria-label={`Decline ${request.username}`} color="danger" disabled={actionLoading !== null} onClick={() => { void respondToRequest(request, false); }}><IonIcon slot="icon-only" icon={closeOutline} /></IonButton></IonButtons>
            </IonItem>)}
          </IonList>
        )}
      </IonContent>
      <IonActionSheet isOpen={muteMenu !== null} header={muteMenu?.username} onDidDismiss={() => setMuteMenu(null)} buttons={[
        { text: muteMenu && conversationByFriend.get(muteMenu.userId)?.muted ? "Unmute notifications" : "Mute notifications", handler: () => { if (muteMenu) void toggleMute(muteMenu); } },
        { text: "Cancel", role: "cancel" },
      ]} />
    </IonPage>
  );
};
export default FriendsPage;
