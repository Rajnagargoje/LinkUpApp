import {
  IonAlert,
  IonAvatar,
  IonBackButton,
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
  IonMenuButton,
  IonPage,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
  useIonLoading,
  useIonRouter,
} from "@ionic/react";
import ExploreContainer from "../../components/ExploreContainer";
import {
  appsOutline,
  arrowForwardOutline,
  banOutline,
  contract,
  documentTextOutline,
  giftOutline,
  imageOutline,
  lockClosedOutline,
  mailOutline,
  manOutline,
  person,
  personAddOutline,
  personCircleOutline,
  personOutline,
  settingsOutline,
  shieldCheckmarkOutline,
} from "ionicons/icons";
import "./Settings.scss";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLinkUpTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";

const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useLinkUpTheme();
  const { user, logout, deleteAccount } = useAuth();
  const router = useIonRouter();
  const [present, dismiss] = useIonLoading();
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out");
    router.push("/", "root");
  };

  const handleDeleteAccount = async () => {
    await present("Deleting your account…");
    try {
      await deleteAccount();
      dismiss();
      toast.success("Your account has been deleted");
      router.push("/", "root");
    } catch (error: any) {
      dismiss();
      toast.error(
        error?.response?.data?.message ||
          "Unable to delete your account right now. Please try again."
      );
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/home" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonSegment
          value={theme}
          onIonChange={(e) => setTheme(e.detail.value as any)}
        >
          <IonSegmentButton value="light">
            <IonLabel>Light</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="dark">
            <IonLabel>Dark</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="modern">
            <IonLabel>Modern</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {/* Only shown if the person skipped verification after signup —
            this is the ONLY way back to that screen once skipped, since
            the app never forces it again on its own. */}
        {user && !user.emailVerified && (
          <IonList className="settings-list settings-section">
            <IonItem
              button
              className="settings-item"
              lines="none"
              routerLink="/verify-email"
            >
              <IonIcon slot="start" icon={mailOutline} className="settings-icon" />
              <IonLabel>
                <h2>Verify your email</h2>
                <p>You won't be able to reset your password until this is done</p>
              </IonLabel>
              <IonIcon
                slot="end"
                icon={arrowForwardOutline}
                className="settings-arrow"
              />
            </IonItem>
          </IonList>
        )}

        <IonList className="settings-list settings-section">
          <IonItem button className="settings-item" lines="none">
            <IonIcon
              slot="start"
              icon={giftOutline}
              className="settings-icon"
            />

            <IonLabel>Invite friends</IonLabel>
          </IonItem>
        </IonList>
        <IonList className="settings-list settings-section">
          <IonItem button className="settings-item" lines="none">
            <IonIcon slot="start" icon={banOutline} className="settings-icon" />

            <IonLabel>Blocked users</IonLabel>

            <IonIcon
              slot="end"
              icon={arrowForwardOutline}
              className="settings-arrow"
            />
          </IonItem>

          <IonItem button className="settings-item" lines="none">
            <IonIcon
              slot="start"
              icon={lockClosedOutline}
              className="settings-icon"
            />

            <IonLabel>Account privacy</IonLabel>

            <IonIcon
              slot="end"
              icon={arrowForwardOutline}
              className="settings-arrow"
            />
          </IonItem>
        </IonList>
        {/* SOCIAL */}
        <IonList className="settings-list settings-section">
          <IonItem button className="settings-item" lines="none">
            <div slot="start" className="social-icon instagram">
              ◎
            </div>

            <IonLabel>Follow on Instagram</IonLabel>

            <IonIcon
              slot="end"
              icon={arrowForwardOutline}
              className="settings-arrow"
            />
          </IonItem>

          <IonItem button className="settings-item" lines="none">
            <div slot="start" className="social-icon tiktok">
              ♪
            </div>

            <IonLabel>Follow on TikTok</IonLabel>

            <IonIcon
              slot="end"
              icon={arrowForwardOutline}
              className="settings-arrow"
            />
          </IonItem>
        </IonList>

        {/* INFORMATION */}
        <IonList className="settings-list settings-section">
          <IonItem button className="settings-item" lines="none">
            <IonIcon
              slot="start"
              icon={mailOutline}
              className="settings-icon"
            />

            <IonLabel>Contact us</IonLabel>

            <IonIcon
              slot="end"
              icon={arrowForwardOutline}
              className="settings-arrow"
            />
          </IonItem>

          <IonItem button className="settings-item" lines="none">
            <IonIcon
              slot="start"
              icon={documentTextOutline}
              className="settings-icon"
            />

            <IonLabel>Terms & Conditions</IonLabel>

            <IonIcon
              slot="end"
              icon={arrowForwardOutline}
              className="settings-arrow"
            />
          </IonItem>

          <IonItem button className="settings-item" lines="none">
            <IonIcon
              slot="start"
              icon={shieldCheckmarkOutline}
              className="settings-icon"
            />

            <IonLabel>Privacy policy</IonLabel>

            <IonIcon
              slot="end"
              icon={arrowForwardOutline}
              className="settings-arrow"
            />
          </IonItem>
        </IonList>

        {/* DANGER */}
        <IonList className="settings-list settings-section danger-section">
          <IonItem
            button
            className="settings-item danger-item"
            lines="none"
            onClick={() => setShowDeleteAlert(true)}
          >
            <IonLabel>Delete account</IonLabel>

            <IonIcon
              slot="end"
              icon={arrowForwardOutline}
              className="settings-arrow"
            />
          </IonItem>

          <IonItem
            button
            className="settings-item logout-item"
            lines="none"
            onClick={() => setShowLogoutAlert(true)}
          >
            <IonLabel>Log out</IonLabel>
          </IonItem>
        </IonList>

        <IonAlert
          isOpen={showLogoutAlert}
          onDidDismiss={() => setShowLogoutAlert(false)}
          header="Log out"
          message={`Log out of ${user?.username ?? "your account"}?`}
          buttons={[
            { text: "Cancel", role: "cancel" },
            { text: "Log out", role: "destructive", handler: handleLogout },
          ]}
        />

        <IonAlert
          isOpen={showDeleteAlert}
          onDidDismiss={() => setShowDeleteAlert(false)}
          header="Delete account"
          message="This permanently deletes your account and all your data. This cannot be undone."
          buttons={[
            { text: "Cancel", role: "cancel" },
            {
              text: "Delete",
              role: "destructive",
              handler: handleDeleteAccount,
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
