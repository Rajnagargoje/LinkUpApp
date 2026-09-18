import React, { useMemo, useRef, useState } from "react";
import {
  IonPage,
  IonContent,
  IonIcon,
  IonAvatar,
  IonRow,
  IonSpinner,
} from "@ionic/react";

import {
  createOutline,
  airplane,
  eyeOffOutline,
  personCircleOutline,
  cameraOutline,
  chatbubbleEllipsesOutline,
} from "ionicons/icons";

import toast from "react-hot-toast";
import { useHistory } from "react-router";
import "./Me.scss";
import Header from "../../header/Header";
import { useAuth } from "../../contexts/AuthContext";
import { Gender, LookingFor } from "../../common/user.model";
import { uploadPhoto } from "../../service/userService";

type Tab = "about" | "posts" | "connections";

const GENDER_LABELS: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  NON_BINARY: "Non-binary",
  PREFER_NOT_TO_SAY: "Prefers not to say",
};

const LOOKING_FOR_LABELS: Record<LookingFor, string> = {
  FRIENDS: "Friends",
  DATING: "Dating",
  NETWORKING: "Networking",
  NOT_SURE: "Not sure yet",
};

// Skipped for now, left exactly as static placeholder content per
// request — not wired to real data.
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
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("about");

  // Skipped for now per request — kept as local-only toggles, not
  // persisted to the backend.
  const [travelMode, setTravelMode] = useState(false);
  const [incognitoMode, setIncognitoMode] = useState(false);

  const [activeSlide, setActiveSlide] = useState(0);

  // Optimistic local preview shown the instant a file is picked, while
  // the real upload + refreshUser() round trip is in flight.
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const handlePhotoClick = () => fileInputRef.current?.click();

  const handlePhotoChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalPreview(URL.createObjectURL(file));
    setPhotoUploading(true);

    try {
      await uploadPhoto(file);
      // Pulls the freshly-uploaded photo URL back from the server so
      // the avatar (and anywhere else user.profilePhoto is used)
      // reflects what's actually persisted, not just the local blob.
      await refreshUser();
      toast.success("Profile photo updated");
    } catch (error) {
      console.error("Photo upload failed:", error);
      toast.error("Couldn't upload that photo. Please try again.");
    } finally {
      setPhotoUploading(false);
      setLocalPreview(null);
      // Allow picking the same file again later.
      if (event.target) event.target.value = "";
    }
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

  const displayName = user?.username || user?.username || "Your profile";
  const avatarSrc = localPreview || user?.profilePhoto || undefined;

  const genderLabel = user?.gender ? GENDER_LABELS[user.gender] : null;
  const lookingForLabel = user?.lookingFor
    ? LOOKING_FOR_LABELS[user.lookingFor]
    : null;

  // Real completion %, based on which profile fields are actually
  // filled in — replaces the old hardcoded "80%" badge.
  const profileCompletion = useMemo(() => {
    if (!user) return 0;

    const checks = [
      !!user.profilePhoto,
      (user.photos?.length ?? 0) >= 2,
      !!user.bio,
      !!user.gender,
      !!user.lookingFor,
      (user.interests?.length ?? 0) > 0,
      user.age != null,
    ];

    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }, [user]);

  return (
    <IonPage>
      <Header />

      <IonContent className="profile-page">
        {/* Profile Section */}
        <section className="profile-section">
          <IonAvatar className="profile-image-wrapper">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="profile-image"
              />
            ) : (
              <IonIcon
                icon={personCircleOutline}
                className="profile-image-placeholder"
              />
            )}

            {photoUploading && (
              <div className="profile-photo-uploading">
                <IonSpinner name="crescent" />
              </div>
            )}

            <button
              className="profile-photo-edit"
              onClick={handlePhotoClick}
              aria-label="Change profile photo"
              disabled={photoUploading}
            >
              <IonIcon icon={cameraOutline} />
            </button>

            <div className="profile-complete">{profileCompletion}%</div>
          </IonAvatar>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="profile-photo-input"
            onChange={handlePhotoChange}
          />

          <IonRow className="profile-name-row">
            <h1>
              {displayName}
              {user?.age != null ? `, ${user.age}` : ""}
            </h1>
            {user?.emailVerified && <span className="verified">✓</span>}
          </IonRow>

          <button className="edit-profile" onClick={handleEditProfile}>
            Edit Profile
            <IonIcon icon={createOutline} />
          </button>
        </section>

        {/* Premium — skipped for now, left static */}
        {/* <section
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
        </section> */}

        {/* <div className="premium-dots">
          {PREMIUM_SLIDES.map((_, index) => (
            <button
              key={index}
              className={index === activeSlide ? "active" : ""}
              onClick={() => scrollToSlide(index)}
              aria-label={`Show premium slide ${index + 1}`}
            />
          ))}
        </div> */}

        {/* Modes — skipped for now, local-only toggles */}
        {/* <div className="mode-container">
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
        </div> */}

        {/* Tabs */}
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
            Connections
          </button>
        </div>

        {/* ABOUT — entirely real user data now */}
        {activeTab === "about" && (
          <div className="profile-content">
            {user?.bio && (
              <section className="info-section">
                <h3>Bio</h3>
                <p className="bio">{user.bio}</p>
              </section>
            )}

            {(genderLabel || lookingForLabel) && (
              <section className="info-section">
                <h3>Essentials</h3>
                <div className="chips">
                  {genderLabel && <span className="chip">{genderLabel}</span>}
                  {lookingForLabel && (
                    <span className="chip">Looking for {lookingForLabel}</span>
                  )}
                </div>
              </section>
            )}

            {!!user?.interests?.length && (
              <section className="info-section">
                <h3>Interests</h3>
                <div className="chips">
                  {user.interests.map((interest) => (
                    <span className="chip" key={interest}>
                      {interest}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {!user?.bio &&
              !genderLabel &&
              !lookingForLabel &&
              !user?.interests?.length && (
                <div className="empty-state">
                  <h3>Your profile is looking a little empty</h3>
                  <p>
                    Add a bio, interests and preferences to help people know
                    you.
                  </p>
                </div>
              )}
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

        {/* CONNECTIONS — no connections/friends API wired up yet, so
            this is an honest empty state rather than fake rows. Point
            this at a real GET /friends (or similar) endpoint once one
            exists, the same way About now reads from `user`. */}
        {activeTab === "connections" && (
          <div className="profile-content">
            <div className="empty-state">
              <IonIcon
                icon={chatbubbleEllipsesOutline}
                className="empty-state-icon"
              />
              <h3>No connections yet</h3>
              <p>People you connect with will show up here.</p>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
