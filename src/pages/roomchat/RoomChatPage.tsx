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
import "./RoomChatPage.scss";
import { useHistory, useLocation } from "react-router";
import toast from "react-hot-toast";
import { getMessagesApi, SystemRoom } from "../../service/roomService";
import { useAuth } from "../../contexts/AuthContext";
import socketService from "../../service/socketService";
import { STOMP } from "../../config/api.config";

import SystemRoomInfo from "./SystemRoomInfo";
interface ChatPageState {
  username?: string;
  roomId: string;
  roomTitle?: string;
  systemRoom?: SystemRoom;
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

  const [showInfo, setShowInfo] = useState(false);
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

  useEffect(() => socketService.onConnectionChange(setConnected), []);

  // Subscribe again after reconnect, including when the socket was already up on entry.
  useEffect(() => {
    if (!roomId || !connected) return;
    socketService.subscribe(
      `room-${roomId}`,
      STOMP.roomTopic(roomId),
      (body: Message) => setMessages(previous => [...previous, body]),
    );
    return () => socketService.unsubscribe(`room-${roomId}`);
  }, [roomId, connected]);
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
              <div className="chat-user-name">{location.state?.roomTitle || roomId}</div>

              <div className="chat-user-status">
                {connected ? "Online" : "Connecting…"}
              </div>
            </div>
          </div>

          <IonButtons slot="end">
            {location.state?.systemRoom && <IonButton onClick={() => setShowInfo(true)}>Room info</IonButton>}
            <IonButton onClick={handleEndChat}>Leave</IonButton>
          </IonButtons>        </IonToolbar>
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
      <IonToolbar>
        <IonInput
          fill="outline"
          placeholder="Type a message"
          maxlength={2000}
          disabled={!connected}
          className="chat-input"
          value={input}
          onIonInput={(event) => setInput(event.detail.value ?? "")}
          onKeyDown={handleKeyDown}
        ></IonInput>
        <IonButton
          slot="end"
          fill="clear"
          size="small"
          disabled={!input.trim() || !connected}
          aria-label="Send message"
          onClick={sendMessage}
        >
          <IonIcon slot="icon-only" icon={send} />
        </IonButton>
      </IonToolbar>
      <SystemRoomInfo room={showInfo ? location.state?.systemRoom ?? null : null} onClose={() => setShowInfo(false)} />
    </IonPage>
  );
};

export default RoomChatPage;
