import { IonContent, IonPage, IonSpinner } from "@ionic/react";
import React from "react";
import "./SplashScreen.scss";

/**
 * Shown for the brief moment while AuthContext validates whatever
 * session is in storage. Keeps the very first paint from flashing the
 * login page (for a still-valid session) or the home feed (for a dead
 * one) before we actually know which is correct.
 */
const SplashScreen: React.FC = () => {
  return (
    <IonPage>
      <IonContent fullscreen className="splash-content">
        <div className="splash-wrap">
          <div className="splash-logo">LinkUp</div>
          <IonSpinner name="crescent" className="splash-spinner" />
          <p className="splash-caption">Checking your session…</p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SplashScreen;
