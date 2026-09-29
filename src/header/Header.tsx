import {
  IonButton,
  IonBadge,
  IonButtons,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from "@ionic/react";

import {
  notificationsOutline,
  cameraOutline,
  chatbubbles,
  ellipsisHorizontal,
  ellipsisVertical,
  settingsOutline,
} from "ionicons/icons";

import "./Header.scss";

import { useNotifications } from "../contexts/NotificationContext";
import { badgeCount } from "../service/notificationService";
import "../pages/notifications/NotificationsPage.scss";

const Header: React.FC = () => {
  const { counts } = useNotifications();
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
          <IonButton fill="clear" className="header-action notification-bell" aria-label={`Notifications, ${counts.total} unread`} onClick={() => router.push("/app/notifications")}>
            <IonIcon slot="icon-only" icon={notificationsOutline} />
            {counts.total > 0 && <IonBadge color="danger">{badgeCount(counts.total)}</IonBadge>}
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
