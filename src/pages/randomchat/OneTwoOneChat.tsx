import { IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import { personCircle, send } from "ionicons/icons";
import React, { useEffect, useRef, useState } from "react";
import { IonAlert } from "@ionic/react";
import { useAuth } from "../../contexts/AuthContext";
import socketService from "../../service/socketService";
import "./OneTwoOneChat.scss";

type Phase = "idle" | "waiting" | "matched" | "ended";
interface ChatMessage { id: string; sender: string; senderId?: string; mine?: boolean; content: string; timeStamp: string }
interface ChatEvent extends Partial<ChatMessage> {
  type: "WAITING" | "MATCHED" | "MATCH_UPDATED" | "MESSAGE" | "ENDED" | "ERROR" | "REGISTER_REQUIRED" | "CONNECTION";
  selfId?: string;
  partnerGuest?: boolean;
  matchId?: string;
  partner?: string;
  message?: string;
}

const OneTwoOneChat: React.FC = () => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(socketService.isConnected());
  const [phase, setPhase] = useState<Phase>("idle");
  const [partner, setPartner] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState("");
  const [interests, setInterests] = useState("");
  const [partnerGuest, setPartnerGuest] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const selfId = useRef<string>();
  const preferences = useRef({ language: "", interests: [] as string[] });
  const matchId = useRef<string>();
  const nextAfterLeave = useRef(false);
  const contentRef = useRef<HTMLIonContentElement>(null);

  useEffect(() => {
    const join = () => {
      setMessages([]);
      setInput("");
      setPartner("");
      matchId.current = undefined;
      setNotice("");
      setPhase("waiting");
      socketService.publish("/app/random/join", preferences.current);
    };
    const subscribe = () => socketService.subscribe("random-chat", "/user/queue/random", (event: ChatEvent) => {
      switch (event.type) {
        case "WAITING":
          setPhase("waiting");
          setBusy(false);
          break;
        case "MATCHED":
        case "MATCH_UPDATED":
          matchId.current = event.matchId;
          selfId.current = event.selfId;
          setPartnerGuest(!!event.partnerGuest);
          setPartner(event.partner ?? "Your partner");
          setPhase("matched");
          setBusy(false);
          setNotice("");
          break;
        case "MESSAGE":
          if (event.matchId === matchId.current && event.id && event.sender && event.content && event.timeStamp) {
            const message = { ...event, mine: event.senderId ? event.senderId === selfId.current : event.sender === user?.username } as ChatMessage;
            setMessages(previous => previous.some(item => item.id === message.id) ? previous : [...previous, message]);
          }
          break;
        case "ENDED":
          if (event.matchId && event.matchId !== matchId.current) break;
          matchId.current = undefined;
          setPhase("ended");
          setBusy(false);
          setNotice(event.message ?? "Chat ended.");
          if (nextAfterLeave.current && !event.matchId) {
            nextAfterLeave.current = false;
            join();
          }
          break;
        case "REGISTER_REQUIRED":
        case "CONNECTION":
          setNotice(event.message ?? "Check your friend requests to keep in touch.");
          setBusy(false);
          break;
        case "ERROR":
          setNotice(event.message ?? "Unable to complete the request.");
          setBusy(false);
          setPhase(current => current === "waiting" ? "idle" : current);
          break;
      }
    });
    const removeListener = socketService.onConnectionChange(isConnected => {
      setConnected(isConnected);
      if (isConnected) subscribe();
      else {
        matchId.current = undefined;
        nextAfterLeave.current = false;
        setBusy(false);
        setPhase("ended");
        setNotice("Connection lost. Start a new chat once reconnected.");
      }
    });
    if (socketService.isConnected()) subscribe();
    return () => {
      socketService.publish("/app/random/leave", {});
      socketService.unsubscribe("random-chat");
      removeListener();
    };
  }, []);

  useEffect(() => { void contentRef.current?.scrollToBottom(200); }, [messages]);

  const start = () => {
    if (!connected || busy) return;
    preferences.current = { language: language.trim(), interests: interests.split(",").map(value => value.trim()).filter(Boolean).slice(0, 10) };
    setNotice("");
    setBusy(true);
    if (phase === "matched") {
      nextAfterLeave.current = true;
      socketService.publish("/app/random/leave", {});
    } else {
      setMessages([]);
      setInput("");
      setPartner("");
      setPhase("waiting");
      socketService.publish("/app/random/join", preferences.current);
    }
  };
  const end = () => {
    nextAfterLeave.current = false;
    setBusy(true);
    socketService.publish("/app/random/leave", {});
  };
  const sendMessage = () => {
    const content = input.trim();
    if (!content || content.length > 2000 || !matchId.current || !connected || busy) return;
    if (socketService.publish("/app/random/message", { matchId: matchId.current, content })) setInput("");
  };
  const status = !connected ? "Reconnecting…" : phase === "waiting" ? "Looking for someone…" : phase === "matched" ? "Connected" : "Ready when you are";

  return (
    <IonPage className="random-chat-page">
      <IonAlert isOpen={reportOpen} onDidDismiss={() => setReportOpen(false)} header="Report & block" message="Your reason and the last 20 messages will be saved for review. This ends the chat and blocks this identity." inputs={[{ name: "reason", type: "textarea", placeholder: "What happened?", attributes: { maxlength: 500 } }]} buttons={["Cancel", { text: "Submit report", handler: (data: { reason: string }) => { if (!data.reason?.trim()) return false; socketService.publish("/app/random/report", { matchId: matchId.current, content: data.reason }); return true; } }]} />
      <IonHeader><IonToolbar className="random-toolbar">
        <IonButtons slot="start"><IonBackButton defaultHref="/app/home" className="random-back-btn" /></IonButtons>
        <IonTitle>{phase === "matched" ? partner : "Random Chat"}</IonTitle>
      </IonToolbar></IonHeader>
      <IonContent ref={contentRef} className="random-content">
        <div className={`random-status random-status--${phase}`} role="status">
          <span className={`random-status-dot ${connected && phase === "matched" ? "random-status-dot--live" : ""}`} />
          {status}{phase === "matched" ? partnerGuest ? " · Guest" : " · Registered member" : ""}
        </div>
        {(phase === "idle" || phase === "ended") && <div className="random-prefs-card">
          <IonInput label="Preferred language (optional)" value={language} maxlength={40} fill="outline" labelPlacement="floating" onIonInput={event => setLanguage(event.detail.value ?? "")} />
          <IonInput label="Interests (optional, comma separated)" value={interests} maxlength={400} fill="outline" labelPlacement="floating" className="ion-margin-top" onIonInput={event => setInterests(event.detail.value ?? "")} />
          <p className="random-prefs-hint">Preferences prioritize available matches. Website guests and app members share this pool.</p>
        </div>}
        {notice && <p className="random-notice" role="alert">{notice}</p>}
        {messages.length === 0 && <div className="empty-chat">
          {phase === "waiting" ? (
            <div className="radar-wrap" aria-hidden="true">
              <span className="radar-ring radar-ring--1" />
              <span className="radar-ring radar-ring--2" />
              <span className="radar-ring radar-ring--3" />
              <div className="radar-core"><IonIcon icon={personCircle} /></div>
            </div>
          ) : <IonIcon icon={personCircle} className="empty-chat-icon" />}
          <h3>{phase === "waiting" ? "Finding your next conversation" : phase === "matched" ? `Say hello to ${partner}` : "Meet someone new"}</h3>
          <p>{phase === "waiting" ? "Waiting for another person. You can cancel anytime." : phase === "matched" ? "You’re connected. Send the first message." : "Tap New chat to find a conversation partner."}</p>
        </div>}
        <div className="random-messages" role="log" aria-label="Chat messages" aria-live="polite">
          {messages.map(message => <div key={message.id} className={`message-row ${message.mine ? "my-message" : "other-message"}`}>
            <div className={`message-bubble ${message.mine ? "my-bubble" : "other-bubble"}`}>
              <div className="message-text">{message.content}</div>
              <div className="message-time">{new Date(message.timeStamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>)}
        </div>
      </IonContent>
      <IonFooter>
        {phase === "matched" && <IonToolbar className="random-action-toolbar">
          <IonButton className="random-action-btn random-action-btn--primary" disabled={busy} onClick={() => socketService.publish("/app/random/connect", { matchId: matchId.current })}>Keep in touch</IonButton>
          <IonButton className="random-action-btn" fill="clear" disabled={busy} onClick={() => socketService.publish("/app/random/block", { matchId: matchId.current })}>Block & leave</IonButton>
          <IonButton className="random-action-btn" fill="clear" onClick={() => setReportOpen(true)}>Report</IonButton>
        </IonToolbar>}
        <IonToolbar className="random-action-toolbar">
          <IonButton className="random-action-btn random-action-btn--primary" onClick={start} disabled={!connected || busy || phase === "waiting"}>{phase === "matched" ? "Next person" : "New chat"}</IonButton>
          <IonButton className="random-action-btn" fill="outline" onClick={end} disabled={!connected || busy || (phase !== "matched" && phase !== "waiting")}>{phase === "waiting" ? "Cancel search" : "End chat"}</IonButton>
        </IonToolbar>
        <IonToolbar className="random-input-toolbar">
          <IonInput className="random-input" aria-label="Message" placeholder={phase === "matched" ? "Type a message" : "Start a chat to send messages"} value={input} maxlength={2000}
            disabled={!connected || busy || phase !== "matched"} onIonInput={event => setInput(event.detail.value ?? "")}
            onKeyDown={event => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); sendMessage(); } }} />
          <IonButton slot="end" className="random-send-btn" aria-label="Send message" disabled={!connected || busy || phase !== "matched" || !input.trim()} onClick={sendMessage}><IonIcon slot="icon-only" icon={send} /></IonButton>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};
export default OneTwoOneChat;
