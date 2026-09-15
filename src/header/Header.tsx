import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from "@ionic/react";

import {
  atOutline,
  cameraOutline,
  chatbubbles,
  ellipsisHorizontal,
  ellipsisVertical,
  settingsOutline,
} from "ionicons/icons";

import "./Header.scss";

const Header: React.FC = () => {
  const router = useIonRouter();
  return (
    <IonHeader className="main-header">
      <IonToolbar className="main-toolbar">
        {/* App Logo */}
        <div className="brand-container">
          <div className="brand-logo">
            <IonIcon icon={chatbubbles} />
            {/* Live pulse — subtle signal that random matching is active */}
            <span className="brand-logo-pulse" aria-hidden="true" />
          </div>

          <div className="brand-text">
            <div className="brand-name">LinkUp</div>

            <div className="brand-subtitle">Connect. Chat. Belong.</div>
          </div>
        </div>

        {/* Right Actions */}
        <IonButtons slot="end">
          <IonButton
            fill="clear"
            className="header-action"
            aria-label="Mentions"
          >
            <IonIcon slot="icon-only" icon={atOutline} />
          </IonButton>

          <IonButton fill="clear" className="header-action" aria-label="Camera">
            <IonIcon slot="icon-only" icon={cameraOutline} />
          </IonButton>

          <IonButton
            fill="clear"
            className="header-action"
            aria-label="More options"
            onClick={() => router.push("/app/me/settings")}
          >
            {/* <IonIcon
              slot="icon-only"
              ios={ellipsisHorizontal}
              md={ellipsisVertical}
            /> */}
            <IonIcon icon={settingsOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
};

export default Header;
