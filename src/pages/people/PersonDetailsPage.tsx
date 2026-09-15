import React, { ReactNode, useState } from "react";
import { IonContent, IonIcon, IonPage } from "@ionic/react";
import {
  chevronBackOutline,
  ellipsisHorizontal,
  locationOutline,
  checkmarkCircle,
  closeOutline,
  personAddOutline,
  checkmarkOutline,
  chatbubbleEllipsesOutline,
  shareSocialOutline,
  personCircleOutline,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router";

import "./PersonDetailPage.scss";
interface Person {
  distanceKm: ReactNode;
  lookingFor: ReactNode;
  bio: ReactNode;
  essentials: any;
  basics: any;
  interests: any;
  id: string;
  name: string;
  age: number;
  meta: string;
  online: boolean;
  verified?: boolean;
  accent: "primary" | "secondary" | "success" | "warning";
}
type Tab = "about" | "posts" | "connections";

// Stand-ins for multiple profile photos — swap for the person's real photo
// URLs once your API returns them. Kept as flat accent colors, same
// reasoning as the grid: no real photos used here.
const PHOTO_SLOTS = ["primary", "secondary", "success", "warning"] as const;

const PersonDetailPage: React.FC = () => {
  const history = useHistory();
  const location = useLocation<{ person?: Person }>();
  const person = location.state?.person;

  const [activePhoto, setActivePhoto] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("about");
  const [connectState, setConnectState] = useState<"idle" | "requested">(
    "idle",
  );

  if (!person) {
    // Guards against a direct/refreshed URL with no state — send them back
    // to the grid instead of rendering an empty detail page.
    // history.replace("/app/people");
    return null;
  }

  const handlePhotoTap = (event: React.MouseEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const tappedRight = event.clientX - left > width / 2;

    setActivePhoto((prev) => {
      if (tappedRight) return Math.min(prev + 1, PHOTO_SLOTS.length - 1);
      return Math.max(prev - 1, 0);
    });
  };

  const handleConnect = () => {
    setConnectState((prev) => (prev === "idle" ? "requested" : "idle"));
  };

  const handleMessage = () => {
    history.push("/app/chatPage", {
      username: person.name,
      roomId: `dm-${person.id}`,
    });
  };

  const handleShare = async () => {
    const shareData = {
      title: `${person.name} on LinkUp`,
      text: `Check out ${person.name}'s profile on LinkUp`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the native share sheet — nothing to do
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareData.url);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={true} className="person-detail-content">
        {/* PHOTO HERO — tap left/right halves to move through photo slots */}
        <div
          className={`person-hero person-hero--${PHOTO_SLOTS[activePhoto]}`}
          onClick={handlePhotoTap}
        >
          <div className="person-hero-segments">
            {PHOTO_SLOTS.map((_, index) => (
              <span
                key={index}
                className={`segment ${index <= activePhoto ? "segment--filled" : ""}`}
              />
            ))}
          </div>

          <div className="person-hero-topbar">
            <button
              className="hero-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                history.goBack();
              }}
              aria-label="Back"
            >
              <IonIcon icon={chevronBackOutline} />
            </button>
            <button
              className="hero-icon-btn"
              aria-label="More options"
              onClick={(e) => e.stopPropagation()}
            >
              <IonIcon icon={ellipsisHorizontal} />
            </button>
          </div>

          <div className="person-hero-avatar">
            <IonIcon icon={personCircleOutline} />
          </div>

          <div className="person-hero-scrim" />

          <div className="person-hero-info">
            <span className="nearby-badge">Nearby</span>
            <span className="distance-row">
              <IonIcon icon={locationOutline} />
              {person.distanceKm} km away
            </span>
            <div className="person-name-row">
              <h1>
                {person.name}, {person.age}
              </h1>
              {person.verified && (
                <IonIcon icon={checkmarkCircle} className="person-verified" />
              )}
            </div>
            <span className="looking-for-chip">
              Looking for {person.lookingFor}
            </span>
          </div>
        </div>

        {/* TABS */}
        <div className="person-tabs">
          <button
            className={`tab ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            About
          </button>
          <button
            className={`tab ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            Posts
          </button>
          <button
            className={`tab ${activeTab === "connections" ? "active" : ""}`}
            onClick={() => setActiveTab("connections")}
          >
            Connections 300+
          </button>
        </div>

        {activeTab === "about" && (
          <div className="person-content">
            <section className="info-section">
              <h3>Bio</h3>
              <p className="bio">{person.bio}</p>
            </section>

            <section className="info-section">
              <h3>Essentials</h3>
              <div className="chips">
                {person.essentials.map((item: any) => (
                  <span className="chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <section className="info-section">
              <h3>Basics</h3>
              <div className="chips">
                {person.basics.map((item: any) => (
                  <span className="chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <section className="info-section">
              <h3>Interests</h3>
              <div className="chips">
                {person.interests.map((item: any) => (
                  <span className="chip" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <button className="share-profile-btn" onClick={handleShare}>
              <IonIcon icon={shareSocialOutline} />
              Share Profile
            </button>
          </div>
        )}

        {activeTab === "posts" && (
          <div className="person-content">
            <div className="empty-state">
              <h3>No posts yet</h3>
              <p>{person.name} hasn't shared anything yet.</p>
            </div>
          </div>
        )}

        {activeTab === "connections" && (
          <div className="person-content">
            <div className="empty-state">
              <h3>300+ connections</h3>
              <p>Mutual connections will show up here.</p>
            </div>
          </div>
        )}

        {/* spacer so content isn't hidden behind the fixed action bar */}
        <div className="action-bar-spacer" />
      </IonContent>

      {/* ACTION BAR — Pass / Connect / Message */}
      <div className="person-action-bar">
        <button className="action-btn action-btn--pass" aria-label="Pass">
          <IonIcon icon={closeOutline} />
        </button>

        <button
          className={`action-btn action-btn--connect ${
            connectState === "requested" ? "action-btn--connect-active" : ""
          }`}
          onClick={handleConnect}
        >
          <IonIcon
            icon={
              connectState === "requested" ? checkmarkOutline : personAddOutline
            }
          />
          {connectState === "requested" ? "Requested" : "Connect"}
        </button>

        <button
          className="action-btn action-btn--message"
          onClick={handleMessage}
          aria-label="Message"
        >
          <IonIcon icon={chatbubbleEllipsesOutline} />
        </button>
      </div>
    </IonPage>
  );
};

export default PersonDetailPage;
