import React, { useRef, useState } from "react";
import { IonPage, IonContent, IonIcon, IonAvatar, IonRow } from "@ionic/react";

import {
  settingsOutline,
  createOutline,
  airplane,
  eyeOffOutline,
  personCircleOutline,
  cameraOutline,
  chatbubbleEllipsesOutline,
} from "ionicons/icons";

import { useHistory } from "react-router";
import "./Me.scss";
import Header from "../../header/Header";
import { useAuth } from "../../contexts/AuthContext";

type Tab = "about" | "posts" | "connections";

interface Connection {
  id: string;
  name: string;
}

const INTEREST_OPTIONS = [
  { id: "bollywood", label: "Bollywood", emoji: "📺" },
  { id: "cinema", label: "Cinema", emoji: "🍿" },
  { id: "comedy", label: "Comedy", emoji: "😂" },
  { id: "drama", label: "Drama", emoji: "🎭" },
  { id: "eating-out", label: "Eating out", emoji: "🍽️" },
  { id: "running", label: "Running", emoji: "🏃" },
  { id: "sci-fi", label: "Sci-fi", emoji: "🚀" },
  { id: "gym", label: "Gym", emoji: "🏋️" },
];

const CONNECTIONS: Connection[] = [
  { id: "c1", name: "Sharon" },
  { id: "c2", name: "Vishy" },
];

const PREMIUM_SLIDES = [
  {
    heading: "What's included",
    items: [
      "See who viewed",
      "Unlimited invites",
      "Rewind profiles",
      "See active members first",
    ],
  },
  {
    heading: "Go further",
    items: [
      "Priority in discovery",
      "Advanced filters",
      "Read receipts",
      "Undo last skip",
    ],
  },
  {
    heading: "Why people upgrade",
    items: [
      "3x more replies on average",
      "Match with active users first",
      "No ads, ever",
    ],
  },
];

const ProfilePage: React.FC = () => {
  const history = useHistory();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("about");
  const [travelMode, setTravelMode] = useState(false);
  const [incognitoMode, setIncognitoMode] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    "bollywood",
    "comedy",
    "gym",
  ]);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setProfileImage(url);
  };

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const scrollToSlide = (index: number) => {
    const track = carouselRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
    setActiveSlide(index);
  };

  const handleCarouselScroll = () => {
    const track = carouselRef.current;
    if (!track) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    if (index !== activeSlide) setActiveSlide(index);
  };

  const handleEditProfile = () => {
    // Point this at your real edit-profile route once it's registered
    // (you already have a MyProfile page under pages/menu/pages).
    history.push("/app/menu/my-profile");
  };

  const handleSettings = () => {
    // Point this at your real settings/menu route once it's registered.
    history.push("/app/menu");
  };

  return (
    <IonPage>
      <Header />

      <IonContent className="profile-page">
        {/* Profile Section */}
        <section className="profile-section">
          <IonAvatar className="profile-image-wrapper">
            {profileImage ? (
              <img
                src={profileImage}
                alt="Your profile"
                className="profile-image"
              />
            ) : (
              <IonIcon
                icon={personCircleOutline}
                className="profile-image-placeholder"
              />
            )}

            <button
              className="profile-photo-edit"
              onClick={handlePhotoClick}
              aria-label="Change profile photo"
            >
              <IonIcon icon={cameraOutline} />
            </button>

            <div className="profile-complete">80%</div>
          </IonAvatar>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="profile-photo-input"
            onChange={handlePhotoChange}
          />

          <IonRow className="profile-name-row">
            <h1>{user?.username ?? "Your profile"}</h1>
            <span className="verified">✓</span>
          </IonRow>

          <button className="edit-profile" onClick={handleEditProfile}>
            Edit Profile
            <IonIcon icon={createOutline} />
          </button>
        </section>

        {/* Premium — swipeable carousel, dots are real pagination now */}
        <section
          className="premium-card"
          ref={carouselRef}
          onScroll={handleCarouselScroll}
        >
          {PREMIUM_SLIDES.map((slide, index) => (
            <div className="premium-slide" key={index}>
              <h2>Premium</h2>
              <p className="premium-subtitle">
                More connection. More possibilities.
              </p>
              <h3>{slide.heading}</h3>

              {slide.items.map((item) => (
                <div className="premium-item" key={item}>
                  <span>{item}</span>
                  <strong>✓</strong>
                </div>
              ))}

              <button className="benefits-btn">See All Benefits</button>
            </div>
          ))}
        </section>

        <div className="premium-dots">
          {PREMIUM_SLIDES.map((_, index) => (
            <button
              key={index}
              className={index === activeSlide ? "active" : ""}
              onClick={() => scrollToSlide(index)}
              aria-label={`Show premium slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Modes — real toggle state */}
        <div className="mode-container">
          <button
            className={`mode-card ${travelMode ? "mode-card--active" : ""}`}
            onClick={() => setTravelMode((v) => !v)}
          >
            <IonIcon icon={airplane} />
            <span>Travel Mode</span>
          </button>

          <button
            className={`mode-card ${incognitoMode ? "mode-card--active" : ""}`}
            onClick={() => setIncognitoMode((v) => !v)}
          >
            <IonIcon icon={eyeOffOutline} />
            <span>Incognito Mode</span>
          </button>
        </div>

        {/* Tabs — actually switch content now */}
        <div className="profile-tabs">
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
            Connections {CONNECTIONS.length}
          </button>
        </div>

        {/* ABOUT */}
        {activeTab === "about" && (
          <div className="profile-content">
            <section className="info-section">
              <h3>Bio</h3>
              <p className="bio">
                Travel | Movies | Night-outs | Good food & spontaneous plans
              </p>
            </section>

            <section className="info-section">
              <h3>Essentials</h3>
              <div className="chips">
                <span className="chip">Indian</span>
                <span className="chip">Software Engineer</span>
              </div>
            </section>

            <section className="info-section">
              <h3>Basics</h3>
              <div className="chips">
                <span className="chip">Single</span>
                <span className="chip">Libra</span>
                <span className="chip">ISTP</span>
              </div>
            </section>

            <section className="info-section">
              <h3>Interests</h3>
              <p className="section-hint">Tap to select what represents you</p>
              <div className="chips">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest.id}
                    className={`chip chip--selectable ${
                      selectedInterests.includes(interest.id)
                        ? "chip--selected"
                        : ""
                    }`}
                    onClick={() => toggleInterest(interest.id)}
                  >
                    {interest.emoji} {interest.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="info-section personality-card">
              <h3>About You</h3>
              <span className="personality-type">Your type is an Explorer</span>
              <p>
                Explorers are curious and hands-on — they'd rather try something
                new than read about it. They stay calm when plans change and
                tend to turn a chaotic day into a good story.
              </p>
            </section>
          </div>
        )}

        {/* POSTS */}
        {activeTab === "posts" && (
          <div className="profile-content">
            <div className="empty-state">
              <IonIcon icon={cameraOutline} className="empty-state-icon" />
              <h3>No posts yet</h3>
              <p>Things you share will show up here.</p>
            </div>
          </div>
        )}

        {/* CONNECTIONS */}
        {activeTab === "connections" && (
          <div className="profile-content">
            <div className="connections-list">
              {CONNECTIONS.map((connection) => (
                <div className="connection-row" key={connection.id}>
                  <div className="connection-avatar">
                    <IonIcon icon={personCircleOutline} />
                  </div>
                  <span className="connection-name">{connection.name}</span>
                  <button
                    className="connection-message-btn"
                    aria-label={`Message ${connection.name}`}
                  >
                    <IonIcon icon={chatbubbleEllipsesOutline} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
