import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonPage,
  IonToast,
  useIonRouter,
} from "@ionic/react";
import {
  addOutline,
  chatboxOutline,
  flashOutline,
  peopleOutline,
  starHalfOutline,
} from "ionicons/icons";

import { useState } from "react";
import Header from "../../header/Header";
import { useHistory } from "react-router";

import { createRoomApi, joinChatApi } from "../../service/roomService";
import JoinCreateRoom from "../roomchat/JoinCreateRoom";

import "./HomePage.scss";

const HomePage: React.FC = () => {
  const router = useIonRouter();

  const [showRoomPopup, setShowRoomPopup] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const history = useHistory();

  const handleJoinRoom = async (data: { username: string; roomId: string }) => {
    console.log("join Room", data);
    try {
      const room = await joinChatApi(data.roomId);
      setShowToast(true);
      console.log(room);
      history.push("/app/chatPage", {
        username: data.username,
        roomId: data.roomId,
      });
      setShowRoomPopup(false);
      setToastMessage("Joined....");
    } catch (error: any) {
      console.log("64", error);
      setShowToast(true);

      if (error.status == 400) {
        setToastMessage(error.response.data);
      } else {
        setToastMessage("Error in joinng room !!");
        console.log("69", error);
      }
    }

    setShowRoomPopup(false);
  };

  const handleCreateRoom = async (data: {
    username: string;
    roomId: string;
  }) => {
    try {
      const response = await createRoomApi(data.roomId);
      console.log("API Response", response);
      setShowToast(true);
      setToastMessage("Room created Successfully !!");
      history.push("/app/chatPage", {
        username: data.username,
        roomId: data.roomId,
      });
      setShowRoomPopup(false);
    } catch (error: any) {
      console.log("71", error);
      if (error.status == 400) {
        setShowToast(true);
        setToastMessage("Room already exists!");
      } else {
        setShowToast(true);
        setToastMessage("Error creating room");
      }
    }

    setShowRoomPopup(false);
  };

  return (
    <IonPage>
      <Header />
      <IonContent className="home-content">
        {/* Hero card — the primary action gets the most weight */}
        <IonCard className="feature-card feature-card--hero">
          <IonCardHeader>
            <div className="feature-icon feature-icon--primary">
              <IonIcon icon={flashOutline} />
            </div>
            <div className="feature-heading">
              <IonCardTitle>Random Chat</IonCardTitle>
              <IonCardSubtitle className="feature-pill feature-pill--primary">
                <span className="feature-pill-dot" />
                1,500+ online now
              </IonCardSubtitle>
            </div>
          </IonCardHeader>
          <IonCardContent>
            <p className="feature-copy">
              Get paired instantly with someone new. No profiles, no swiping —
              just a conversation.
            </p>
            <IonButton
              className="feature-cta feature-cta--primary"
              expand="block"
              shape="round"
              onClick={() => router.push("/app/randomchat")}
            >
              <IonIcon slot="start" icon={starHalfOutline}></IonIcon>
              Start Chat
            </IonButton>
          </IonCardContent>
        </IonCard>

        {/* Secondary actions */}
        <IonCard className="feature-card">
          <IonCardHeader>
            <div className="feature-icon feature-icon--secondary">
              <IonIcon icon={addOutline} />
            </div>
            <div className="feature-heading">
              <IonCardTitle>Create Your Own Room</IonCardTitle>
              <IonCardSubtitle className="feature-pill feature-pill--secondary">
                Private &amp; shareable
              </IonCardSubtitle>
            </div>
          </IonCardHeader>
          <IonCardContent>
            <p className="feature-copy">
              Set up a room and invite specific people with a room code.
            </p>
            <IonButton
              className="feature-cta feature-cta--secondary"
              expand="block"
              shape="round"
              fill="outline"
              onClick={() => setShowRoomPopup(true)}
            >
              <IonIcon slot="start" icon={addOutline}></IonIcon>
              Create Room
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard className="feature-card">
          <IonCardHeader>
            <div className="feature-icon feature-icon--success">
              <IonIcon icon={peopleOutline} />
            </div>
            <div className="feature-heading">
              <IonCardTitle onClick={() => router.push("/app/chatPage")}>
                Group Chat
              </IonCardTitle>
              <IonCardSubtitle className="feature-pill feature-pill--success">
                500+ active
              </IonCardSubtitle>
            </div>
          </IonCardHeader>
          <IonCardContent>
            <p className="feature-copy">
              Join open group rooms and chat with several people at once.
            </p>
            <IonButton
              className="feature-cta feature-cta--success"
              expand="block"
              shape="round"
              fill="outline"
              onClick={() => router.push("/app/chatPage")}
            >
              <IonIcon slot="start" icon={starHalfOutline}></IonIcon>
              Start Chat
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard className="feature-card">
          <IonCardHeader>
            <div className="feature-icon feature-icon--warning">
              <IonIcon icon={chatboxOutline} />
            </div>
            <div className="feature-heading">
              <IonCardTitle onClick={() => router.push("/app/chatPage")}>
                Chatters Of All Ages
              </IonCardTitle>
              <IonCardSubtitle className="feature-pill feature-pill--warning">
                2,500 members
              </IonCardSubtitle>
            </div>
          </IonCardHeader>
          <IonCardContent>
            <p className="feature-copy">
              A relaxed, all-ages community room — everyone's welcome.
            </p>
            <IonButton
              className="feature-cta feature-cta--warning"
              expand="block"
              shape="round"
              fill="outline"
              onClick={() => router.push("/app/chatPage")}
            >
              <IonIcon slot="start" icon={chatboxOutline}></IonIcon>
              Join Chat
            </IonButton>
          </IonCardContent>
        </IonCard>

        <JoinCreateRoom
          isOpen={showRoomPopup}
          onClose={() => setShowRoomPopup(false)}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
        />
        <IonToast
          isOpen={showToast}
          message={toastMessage}
          duration={2500}
          position="bottom"
          color="danger"
          onDidDismiss={() => setShowToast(false)}
        />
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
