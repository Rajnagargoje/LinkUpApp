import {
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle,
  IonCardTitle, IonContent, IonIcon, IonPage, IonSpinner, useIonRouter,
} from "@ionic/react";
import { chatbubblesOutline, flashOutline, languageOutline, musicalNotesOutline, constructOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { useHistory } from "react-router";
import Header from "../../header/Header";
import { getSystemRoomsApi, joinSystemRoomApi, SystemRoom } from "../../service/roomService";
import SystemRoomInfo from "../roomchat/SystemRoomInfo";
import "./homePage.scss";

const roomIcons: Record<string, string> = {
  "system-feedback": constructOutline,
  "system-interests": musicalNotesOutline,
  "system-languages": languageOutline,
  "system-lounge": chatbubblesOutline,
};

const HomePage: React.FC = () => {
  const router = useIonRouter();
  const history = useHistory();
  const [rooms, setRooms] = useState<SystemRoom[]>([]);
  const [selected, setSelected] = useState<SystemRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  const loadRooms = async () => {
    setLoading(true); setLoadError("");
    try { setRooms((await getSystemRoomsApi()).data); }
    catch { setLoadError("We couldn't load the community rooms. Please try again."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadRooms(); }, []);

  const joinRoom = async () => {
    if (!selected || joining) return;
    setJoining(true); setJoinError("");
    try {
      const room = (await joinSystemRoomApi(selected.roomId)).data;
      setSelected(null);
      history.push("/app/chatPage", { roomId: room.roomId, roomTitle: room.title, systemRoom: room });
    } catch { setJoinError("Couldn't join this room. Please try again."); }
    finally { setJoining(false); }
  };

  return <IonPage>
    <Header />
    <IonContent className="home-content">
      <div className="home-room-list">
        <div className="home-welcome"><h1>Find your conversation</h1><p>Meet someone new, or join a topic you enjoy.</p></div>
        <IonCard className="feature-card feature-card--hero">
          <IonCardHeader>
            <div className="feature-icon feature-icon--primary"><IonIcon icon={flashOutline} /></div>
            <div className="feature-heading">
              <IonCardTitle>Random one-to-one chat</IonCardTitle>
              <IonCardSubtitle className="feature-pill feature-pill--primary">Just you and someone new</IonCardSubtitle>
            </div>
          </IonCardHeader>
          <IonCardContent>
            <p className="feature-copy">Start a private conversation with a random member. Language and interest matching are optional.</p>
            <IonButton className="feature-cta feature-cta--primary" expand="block" shape="round" onClick={() => router.push("/app/randomchat")}>Start random chat</IonButton>
          </IonCardContent>
        </IonCard>
        {loading && <div className="home-room-status" role="status"><IonSpinner /><p>Loading community rooms…</p></div>}
        {loadError && <div className="home-room-status" role="alert"><p>{loadError}</p><IonButton fill="outline" onClick={() => void loadRooms()}>Try again</IonButton></div>}
        {rooms.map((room, index) => <IonCard key={room.roomId} className="feature-card system-room-card" button onClick={() => { setSelected(room); setJoinError(""); }} aria-label={`View ${room.title} room info`}>
          <IonCardHeader>
            <div className={`feature-icon feature-icon--${["secondary", "success", "warning", "primary"][index % 4]}`}><IonIcon icon={roomIcons[room.roomId] || chatbubblesOutline} /></div>
            <div className="feature-heading"><IonCardTitle>{room.title}</IonCardTitle><IonCardSubtitle className="feature-pill feature-pill--primary">System room · Public</IonCardSubtitle></div>
          </IonCardHeader>
          <IonCardContent><p className="system-room-card-topic">{room.topic}</p><p className="feature-copy">{room.description}</p><span className="room-info-link">View topic & rules →</span></IonCardContent>
        </IonCard>)}
      </div>
      <SystemRoomInfo room={selected} busy={joining} error={joinError} onClose={() => setSelected(null)} onJoin={() => void joinRoom()} />
    </IonContent>
  </IonPage>;
};
export default HomePage;
