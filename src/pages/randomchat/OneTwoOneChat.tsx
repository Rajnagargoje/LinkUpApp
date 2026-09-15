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
import { Icon } from "ionicons/dist/types/components/icon/icon";
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
import "./OneTwoOneChat.scss";
import { useHistory, useLocation } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import socketService from "../../service/socketService";

interface Message {
  sender: string;
  content: string;
  timeStamp?: string;
}

const OneTwoOneChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(socketService.isConnected());

  const contentRef = useRef<HTMLIonContentElement | null>(null);

  const { user } = useAuth();
  // Real, logged-in username instead of the previous hardcoded "Ganesh".
  const username = user?.username ?? "You";

  useEffect(() => {
    return socketService.onConnectionChange(setConnected);
  }, []);

  // Hook MUST be here, not inside sendMessage()
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

    if (!messageText) {
      return;
    }

    const message: Message = {
      sender: username,
      content: messageText,
      timeStamp: new Date().toISOString(),
    };

    console.log("Sending:", message);

    // Add message to state
    setMessages((prev) => [...prev, message]);

    // Clear input
    setInput("");
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage();
    }
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
                {/* OTHER USER AVATAR */}

                {!isMyMessage && (
                  <IonAvatar className="message-avatar">
                    <IonIcon size="large" icon={personCircleOutline}></IonIcon>
                  </IonAvatar>
                )}

                <div className="message-container">
                  {/* SENDER */}

                  {!isMyMessage && (
                    <IonLabel className="message-sender">
                      {message.sender}
                    </IonLabel>
                  )}

                  {/* MESSAGE BUBBLE */}

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

      <IonToolbar color={"dark"}>
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
          disabled={!input.trim()}
          onClick={sendMessage}
        >
          <IonIcon slot="icon-only" icon={send} />
        </IonButton>
      </IonToolbar>
    </IonPage>
  );
};

export default OneTwoOneChat;
