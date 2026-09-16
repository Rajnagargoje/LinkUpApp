import React, { useEffect, useState } from "react";
import { IonContent, IonIcon, IonPage, IonSpinner } from "@ionic/react";

import {
  chevronBackOutline,
  ellipsisHorizontal,
  checkmarkCircle,
  closeOutline,
  personAddOutline,
  checkmarkOutline,
  chatbubbleEllipsesOutline,
  shareSocialOutline,
  personCircleOutline,
} from "ionicons/icons";

import { useHistory, useParams } from "react-router";

import "./PersonDetailPage.scss";

import { Person } from "../../common/person.model";
import { getPersonProfile } from "../../service/peopleService";
import { formatRelativeTime, toTitleCase } from "../../config/date.time.format";

type Tab = "about" | "posts";

const PersonDetailPage: React.FC = () => {
  const history = useHistory();

  const { personId } = useParams<{ personId: string }>();

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activePhoto, setActivePhoto] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("about");

  const [connectState, setConnectState] = useState<"idle" | "requested">(
    "idle",
  );

  useEffect(() => {
    if (!personId) {
      setError("Invalid profile.");
      setLoading(false);
      return;
    }

    const loadPersonProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        const profile = await getPersonProfile(personId);
        setPerson(profile.data);
        setActivePhoto(0);
      } catch (error) {
        console.error("Failed to load person profile:", error);
        setError("Unable to load this profile.");
        setPerson(null);
      } finally {
        setLoading(false);
      }
    };

    loadPersonProfile();
  }, [personId]);

  if (loading) {
    return (
      <IonPage>
        <IonContent className="person-detail-loading">
          <IonSpinner name="crescent" />
          <p>Loading profile...</p>
        </IonContent>
      </IonPage>
    );
  }

  if (error || !person) {
    return (
      <IonPage>
        <IonContent className="person-detail-error">
          <IonIcon icon={personCircleOutline} className="error-profile-icon" />
          <h2>Profile unavailable</h2>
          <p>{error || "This profile could not be found."}</p>
          <button className="error-back-btn" onClick={() => history.goBack()}>
            Go Back
          </button>
        </IonContent>
      </IonPage>
    );
  }

  const displayName = person.name ?? person.username;

  const photos = person.photos ?? [];
  const photoCount = photos.length > 0 ? photos.length : 1;
  const currentPhoto = photos.length > 0 ? photos[activePhoto] : undefined;

  const handlePhotoTap = (event: React.MouseEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const tappedRight = event.clientX - left > width / 2;

    setActivePhoto((prev) => {
      if (tappedRight) return Math.min(prev + 1, photoCount - 1);
      return Math.max(prev - 1, 0);
    });
  };

  const handleConnect = () => {
    setConnectState((prev) => (prev === "idle" ? "requested" : "idle"));
  };

  const handleMessage = () => {
    history.push("/app/chatPage", {
      username: person.username,
      roomId: `dm-${person.id}`,
    });
  };

  const handleShare = async () => {
    const shareData = {
      title: `${displayName} on LinkUp`,
      text: `Check out ${displayName}'s profile on LinkUp`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {}
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareData.url);
      } catch (error) {
        console.error("Failed to copy profile URL:", error);
      }
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={true} className="person-detail-content">
        <div
          className="person-hero"
          onClick={handlePhotoTap}
          style={
            currentPhoto
              ? {
                  backgroundImage: `url(${currentPhoto})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <div className="person-hero-segments">
            {Array.from({ length: photoCount }).map((_, index) => (
              <span
                key={index}
                className={`segment ${
                  index === activePhoto ? "segment--filled" : ""
                }`}
              />
            ))}
          </div>

          <div className="person-hero-topbar">
            <button
              className="hero-icon-btn"
              onClick={(event) => {
                event.stopPropagation();
                history.goBack();
              }}
              aria-label="Back"
            >
              <IonIcon icon={chevronBackOutline} />
            </button>

            <button
              className="hero-icon-btn"
              aria-label="More options"
              onClick={(event) => event.stopPropagation()}
            >
              <IonIcon icon={ellipsisHorizontal} />
            </button>
          </div>

          {!currentPhoto && (
            <div className="person-hero-avatar">
              <IonIcon icon={personCircleOutline} />
            </div>
          )}

          <div className="person-hero-scrim" />

          <div className="person-hero-info">
            <div className="person-name-row">
              <h1>
                {displayName}
                {person.age !== undefined && `, ${person.age}`}
              </h1>
              {person.verified && (
                <IonIcon icon={checkmarkCircle} className="person-verified" />
              )}
            </div>

            <span className="person-username">@{person.username}</span>

            {person.online ? (
              <span className="online-status">Online</span>
            ) : (
              person.lastSeenAt && (
                <span className="online-status online-status--offline">
                  Last seen {formatRelativeTime(person.lastSeenAt)}
                </span>
              )
            )}

            {person.lookingFor && (
              <span className="looking-for-chip">
                Looking for {toTitleCase(person.lookingFor)}
              </span>
            )}
          </div>
        </div>

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
        </div>

        {activeTab === "about" && (
          <div className="person-content">
            {person.bio && (
              <section className="info-section">
                <h3>Bio</h3>
                <p className="bio">{person.bio}</p>
              </section>
            )}

            <section className="info-section">
              <h3>Essentials</h3>
              <div className="chips">
                {person.age !== undefined && (
                  <span className="chip">{person.age} years</span>
                )}
                {person.gender && (
                  <span className="chip">{toTitleCase(person.gender)}</span>
                )}
              </div>
            </section>

            {person.interests && person.interests.length > 0 && (
              <section className="info-section">
                <h3>Interests</h3>
                <div className="chips">
                  {person.interests.map((item) => (
                    <span className="chip" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

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
              <p>{displayName} hasn't shared anything yet.</p>
            </div>
          </div>
        )}

        <div className="action-bar-spacer" />
      </IonContent>

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
