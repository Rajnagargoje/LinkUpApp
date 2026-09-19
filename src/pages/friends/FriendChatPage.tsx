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

import socketService from "../../service/socketService";

import "./FriendChatPage.scss";
import {
  getMyConversations,
  getConversationMessages,
  markConversationRead,
  markMessageRead,
} from "../../service/chatService";

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
  const numericConversationId = Number(conversationId);

  const [conversation, setConversation] = useState<ConversationResponse | null>(
    location.state?.conversation ?? null,
  );
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(socketService.isConnected());

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

  const sortMessages = useCallback((items: ChatMessageResponse[]) => {
    return [...items].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, []);

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

  const loadConversation = useCallback(async () => {
    if (conversation || !Number.isFinite(numericConversationId)) return;

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

  const loadMessages = useCallback(async () => {
    if (!Number.isFinite(numericConversationId)) return;

    try {
      setLoading(true);
      const data = await getConversationMessages(numericConversationId, 0, 50);
      setMessages(sortMessages(data));

      const lastMessage = data[data.length - 1];
      if (lastMessage && lastMessage.senderPublicId !== user?.publicId) {
        markConversationRead(numericConversationId, lastMessage.id).catch(
          () => {},
        );
        markMessageRead(lastMessage.id).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [numericConversationId, sortMessages, user?.publicId]);

  useEffect(() => {
    loadConversation();
    loadMessages();
  }, [loadConversation, loadMessages]);

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
          addOrReplaceMessage(body);

          if (body.senderPublicId !== user?.publicId) {
            markConversationRead(numericConversationId, body.id).catch(
              () => {},
            );
            markMessageRead(body.id).catch(() => {});
          }
        },
      );
    };

    if (socketService.isConnected()) {
      subscribe();
    }

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

  useEffect(() => {
    contentRef.current?.scrollToBottom(250).catch(() => {});
  }, [messages]);

  const canSend = useMemo(
    () => input.trim().length > 0 && connected && !sending,
    [connected, input, sending],
  );

  const sendMessage = () => {
    const content = input.trim();
    if (!content || sending) return;

    if (!connected) {
      toast.error("Chat is reconnecting. Try again in a moment.");
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

    // The backend echoes the persisted ChatMessageResponse to both users,
    // including the sender, so we do not insert an optimistic duplicate here.
    setInput("");
    setSending(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const renderStatusIcon = (message: ChatMessageResponse) => {
    if (message.senderPublicId !== user?.publicId) return null;

    if (message.status === "READ") {
      return <IonIcon icon={checkmarkDoneOutline} />;
    }

    return <IonIcon icon={checkmarkOutline} />;
  };

  return (
    <IonPage className="friend-chat-page">
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
            <IonButton fill="clear" disabled>
              <IonIcon slot="icon-only" icon={callOutline} />
            </IonButton>
            <IonButton fill="clear" disabled>
              <IonIcon slot="icon-only" icon={videocamOutline} />
            </IonButton>
            <IonButton fill="clear">
              <IonIcon slot="icon-only" icon={ellipsisVerticalOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

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
                  className={`friend-chat-message-row ${mine ? "mine" : "theirs"}`}
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
                      className={`friend-chat-bubble ${mine ? "mine" : "theirs"} ${
                        deleted ? "deleted" : ""
                      }`}
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

      <IonFooter className="friend-chat-footer">
        <IonToolbar>
          <div className="friend-chat-composer">
            <IonInput
              value={input}
              placeholder={connected ? "Message" : "Reconnecting..."}
              disabled={!connected}
              onIonInput={(event) => setInput(String(event.detail.value ?? ""))}
              onKeyDown={handleKeyDown}
              maxlength={5000}
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
