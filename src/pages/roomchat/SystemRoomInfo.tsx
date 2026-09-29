import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from "@ionic/react";
import { SystemRoom } from "../../service/roomService";
import "./SystemRoomInfo.scss";

interface Props {
  room: SystemRoom | null;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onJoin?: () => void;
}

export default function SystemRoomInfo({ room, busy = false, error, onClose, onJoin }: Props) {
  return <IonModal isOpen={!!room} onDidDismiss={onClose} canDismiss={!busy} className="system-room-modal">
    <IonHeader><IonToolbar>
      <IonTitle>Room info</IonTitle>
      <IonButtons slot="end"><IonButton disabled={busy} onClick={onClose}>Close</IonButton></IonButtons>
    </IonToolbar></IonHeader>
    <IonContent className="ion-padding system-room-info">
      {room && <>
        <span className="system-room-label">LinkUp system room · Public</span>
        <h1>{room.title}</h1>
        <h2>Topic</h2><p className="system-room-topic">{room.topic}</p>
        <p>{room.description}</p>
        <h2>Room rules</h2>
        <ol>{room.rules.map(rule => <li key={rule}>{rule}</li>)}</ol>
        <p className="system-room-note">Messages are visible to everyone who joins this room. Keep personal details private.</p>
        {error && <p role="alert" className="system-room-error">{error}</p>}
        {onJoin && <IonButton expand="block" shape="round" className="feature-cta--primary" disabled={busy} onClick={onJoin}>
          {busy ? "Joining…" : "Start chat"}
        </IonButton>}
      </>}
    </IonContent>
  </IonModal>;
}
