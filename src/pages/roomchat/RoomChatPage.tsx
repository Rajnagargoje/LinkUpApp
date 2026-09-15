import {
  IonAvatar,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonFooter,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonList,
  IonPage,
  IonRow,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  personCircle,
  search,
  ellipsisHorizontal,
  ellipsisVertical,
  videocamOutline,
  callOutline,
  personOutline,
  recordingOutline,
  micCircleOutline,
  micOutline,
  happyOutline,
  attachOutline,
  send,
  cameraOutline,
  colorPaletteOutline,
  pulse,
  personAddOutline,
  personCircleOutline,
} from "ionicons/icons";
import React, { useEffect, useRef, useState } from "react";
import "./RoomChatPAge.scss";
import { useHistory, useLocation } from "react-router";
import toast from "react-hot-toast";
import { getMessagesApi } from "../../service/roomService";
import { useAuth } from "../../contexts/AuthContext";
import socketService from "../../service/socketService";
import { STOMP } from "../../config/api.config";

interface ChatPageState {
  username?: string;
  roomId: string;
}

interface Message {
  sender: string;
  content: string;
  timeStamp?: string;
}

const RoomChatPage: React.FC = () => {
  const location = useLocation<ChatPageState>();
  const history = useHistory();
  const { user } = useAuth();

  // The logged-in user is always the sender of record — trust the auth
  // context over whatever was passed through router state.
  const username = user?.username ?? location.state?.username;
  const { roomId } = location.state || ({} as ChatPageState);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(socketService.isConnected());

  const contentRef = useRef<HTMLIonContentElement | null>(null);

  useEffect(() => {
    if (!username || !roomId) {
      toast.error("Username or Room ID is missing");
      history.replace("/app/home");
    }
  }, [username, roomId, history]);

  useEffect(() => {
    if (!roomId) return;
    const loadMessages = async () => {
      try {
        const response = await getMessagesApi(roomId);
        setMessages(response.data);
      } catch (error) {
        console.error("Error loading messages:", error);
        toast.error("Unable to load messages");
      }
    };
    loadMessages();
  }, [roomId]);

  // Subscribe to this room's topic on the ALREADY-authenticated shared
  // socket (opened for the whole session by useRealtimeConnection in
  // AppTabs) instead of spinning up a brand-new, unauthenticated
  // connection per chat screen.
  useEffect(() => {
    if (!roomId) return;

    const unsubscribeConn = socketService.onConnectionChange(setConnected);

    const subscribeToRoom = () => {
      socketService.subscribe(
        `room-${roomId}`,
        STOMP.roomTopic(roomId),
        (body: Message) => {
          setMessages((prev) => [...prev, body]);
        }
      );
    };

    if (socketService.isConnected()) {
      subscribeToRoom();
    } else {
      // Socket is still (re)connecting — subscribe as soon as it's up.
      const unsub = socketService.onConnectionChange((isUp) => {
        if (isUp) subscribeToRoom();
      });
      return () => {
        unsub();
        unsubscribeConn();
        socketService.unsubscribe(`room-${roomId}`);
      };
    }

    return () => {
      unsubscribeConn();
      socketService.unsubscribe(`room-${roomId}`);
    };
  }, [roomId]);

  useEffect(() => {
    const scrollToBottom = async () => {
      if (contentRef.current) {
        await contentRef.current.scrollToBottom(300);
      }
    };
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    const messageText = input.trim();
    if (!messageText) return;

    if (!socketService.isConnected()) {
      toast.error("You are not connected to the chat");
      return;
    }

    const message: Message & { roomId: string } = {
      sender: username!,
      content: messageText,
      roomId,
    };

    const sent = socketService.publish(STOMP.sendRoomMessage(roomId), message);
    if (sent) setInput("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleEndChat = () => {
    socketService.unsubscribe(`room-${roomId}`);
    toast.success("Chat ended");
    history.replace("/app/home");
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          {/* Back Button */}
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/home" />
          </IonButtons>

          {/* Profile + Name */}
          <div className="chat-user-info">
            <IonIcon className="chat-user-avatar" icon={personCircle} />

            <div className="chat-user-details">
              <div className="chat-user-name">{username}</div>

              <div className="chat-user-status">
                {connected ? "Online" : "Connecting…"}
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <IonButtons slot="end">
            <IonButton fill="clear">
              <IonIcon slot="icon-only" icon={videocamOutline} />
            </IonButton>

            <IonButton fill="clear">
              <IonIcon slot="icon-only" icon={callOutline} />
            </IonButton>

            <IonButton fill="clear">
              <IonIcon
                slot="icon-only"
                ios={ellipsisHorizontal}
                md={ellipsisVertical}
              />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent ref={contentRef}>
        <IonList className="message-list">
          {messages.length === 0 && (
            <div className="empty-chat">
              <IonIcon icon={personCircle} className="empty-chat-icon" />

              <h3>No messages yet</h3>

              <p>Start a conversation with your room members.</p>
            </div>
          )}

          {messages.map((message, index) => {
            const isMyMessage = message.sender === username;

            return (
              <div
                key={index}
                className={`message-row ${
                  isMyMessage ? "my-message" : "other-message"
                }`}
              >
                {!isMyMessage && (
                  <IonAvatar className="message-avatar">
                    <IonIcon size="large" icon={personCircleOutline}></IonIcon>
                  </IonAvatar>
                )}

                <div className="message-container">
                  {!isMyMessage && (
                    <IonLabel className="message-sender">
                      {message.sender}
                    </IonLabel>
                  )}

                  <div
                    className={`message-bubble ${
                      isMyMessage ? "my-bubble" : "other-bubble"
                    }`}
                  >
                    <div className="message-text">{message.content}</div>

                    {message.timeStamp && (
                      <div className="message-time">
                        {new Date(message.timeStamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </IonList>
      </IonContent>
      {roomId == "" && (
        <IonToolbar color={"light"}>
          <IonButton
            size="small"
            slot="start"
            fill="solid"
            className="ion-margin-start"
          >
            NEW CHAT
          </IonButton>

          <IonButton
            size="small"
            slot="start"
            fill="solid"
            className="ion-margin-start"
            onClick={handleEndChat}
          >
            END CHAT
          </IonButton>
          <IonButton fill="clear">
            <IonIcon size="medium" slot="icon-only" icon={colorPaletteOutline} />
          </IonButton>
          <IonButton fill="clear">
            <IonIcon size="medium" slot="icon-only" icon={personAddOutline} />
          </IonButton>
        </IonToolbar>
      )}
      <IonToolbar>
        <IonInput
          fill="outline"
          placeholder="Type a message"
          className="chat-input"
          value={input}
          onIonInput={(event) => setInput(event.detail.value ?? "")}
          onKeyDown={handleKeyDown}
        ></IonInput>
        <IonButton slot="start" fill="clear" size="small">
          <IonIcon slot="icon-only" icon={happyOutline} />
        </IonButton>

        <IonButton slot="end" fill="clear" size="small">
          <IonIcon slot="icon-only" icon={micOutline} />
        </IonButton>

        <IonButton slot="end" fill="clear" size="small">
          <IonIcon slot="icon-only" icon={cameraOutline} />
        </IonButton>
        <IonButton
          slot="end"
          fill="clear"
          size="small"
          disabled={!input.trim() || !connected}
          onClick={sendMessage}
        >
          <IonIcon slot="icon-only" icon={send} />
        </IonButton>
      </IonToolbar>
    </IonPage>
  );
};

export default RoomChatPage;
