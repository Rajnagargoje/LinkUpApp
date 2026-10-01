import {
  IonAlert, IonAvatar, IonBackButton, IonButton, IonButtons, IonContent,
  IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList,
  IonPage, IonPopover, IonSpinner, IonToolbar,
} from "@ionic/react";
import {
  callOutline, checkmarkDoneOutline, checkmarkOutline, ellipsisVerticalOutline,
  personCircleOutline, send, videocamOutline,
} from "ionicons/icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router";
import toast from "react-hot-toast";
import { ChatMessageResponse, ConversationResponse } from "../../common/chat.model";
import { ConnectionResponse } from "../../common/connection.model";
import { STOMP } from "../../config/api.config";
import { useAuth } from "../../contexts/AuthContext";
import { isNotificationAppActive, useNotifications } from "../../contexts/NotificationContext";
import {
  sendDirectMessage, getConversationMessages, getMyConversations,
  markConversationRead, markMessageRead,
} from "../../service/chatService";
import { blockUser, reportUser, sendConnectionRequest, unfriend } from "../../service/connectionService";
import socketService from "../../service/socketService";
import { formatChatTime, mergeChatMessages, notifyChatListChanged } from "../../utils/chatPresentation";
import "./FriendChatPage.scss";

interface FriendChatLocationState { conversation?: ConversationResponse; friend?: ConnectionResponse; }
type FriendAction = "remove" | "block" | "report";
const actionLabels = { remove: "Remove friend", block: "Block", report: "Report" };
interface ReadState {
  id: number; through: number; receipt: number; running: boolean;
  pending: { through: number; incoming?: ChatMessageResponse } | null;
}

const FriendChatPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const numericId = Number(conversationId);
  const validId = Number.isSafeInteger(numericId) && numericId > 0;
  const history = useHistory();
  const location = useLocation<FriendChatLocationState | undefined>();
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const contentRef = useRef<HTMLIonContentElement>(null);
  const popoverRef = useRef<HTMLIonPopoverElement>(null);
  const [conversation, setConversation] = useState<ConversationResponse | null>(location.state?.conversation ?? null);
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(socketService.isConnected());
  const [menuEvent, setMenuEvent] = useState<Event | null>(null);
  const [action, setAction] = useState<FriendAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const actionBusy = useRef(false);
  const sendInFlight = useRef(false);
  const loadInFlight = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const current = useRef({ id: numericId, owner: user?.publicId, active: false });
  current.current = { id: numericId, owner: user?.publicId, active: location.pathname === `/app/friend-chat/${numericId}` };
  const reads = useRef<ReadState>({ id: numericId, through: 0, receipt: 0, running: false, pending: null });
  const owner = user?.publicId;

  const friendName = conversation?.friendUsername ?? location.state?.friend?.username ?? "Friend";
  const friendPhoto = conversation?.friendProfilePhoto ?? location.state?.friend?.profilePhoto;
  const friendOnline = conversation?.friendOnline ?? location.state?.friend?.online ?? false;
  const friendPublicId = conversation?.friendPublicId ?? location.state?.friend?.userId;
  const areFriends = conversation?.friends !== false;

  const stillHere = useCallback(() => current.current.id === numericId && current.current.owner === owner
    && current.current.active && isNotificationAppActive(), [numericId, owner]);

  // A receipt returned over the socket must never trigger another receipt request.
  // Coalesce quick incoming messages into a monotonic conversation read pointer.
  const acknowledge = useCallback(async (items: ChatMessageResponse[]) => {
    if (!stillHere() || !items.length || !owner) return;
    const state = reads.current;
    if (state.id !== numericId) return;
    const through = Math.max(...items.map(item => item.id));
    const incoming = [...items].reverse().find(item => item.senderPublicId !== owner && item.status !== "READ");
    if (through <= state.through && (!incoming || incoming.id <= state.receipt)) return;
    if (!state.pending || through >= state.pending.through) state.pending = { through, incoming };
    if (state.running) return;
    state.running = true;
    let changed = false;
    try {
      while (state.pending && stillHere() && reads.current === state) {
        const pending = state.pending; state.pending = null;
        if (pending.through > state.through) {
          await markConversationRead(numericId, pending.through);
          state.through = Math.max(state.through, pending.through);
          changed = true;
        }
        if (stillHere() && pending.incoming && pending.incoming.id > state.receipt) {
          await markMessageRead(pending.incoming.id);
          state.receipt = Math.max(state.receipt, pending.incoming.id);
        }
      }
    } catch { /* Keep failed receipts retryable on resume or the next message. */ }
    finally {
      state.running = false;
      if (changed && current.current.owner === owner) {
        void refreshNotifications(); notifyChatListChanged();
      }
    }
  }, [numericId, owner, refreshNotifications, stillHere]);

  const addMessage = useCallback((message: ChatMessageResponse) => {
    if (message.conversationId !== numericId) return;
    setMessages(previous => mergeChatMessages(previous, [message]));
  }, [numericId]);

  const loadRoom = useCallback(async (showLoading = false) => {
    if (!validId || !stillHere()) { if (!validId) setLoading(false); return; }
    const key = `${owner}:${numericId}`;
    if (loadInFlight.current?.key === key) return loadInFlight.current.promise;
    if (showLoading) setLoading(true);
    const promise = (async () => {
      const [chats, historyResult] = await Promise.allSettled([
        getMyConversations(), getConversationMessages(numericId, 0, 50),
      ]);
      if (current.current.id !== numericId || current.current.owner !== owner) return;
      if (chats.status === "fulfilled") setConversation(chats.value.find(item => item.conversationId === numericId) ?? null);
      if (historyResult.status === "fulfilled") {
        const sorted = mergeChatMessages([], historyResult.value ?? []);
        setMessages(previous => mergeChatMessages(previous, sorted));
        void acknowledge(sorted);
      } else if (stillHere()) toast.error("Could not load this conversation.");
    })().finally(() => {
      if (current.current.id === numericId && current.current.owner === owner) setLoading(false);
      if (loadInFlight.current?.promise === promise) loadInFlight.current = null;
    });
    loadInFlight.current = { key, promise };
    return promise;
  }, [acknowledge, numericId, owner, stillHere, validId]);

  useEffect(() => {
    current.current.active = location.pathname === `/app/friend-chat/${numericId}`;
    reads.current = { id: numericId, through: 0, receipt: 0, running: false, pending: null };
    setMessages([]); setInput(""); setMenuEvent(null); setAction(null);
    setConversation(location.state?.conversation?.conversationId === numericId ? location.state.conversation : null);
    void loadRoom(true);
    return () => {
      if (current.current.id === numericId && current.current.owner === owner) current.current.active = false;
    };
  }, [numericId, owner, loadRoom]);

  // Covers Ionic route caching as well as returning from a profile or resuming Android.
  useEffect(() => {
    if (current.current.active) void loadRoom();
    const resume = () => { if (stillHere()) void loadRoom(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("linkup:app-resume", resume);
    return () => { document.removeEventListener("visibilitychange", resume); window.removeEventListener("linkup:app-resume", resume); };
  }, [location.pathname, loadRoom, stillHere]);

  useEffect(() => {
    if (!validId) return;
    const key = `friend-chat-${numericId}`;
    const subscribe = () => {
      if (!socketService.isConnected()) return;
      socketService.subscribe(key, STOMP.friendConversationQueue(numericId), (body: ChatMessageResponse) => {
        if (body.conversationId !== numericId || current.current.id !== numericId || current.current.owner !== owner) return;
        addMessage(body);
        if (body.senderPublicId !== owner && body.status !== "READ" && stillHere()) void acknowledge([body]);
      });
    };
    subscribe();
    const unsubscribe = socketService.onConnectionChange(value => {
      setConnected(value);
      if (value) { subscribe(); if (stillHere()) void loadRoom(); }
    });
    return () => { unsubscribe(); socketService.unsubscribe(key); };
  }, [acknowledge, addMessage, loadRoom, numericId, owner, stillHere, validId]);

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => { if (current.current.active) void contentRef.current?.scrollToBottom(200).catch(() => {}); }, [lastMessageId, messages.length]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sendInFlight.current || !validId) return;
    if (!connected) { toast.error("Chat is reconnecting. Try again in a moment."); return; }
    sendInFlight.current = true; setSending(true);
    try {
      const message = await sendDirectMessage(numericId, content);
      if (current.current.id !== numericId || current.current.owner !== owner) return;
      addMessage(message); setInput("");
      setConversation(previous => previous ? { ...previous, lastMessage: message.content, lastMessageAt: message.createdAt } : previous);
      notifyChatListChanged();
      if (conversation?.friends === false) {
        const list = await getMyConversations();
        if (current.current.id === numericId && current.current.owner === owner) setConversation(list.find(item => item.conversationId === numericId) ?? null);
      }
    } catch (error: any) { toast.error(error.response?.data?.message || "Message could not be sent."); }
    finally { sendInFlight.current = false; setSending(false); }
  };

  const selectAction = async (selected: FriendAction) => {
    if (!friendPublicId || actionBusy.current) return;
    await popoverRef.current?.dismiss();
    setMenuEvent(null); setAction(selected);
  };
  const reportInputs = useMemo(() => action === "report" ? [{ name: "reason", type: "textarea" as const,
    placeholder: "Reason (required)", attributes: { maxlength: 500 } }] : [], [action]);
  const submitAction = async (reason?: string): Promise<boolean> => {
    if (!action || !friendPublicId || actionBusy.current) return false;
    const text = reason?.trim() ?? "";
    if (action === "report" && (!text || text.length > 500)) { toast.error("Enter a report reason between 1 and 500 characters."); return false; }
    actionBusy.current = true; setActionLoading(true);
    try {
      if (action === "remove") await unfriend(friendPublicId);
      else if (action === "block") await blockUser(friendPublicId);
      else await reportUser(friendPublicId, text);
      toast.success(action === "remove" ? "Friend removed." : action === "block" ? "User blocked." : "Report submitted.");
      void refreshNotifications(); notifyChatListChanged();
      if (action !== "report") history.replace("/app/friends");
      return true;
    } catch { toast.error("Could not complete the action. Please try again."); return false; }
    finally { actionBusy.current = false; setActionLoading(false); }
  };

  return (
    <IonPage className="friend-chat-page">
      <IonHeader className="friend-chat-header"><IonToolbar>
        <IonButtons slot="start"><IonBackButton defaultHref="/app/friends" /></IonButtons>
        <button type="button" className="friend-chat-user" aria-label={`View ${friendName}'s profile`} disabled={!friendPublicId || actionLoading}
          onClick={() => { if (friendPublicId) history.push(`/app/person/${encodeURIComponent(friendPublicId)}`); }}>
          <span className="friend-chat-avatar-wrap"><IonAvatar className="friend-chat-avatar">{friendPhoto ? <img src={friendPhoto} alt="" /> : <IonIcon icon={personCircleOutline} />}</IonAvatar>{friendOnline && <span className="friend-chat-online-dot" />}</span>
          <span className="friend-chat-user-copy"><strong>{friendName}</strong><span>{!connected ? "Reconnecting…" : friendOnline ? "Online" : "Offline"}</span></span>
        </button>
        <IonButtons slot="end">
          <IonButton fill="clear" disabled aria-label="Voice call unavailable"><IonIcon slot="icon-only" icon={callOutline} /></IonButton>
          <IonButton fill="clear" disabled aria-label="Video call unavailable"><IonIcon slot="icon-only" icon={videocamOutline} /></IonButton>
          <IonButton fill="clear" aria-label="Chat options" disabled={!friendPublicId || actionLoading} onClick={event => setMenuEvent(event.nativeEvent)}>{actionLoading ? <IonSpinner name="crescent" /> : <IonIcon slot="icon-only" icon={ellipsisVerticalOutline} />}</IonButton>
        </IonButtons>
      </IonToolbar></IonHeader>
      <IonContent ref={contentRef} className="friend-chat-content">
        {conversation?.friends === false && <div className="ion-padding" role="status"><p>{conversation.introductionsRemaining ?? 0} introduction messages remaining. Become friends to continue chatting.</p><IonButton onClick={() => { void sendConnectionRequest(conversation.friendPublicId).then(() => toast.success("Friend request sent")).catch(error => toast.error(error.response?.data?.message || "Could not send request")); }}>Send friend request</IonButton></div>}
        {!validId ? <div className="friend-chat-empty"><p>This conversation is unavailable.</p></div> : loading ? <div className="friend-chat-loading"><IonSpinner name="crescent" /><span>Loading messages…</span></div> : !messages.length ? <div className="friend-chat-empty"><IonIcon icon={personCircleOutline} /><h3>Start your conversation</h3><p>Say hello to {friendName}.</p></div> : (
          <div className="friend-chat-message-list">{messages.map(message => {
            const mine = message.senderPublicId === owner;
            return <div key={message.id} className={`friend-chat-message-row ${mine ? "mine" : "theirs"}`}>
              {!mine && <IonAvatar className="friend-chat-message-avatar">{message.senderProfilePhoto ? <img src={message.senderProfilePhoto} alt="" /> : <IonIcon icon={personCircleOutline} />}</IonAvatar>}
              <div className="friend-chat-bubble-wrap"><div className={`friend-chat-bubble ${mine ? "mine" : "theirs"} ${message.deletedForEveryone ? "deleted" : ""}`}>
                <div className="friend-chat-message-text">{message.deletedForEveryone ? "This message was deleted" : message.content}</div>
                <div className="friend-chat-message-meta"><time dateTime={message.createdAt} title="Indian Standard Time">{formatChatTime(message.createdAt)}</time>{message.editedAt && !message.deletedForEveryone && <span>edited</span>}{mine && <IonIcon className={message.status === "READ" ? "message-read" : ""} aria-label={message.status === "READ" ? "Read" : message.status === "DELIVERED" ? "Delivered" : "Sent"} role="img" icon={message.status === "READ" || message.status === "DELIVERED" ? checkmarkDoneOutline : checkmarkOutline} />}</div>
              </div></div>
            </div>;
          })}</div>
        )}
      </IonContent>
      <IonFooter className="friend-chat-footer"><IonToolbar><div className="friend-chat-composer">
        <IonInput aria-label="Message" value={input} placeholder={connected ? "Message" : "Reconnecting…"} disabled={!connected || !validId || actionLoading} maxlength={5000} onIonInput={event => setInput(String(event.detail.value ?? ""))} onKeyDown={(event: React.KeyboardEvent) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
        <IonButton className="friend-chat-send" shape="round" aria-label="Send message" disabled={!input.trim() || !connected || sending || !validId || actionLoading} onClick={() => { void sendMessage(); }}><IonIcon slot="icon-only" icon={send} /></IonButton>
      </div></IonToolbar></IonFooter>
      <IonPopover ref={popoverRef} isOpen={menuEvent !== null} event={menuEvent ?? undefined} onDidDismiss={() => setMenuEvent(null)}>
        <IonList lines="none">{(["remove", "block", "report"] as const).filter(item => areFriends || item === "block").map(item => <IonItem key={item} button detail={false} onClick={() => { void selectAction(item); }}><IonLabel>{actionLabels[item]}</IonLabel></IonItem>)}</IonList>
      </IonPopover>
      <IonAlert isOpen={action !== null} header={action ? actionLabels[action] : ""} subHeader={friendName}
        message={action === "report" ? "Describe why you are reporting this person." : action === "block" ? "This removes the friendship and prevents private messages." : "Remove this person from your friends?"}
        backdropDismiss={!actionLoading} onDidDismiss={() => setAction(null)} inputs={reportInputs} buttons={[
          { text: "Cancel", role: "cancel", handler: () => !actionBusy.current },
          { text: action ? actionLabels[action] : "Confirm", handler: (data: { reason?: string }) => submitAction(data?.reason) },
        ]} />
    </IonPage>
  );
};
export default FriendChatPage;
