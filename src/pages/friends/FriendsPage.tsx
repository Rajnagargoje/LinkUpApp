import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRow,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import ExploreContainer from "../../components/ExploreContainer";
import {
  chatboxOutline,
  atOutline,
  cameraOutline,
  ellipsisHorizontal,
  ellipsisVertical,
  personAddOutline,
  personCircleSharp,
  ellipsisVerticalOutline,
} from "ionicons/icons";
import Header from "../../header/Header";

const FriendsPage: React.FC = () => {
  const friends = [
    {
      id: 1,
      name: "Ganesh Nagargoje",
      status: "Online",
    },
    {
      id: 2,
      name: "Rahul Patil",
      status: "Online",
    },
    {
      id: 3,
      name: "Amit Sharma",
      status: "Offline",
    },
    {
      id: 4,
      name: "Akshay Kumar",
      status: "Online",
    },
  ];
  return (
    <IonPage>
      <Header />
      <IonContent fullscreen>
        <IonSearchbar color={"light"}></IonSearchbar>
        <IonSegment value="default">
          <IonSegmentButton value="default">
            <IonLabel>YOUR FRIENDS</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="segment">
            <IonLabel>FRIEND REQUESTS</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        <IonList>
          {friends.map((friend) => (
            <>
              <IonItem lines="none" className="friend-item">
                {/* Profile */}
                <IonAvatar slot="start">
                  <IonIcon size="large" icon={personCircleSharp} />
                </IonAvatar>

                {/* Name + Status */}
                <IonLabel>
                  <h2>{friend.name}</h2>

                  <IonText
                    color={friend.status === "Online" ? "success" : "medium"}
                  >
                    <p>
                      <span
                        className={`status-dot ${
                          friend.status === "Online" ? "online" : "offline"
                        }`}
                      ></span>
                      {friend.status}
                    </p>
                  </IonText>
                </IonLabel>

                {/* Actions */}
                <IonButtons slot="end">
                  <IonButton fill="clear">
                    <IonIcon slot="icon-only" icon={chatboxOutline} />
                  </IonButton>

                  <IonButton fill="clear">
                    <IonIcon slot="icon-only" icon={ellipsisVerticalOutline} />
                  </IonButton>
                </IonButtons>
              </IonItem>
              <hr style={{ background: "white", height: "2px" }} />
            </>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default FriendsPage;
