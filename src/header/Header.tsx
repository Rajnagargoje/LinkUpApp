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
        {/* App Logo — pinned to the start, outside the centered title */}
        <IonButtons slot="start">
          <div className="brand-logo">
            <IonIcon icon={chatbubbles} />
            <span className="brand-logo-pulse" aria-hidden="true" />
          </div>
        </IonButtons>

        {/* Centered brand name + subtitle */}
        <IonTitle className="brand-title">
          <div className="brand-name">LinkUp</div>
          <div className="brand-subtitle">Connect. Chat. Belong.</div>
        </IonTitle>

        {/* Right Actions */}
        <IonButtons slot="end">
          <IonButton fill="clear" className="header-action" aria-label="Camera">
            <IonIcon slot="icon-only" icon={cameraOutline} />
          </IonButton>

          <IonButton
            fill="clear"
            className="header-action"
            aria-label="More options"
            onClick={() => router.push("/app/me/settings")}
          >
            <IonIcon icon={settingsOutline} />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
};

export default Header;
