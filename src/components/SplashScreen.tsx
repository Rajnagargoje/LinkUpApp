import { IonContent, IonIcon, IonPage, IonSpinner } from "@ionic/react";
import { chatbubbles } from "ionicons/icons";
import React from "react";
import "./SplashScreen.scss";

/**
 * Shown for the brief moment while AuthContext validates whatever
 * session is in storage. Keeps the very first paint from flashing the
 * login page (for a still-valid session) or the home feed (for a dead
 * one) before we actually know which is correct.
 *
 * Deliberately mirrors the native splash screen's layout (dark
 * background, centered gradient glyph badge, wordmark + tagline below)
 * so the handoff from native splash -> this screen -> the app itself
 * doesn't have a visible seam.
 */
const SplashScreen: React.FC = () => {
  return (
    <IonPage>
      <IonContent fullscreen className="splash-content">
        <div className="splash-wrap">
          <div className="splash-badge">
            <IonIcon icon={chatbubbles} />
          </div>
          <div className="splash-wordmark">LinkUp</div>
          <p className="splash-tagline">Connect. Chat. Belong.</p>
          <IonSpinner name="crescent" className="splash-spinner" />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SplashScreen;
