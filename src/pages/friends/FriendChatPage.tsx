import {
  IonAvatar,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonPage,
  IonSpinner,
  IonToolbar,
  useIonViewDidEnter,
  useIonViewDidLeave,
} from "@ionic/react";

import {
  callOutline,
  checkmarkDoneOutline,
  checkmarkOutline,
  ellipsisVerticalOutline,
  personCircleOutline,
  send,
  videocamOutline,
} from "ionicons/icons";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useLocation, useParams } from "react-router";
import toast from "react-hot-toast";

import {
  ChatMessageResponse,
  ConversationResponse,
} from "../../common/chat.model";

import { ConnectionResponse } from "../../common/connection.model";

import { STOMP } from "../../config/api.config";

import { useAuth } from "../../contexts/AuthContext";

import {
  getConversationMessages,
  getMyConversations,
  markConversationRead,
  markMessageRead,
} from "../../service/chatService";

import socketService from "../../service/socketService";

import "./FriendChatPage.scss";

interface RouteParams {
  conversationId: string;
}

interface FriendChatLocationState {
  conversation?: ConversationResponse;
  friend?: ConnectionResponse;
}

const FriendChatPage: React.FC = () => {
  const { conversationId } = useParams<RouteParams>();

  const location = useLocation<FriendChatLocationState | undefined>();

  const { user } = useAuth();

  const contentRef = useRef<HTMLIonContentElement | null>(null);

  /**
   * Ionic can keep pages mounted even when the user navigates away.
   *
   * We use this ref so an incoming WebSocket message is only marked
   * as READ when this conversation page is actually visible.
   */
  const isPageActiveRef = useRef(false);

  const numericConversationId = Number(conversationId);

  const [conversation, setConversation] = useState<ConversationResponse | null>(
    location.state?.conversation ?? null,
  );

  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);

  const [input, setInput] = useState("");

  const [loading, setLoading] = useState(true);

  const [sending, setSending] = useState(false);

  const [connected, setConnected] = useState(socketService.isConnected());

  /**
   * Friend information
   */

  const friendName =
    conversation?.friendUsername ??
    location.state?.friend?.username ??
    "Friend";

  const friendPhoto =
    conversation?.friendProfilePhoto ??
    location.state?.friend?.profilePhoto ??
    null;

  const friendOnline =
    conversation?.friendOnline ?? location.state?.friend?.online ?? false;

  /**
   * Sort messages oldest -> newest.
   *
   * Backend currently returns:
   *
   * newest
   * ↓
   * older
   * ↓
   * oldest
   *
   * UI needs:
   *
   * oldest
   * ↓
   * newer
   * ↓
   * newest
   */
  const sortMessages = useCallback((items: ChatMessageResponse[]) => {
    return [...items].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, []);

  /**
   * Add new WebSocket message or replace an existing
   * message when its status changes.
   *
   * Example:
   *
   * SENT -> DELIVERED -> READ
   */
  const addOrReplaceMessage = useCallback(
    (message: ChatMessageResponse) => {
      setMessages((previous) => {
        const exists = previous.some((item) => item.id === message.id);

        const next = exists
          ? previous.map((item) => (item.id === message.id ? message : item))
          : [...previous, message];

        return sortMessages(next);
      });
    },
    [sortMessages],
  );

  /**
   * Load conversation information when someone directly
   * opens:
   *
   * /app/friend-chat/12
   *
   * without navigation state.
   */
  const loadConversation = useCallback(async () => {
    if (conversation || !Number.isFinite(numericConversationId)) {
      return;
    }

    try {
      const list = await getMyConversations();

      const found = list.find(
        (item) => item.conversationId === numericConversationId,
      );

      if (found) {
        setConversation(found);
      }
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  }, [conversation, numericConversationId]);

  /**
   * Load chat history.
   *
   * IMPORTANT:
   *
   * We sort the response BEFORE determining the latest
   * message because the backend returns DESC order.
   */
  const loadMessages = useCallback(async () => {
    if (!Number.isFinite(numericConversationId)) {
      console.error("Invalid conversation id:", conversationId);

      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = await getConversationMessages(numericConversationId, 0, 50);

      const sortedMessages = sortMessages(data ?? []);

      setMessages(sortedMessages);

      if (sortedMessages.length === 0) {
        return;
      }

      const latestMessage = sortedMessages[sortedMessages.length - 1];

      await markConversationRead(numericConversationId, latestMessage.id).catch(
        console.error,
      );

      const latestIncomingMessage = [...sortedMessages]
        .reverse()
        .find((message) => message.senderPublicId !== user?.publicId);

      if (latestIncomingMessage && latestIncomingMessage.status !== "READ") {
        await markMessageRead(latestIncomingMessage.id).catch(console.error);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);

      toast.error("Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [conversationId, numericConversationId, sortMessages, user?.publicId]);

  useEffect(() => {
    void loadConversation();
    void loadMessages();
  }, [loadConversation, loadMessages]);

  useIonViewDidEnter(() => {
    isPageActiveRef.current = true;
  });

  useIonViewDidLeave(() => {
    isPageActiveRef.current = false;
  });
  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  /**
   * Ionic pages can stay mounted.
   *
   * Every time this page becomes visible:
   *
   * 1. mark page active
   * 2. reload conversation
   * 3. reload messages
   * 4. update unread pointer
   */
  useIonViewDidEnter(() => {
    isPageActiveRef.current = true;

    void loadConversation();
    void loadMessages();
  });

  /**
   * Important for unread count.
   *
   * When user leaves this conversation we stop treating
   * incoming WebSocket messages as READ.
   */
  useIonViewDidLeave(() => {
    isPageActiveRef.current = false;
  });

  /**
   * Friend chat WebSocket subscription.
   */
  useEffect(() => {
    const subscriptionKey = `friend-chat-${numericConversationId}`;

    const subscribe = () => {
      if (
        !Number.isFinite(numericConversationId) ||
        !socketService.isConnected()
      ) {
        return;
      }

      socketService.subscribe(
        subscriptionKey,

        STOMP.friendConversationQueue(numericConversationId),

        (body: ChatMessageResponse) => {
          /**
           * Always update local state.
           *
           * Even if this Ionic page is hidden, having the
           * message locally available is useful when the
           * user returns.
           */
          addOrReplaceMessage(body);

          /**
           * Ignore our own messages for READ handling.
           */
          if (body.senderPublicId === user?.publicId) {
            return;
          }

          /**
           * Very important:
           *
           * Do NOT mark incoming messages read when this
           * Ionic page is mounted but hidden.
           *
           * Otherwise unread count would remain zero while
           * the user is actually on another screen.
           */
          if (!isPageActiveRef.current) {
            return;
          }

          /**
           * User is actively viewing this conversation,
           * therefore update unread pointer immediately.
           */
          markConversationRead(numericConversationId, body.id).catch(
            (error) => {
              console.error("Failed to mark live conversation read:", error);
            },
          );

          /**
           * Update message status:
           *
           * SENT / DELIVERED -> READ
           */
          markMessageRead(body.id).catch((error) => {
            console.error("Failed to mark live message read:", error);
          });
        },
      );
    };

    /**
     * Already connected.
     */
    if (socketService.isConnected()) {
      subscribe();
    }

    /**
     * Listen for reconnects.
     */
    const unsubscribeConnectionListener = socketService.onConnectionChange(
      (isConnected) => {
        setConnected(isConnected);

        if (isConnected) {
          subscribe();
        }
      },
    );

    return () => {
      unsubscribeConnectionListener();

      socketService.unsubscribe(subscriptionKey);
    };
  }, [addOrReplaceMessage, numericConversationId, user?.publicId]);

  /**
   * Automatically scroll down whenever messages change.
   */
  useEffect(() => {
    contentRef.current?.scrollToBottom(250).catch(() => {});
  }, [messages]);

  /**
   * Send button enabled state.
   */
  const canSend = useMemo(
    () => input.trim().length > 0 && connected && !sending,

    [connected, input, sending],
  );

  /**
   * Send friend message through STOMP.
   */
  const sendMessage = () => {
    const content = input.trim();

    if (!content || sending) {
      return;
    }

    if (!connected) {
      toast.error("Chat is reconnecting. Try again in a moment.");

      return;
    }

    if (!Number.isFinite(numericConversationId)) {
      toast.error("Invalid conversation.");

      return;
    }

    setSending(true);

    const published = socketService.publish(STOMP.sendDirectMessage, {
      conversationId: numericConversationId,

      content,

      replyToMessageId: null,
    });

    if (!published) {
      setSending(false);

      toast.error("Message could not be sent.");

      return;
    }

    /**
     * Do not manually insert the sent message here.
     *
     * Backend saves the message and sends the persisted
     * ChatMessageResponse back to both participants.
     *
     * This prevents duplicate messages.
     */
    setInput("");

    setSending(false);
  };

  /**
   * Desktop/web Enter-to-send.
   *
   * Shift + Enter remains available for normal
   * text behavior if needed.
   */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      sendMessage();
    }
  };

  /**
   * Message status icon for messages sent by
   * the logged-in user.
   */
  const renderStatusIcon = (message: ChatMessageResponse) => {
    if (message.senderPublicId !== user?.publicId) {
      return null;
    }

    if (message.status === "READ") {
      return <IonIcon icon={checkmarkDoneOutline} />;
    }

    return <IonIcon icon={checkmarkOutline} />;
  };

  return (
    <IonPage className="friend-chat-page">
      {/* ================= HEADER ================= */}

      <IonHeader className="friend-chat-header">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/friends" />
          </IonButtons>

          <div className="friend-chat-user">
            <IonAvatar className="friend-chat-avatar">
              {friendPhoto ? (
                <img src={friendPhoto} alt={friendName} />
              ) : (
                <IonIcon icon={personCircleOutline} />
              )}
            </IonAvatar>

            <div className="friend-chat-user-copy">
              <strong>{friendName}</strong>

              <span>
                {friendOnline
                  ? "Online"
                  : connected
                    ? "Offline"
                    : "Reconnecting…"}
              </span>
            </div>
          </div>

          <IonButtons slot="end">
            {/* Voice call - roadmap feature */}

            <IonButton fill="clear" disabled>
              <IonIcon slot="icon-only" icon={callOutline} />
            </IonButton>

            {/* Video call - roadmap feature */}

            <IonButton fill="clear" disabled>
              <IonIcon slot="icon-only" icon={videocamOutline} />
            </IonButton>

            <IonButton fill="clear">
              <IonIcon slot="icon-only" icon={ellipsisVerticalOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      {/* ================= MESSAGES ================= */}

      <IonContent ref={contentRef} className="friend-chat-content" fullscreen>
        {loading ? (
          <div className="friend-chat-loading">
            <IonSpinner name="crescent" />

            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="friend-chat-empty">
            <IonIcon icon={personCircleOutline} />

            <h3>Start your conversation</h3>

            <p>You and {friendName} are connected. Say hello.</p>
          </div>
        ) : (
          <div className="friend-chat-message-list">
            {messages.map((message) => {
              const mine = message.senderPublicId === user?.publicId;

              const deleted = message.deletedForEveryone;

              return (
                <div
                  key={message.id}
                  className={`friend-chat-message-row ${
                    mine ? "mine" : "theirs"
                  }`}
                >
                  {!mine && (
                    <IonAvatar className="friend-chat-message-avatar">
                      {message.senderProfilePhoto ? (
                        <img
                          src={message.senderProfilePhoto}
                          alt={message.senderUsername}
                        />
                      ) : (
                        <IonIcon icon={personCircleOutline} />
                      )}
                    </IonAvatar>
                  )}

                  <div className="friend-chat-bubble-wrap">
                    <div
                      className={`friend-chat-bubble ${
                        mine ? "mine" : "theirs"
                      } ${deleted ? "deleted" : ""}`}
                    >
                      <div className="friend-chat-message-text">
                        {deleted ? "This message was deleted" : message.content}
                      </div>

                      <div className="friend-chat-message-meta">
                        <span>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>

                        {message.editedAt && !deleted && <span>edited</span>}

                        {renderStatusIcon(message)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </IonContent>

      {/* ================= MESSAGE INPUT ================= */}

      <IonFooter className="friend-chat-footer">
        <IonToolbar>
          <div className="friend-chat-composer">
            <IonInput
              value={input}
              placeholder={connected ? "Message" : "Reconnecting..."}
              disabled={!connected}
              maxlength={5000}
              onIonInput={(event) => setInput(String(event.detail.value ?? ""))}
              onKeyDown={handleKeyDown}
            />

            <IonButton
              className="friend-chat-send"
              shape="round"
              disabled={!canSend}
              onClick={sendMessage}
            >
              <IonIcon slot="icon-only" icon={send} />
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default FriendChatPage;
