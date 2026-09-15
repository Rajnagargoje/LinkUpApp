import React, { useMemo, useRef, useState } from "react";
import {
  IonContent,
  IonDatetime,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import {
  chevronBackOutline,
  checkmarkCircle,
  locationOutline,
  cameraOutline,
  notificationsOutline,
  checkmark,
  closeOutline,
  addOutline,
} from "ionicons/icons";
import { useHistory } from "react-router";
import toast from "react-hot-toast";
import "./OnboardingPage.scss";
import { useAuth } from "../../contexts/AuthContext";
import * as userService from "../../service/userService";
import { MAX_PHOTOS, MAX_PHOTO_SIZE_MB } from "../../config/api.config";

/* =========================================================
   DATA
========================================================= */

interface OnboardingData {
  dob: string; // ISO date string from IonDatetime
  gender: string; // display label, mapped to backend enum on submit
  lookingFor: string; // single choice now — matches backend's LookingFor enum
  interests: string[];
  bio: string;
}

type PermissionStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

interface PermissionsState {
  location: PermissionStatus;
  camera: PermissionStatus;
  notifications: PermissionStatus;
}

interface Coords {
  latitude: number;
  longitude: number;
}

const GENDER_OPTIONS = ["Man", "Woman", "Non-binary", "Prefer not to say"];

// Backend's Gender enum only has these four values — keep this mapping
// in sync with com.linkup.user.utils.Gender if the options above change.
const GENDER_TO_ENUM: Record<string, string> = {
  Man: "MALE",
  Woman: "FEMALE",
  "Non-binary": "NON_BINARY",
  "Prefer not to say": "PREFER_NOT_TO_SAY",
};

const LOOKING_FOR_OPTIONS = [
  { id: "friends", label: "New Friends", emoji: "🤝" },
  { id: "dating", label: "Dating", emoji: "💜" },
  { id: "networking", label: "Networking", emoji: "💼" },
  { id: "unsure", label: "Not Sure Yet", emoji: "🤔" },
];

// Backend's LookingFor is a SINGLE value, not a list — this step is
// single-select (tap one, tapping another swaps the selection), unlike
// interests below which is genuinely multi-select.
const LOOKING_FOR_TO_ENUM: Record<string, string> = {
  friends: "FRIENDS",
  dating: "DATING",
  networking: "NETWORKING",
  unsure: "NOT_SURE",
};

const INTEREST_OPTIONS = [
  { id: "coffee", label: "Coffee", emoji: "☕" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "movies", label: "Movies", emoji: "🎬" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "fitness", label: "Fitness", emoji: "🏋️" },
  { id: "cooking", label: "Cooking", emoji: "🍳" },
  { id: "art", label: "Art", emoji: "🎨" },
  { id: "reading", label: "Reading", emoji: "📚" },
  { id: "photography", label: "Photography", emoji: "📷" },
  { id: "dancing", label: "Dancing", emoji: "💃" },
  { id: "sports", label: "Sports", emoji: "⚽" },
  { id: "pets", label: "Pets", emoji: "🐾" },
  { id: "comedy", label: "Comedy", emoji: "😂" },
  { id: "nature", label: "Nature", emoji: "🌿" },
  { id: "tech", label: "Tech", emoji: "💻" },
];

// dob, gender, lookingFor, interests, bio, photos, permissions, finish
const TOTAL_STEPS = 8;
const BIO_MAX_LENGTH = 150;

const OnboardingPage: React.FC = () => {
  const history = useHistory();
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState(0);

  const [data, setData] = useState<OnboardingData>({
    dob: "",
    gender: "",
    lookingFor: "",
    interests: [],
    bio: "",
  });

  const [permissions, setPermissions] = useState<PermissionsState>({
    location: "idle",
    camera: "idle",
    notifications: "idle",
  });
  const [coords, setCoords] = useState<Coords | null>(null);

  // Source of truth for photos is the server — each upload/delete call
  // returns the updated profile, so this always mirrors what's actually
  // saved rather than tracking a separate "pending" local list.
  const [photos, setPhotos] = useState<string[]>(user?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInterest = (id: string) => {
    setData((prev) => {
      const current = prev.interests;
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      return { ...prev, interests: next };
    });
  };

  /* =========================================================
     PHOTOS — real uploads, not decorative
  ========================================================= */

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be ${MAX_PHOTO_SIZE_MB}MB or smaller`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const res = await userService.uploadPhoto(file, setUploadProgress);
      setPhotos(res.data.data.photos);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Couldn't upload that photo");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemovePhoto = async (url: string) => {
    const previous = photos;
    setPhotos((p) => p.filter((u) => u !== url)); // optimistic
    try {
      const res = await userService.deletePhoto(url);
      setPhotos(res.data.data.photos);
    } catch {
      setPhotos(previous); // roll back on failure
      toast.error("Couldn't remove that photo");
    }
  };

  /* =========================================================
     PERMISSIONS — real browser API calls, not decorative
  ========================================================= */

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setPermissions((p) => ({ ...p, location: "unsupported" }));
      return;
    }
    setPermissions((p) => ({ ...p, location: "requesting" }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setPermissions((p) => ({ ...p, location: "granted" }));
      },
      () => setPermissions((p) => ({ ...p, location: "denied" }))
    );
  };

  const requestCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissions((p) => ({ ...p, camera: "unsupported" }));
      return;
    }
    setPermissions((p) => ({ ...p, camera: "requesting" }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Only checking permission here — immediately release the camera.
      stream.getTracks().forEach((track) => track.stop());
      setPermissions((p) => ({ ...p, camera: "granted" }));
    } catch {
      setPermissions((p) => ({ ...p, camera: "denied" }));
    }
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      setPermissions((p) => ({ ...p, notifications: "unsupported" }));
      return;
    }
    setPermissions((p) => ({ ...p, notifications: "requesting" }));
    const result = await Notification.requestPermission();
    setPermissions((p) => ({
      ...p,
      notifications: result === "granted" ? "granted" : "denied",
    }));
  };

  /* =========================================================
     VALIDATION per step
  ========================================================= */

  const isAdult = (isoDate: string) => {
    if (!isoDate) return false;
    const dob = new Date(isoDate);
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    return dob <= eighteenYearsAgo;
  };

  const isStepValid = useMemo(() => {
    switch (step) {
      case 0: return isAdult(data.dob);
      case 1: return Boolean(data.gender);
      case 2: return Boolean(data.lookingFor);
      case 3: return data.interests.length >= 3;
      case 4: return true; // bio is optional
      case 5: return true; // photos are optional
      case 6: return true; // permissions are optional
      default: return true;
    }
  }, [step, data]);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const finishOnboarding = async () => {
    setSubmitting(true);
    try {
      await userService.updateProfile({
        dob: data.dob.slice(0, 10), // IonDatetime returns a full ISO timestamp; backend's LocalDate wants just yyyy-MM-dd
        gender: GENDER_TO_ENUM[data.gender],
        lookingFor: LOOKING_FOR_TO_ENUM[data.lookingFor],
        bio: data.bio || undefined,
        // Send labels, not raw ids — nicer to display anywhere this list
        // shows up later (e.g. "Coffee" instead of "coffee").
        interests: data.interests.map(
          (id) => INTEREST_OPTIONS.find((i) => i.id === id)?.label ?? id
        ),
        // photos/profilePhoto are already saved server-side by each
        // upload in the Photos step — NOT re-sent here, since PATCH /me
        // would overwrite the list with whatever's sent (or clear it,
        // if omitted incorrectly some other way).
      });

      if (coords && user?.username) {
        try {
          await userService.updateLocation(user.username, coords.latitude, coords.longitude);
        } catch {
          // Non-critical — they can enable location again later in Settings.
          toast.error("Couldn't save your location, but your profile is saved.");
        }
      }

      await refreshUser(); // picks up onboardingCompleted: true so ProtectedRoute lets them through
      toast.success("You're all set!");
      history.replace("/app/home");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Couldn't save your profile. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const showSkip = step === 3 || step === 4 || step === 5 || step === 6; // interests, bio, photos, permissions

  /* =========================================================
     STEP CONTENT
  ========================================================= */

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepShell
            heading="When's your birthday?"
            subtitle="You must be 18 or older to use LinkUp"
          >
            <IonDatetime
              presentation="date"
              className="onboarding-datetime"
              value={data.dob || undefined}
              max={new Date().toISOString()}
              onIonChange={(e) => {
                const val = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value;
                update("dob", val ?? "");
              }}
            />
            {data.dob && !isAdult(data.dob) && (
              <p className="onboarding-error">You must be 18+ to continue.</p>
            )}
          </StepShell>
        );

      case 1:
        return (
          <StepShell
            heading="How do you identify?"
            subtitle="This helps us personalize your experience"
          >
            <div className="onboarding-option-list">
              {GENDER_OPTIONS.map((option) => (
                <button
                  key={option}
                  className={`onboarding-option-row ${
                    data.gender === option ? "onboarding-option-row--selected" : ""
                  }`}
                  onClick={() => update("gender", option)}
                >
                  <span>{option}</span>
                  {data.gender === option && (
                    <IonIcon icon={checkmarkCircle} />
                  )}
                </button>
              ))}
            </div>
          </StepShell>
        );

      case 2:
        return (
          <StepShell
            heading="What are you looking for?"
            subtitle="Pick the one that fits best"
          >
            <div className="onboarding-chip-grid">
              {LOOKING_FOR_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`onboarding-big-chip ${
                    data.lookingFor === option.id ? "onboarding-big-chip--selected" : ""
                  }`}
                  onClick={() => update("lookingFor", option.id)}
                >
                  <span className="onboarding-big-chip-emoji">{option.emoji}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </StepShell>
        );

      case 3:
        return (
          <StepShell
            heading="What are you into?"
            subtitle={`Pick a few — the more the better (${data.interests.length} selected)`}
          >
            <div className="onboarding-interest-wrap">
              {INTEREST_OPTIONS.map((interest) => (
                <button
                  key={interest.id}
                  className={`onboarding-interest-chip ${
                    data.interests.includes(interest.id)
                      ? "onboarding-interest-chip--selected"
                      : ""
                  }`}
                  onClick={() => toggleInterest(interest.id)}
                >
                  {interest.emoji} {interest.label}
                </button>
              ))}
            </div>
          </StepShell>
        );

      case 4:
        return (
          <StepShell
            heading="Tell people about you"
            subtitle="A good bio gets more replies"
          >
            <IonTextarea
              className="onboarding-textarea"
              placeholder="Coffee enthusiast, weekend hiker, always up for a good conversation..."
              autoGrow
              maxlength={BIO_MAX_LENGTH}
              value={data.bio}
              onIonInput={(e) => update("bio", e.detail.value ?? "")}
            />
            <span className="onboarding-char-count">
              {data.bio.length}/{BIO_MAX_LENGTH}
            </span>
          </StepShell>
        );

      case 5:
        return (
          <StepShell
            heading="Add a few photos"
            subtitle={`${photos.length}/${MAX_PHOTOS} added — your first photo is your profile picture`}
          >
            <div className="onboarding-photo-grid">
              {photos.map((url, idx) => (
                <div className="onboarding-photo-tile" key={url}>
                  <img src={url} alt="" />
                  {idx === 0 && (
                    <span className="onboarding-photo-primary-badge">Profile</span>
                  )}
                  <button
                    className="onboarding-photo-remove"
                    onClick={() => handleRemovePhoto(url)}
                    aria-label="Remove photo"
                  >
                    <IonIcon icon={closeOutline} />
                  </button>
                </div>
              ))}

              {photos.length < MAX_PHOTOS && (
                <button
                  className="onboarding-photo-add"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <IonSpinner name="crescent" />
                      <span>{uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <IonIcon icon={addOutline} />
                      <span>Add</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handleFileSelected}
            />
          </StepShell>
        );

      case 6:
        return (
          <StepShell
            heading="Enable a few permissions"
            subtitle="You can always change these later in Settings"
          >
            <div className="permission-card-list">
              <PermissionCard
                icon={locationOutline}
                title="Location"
                description="See people and rooms nearby"
                status={permissions.location}
                onAllow={requestLocation}
              />
              <PermissionCard
                icon={cameraOutline}
                title="Camera"
                description="Add profile photos and use video chat"
                status={permissions.camera}
                onAllow={requestCamera}
              />
              <PermissionCard
                icon={notificationsOutline}
                title="Notifications"
                description="Never miss a new message"
                status={permissions.notifications}
                onAllow={requestNotifications}
              />
            </div>
          </StepShell>
        );

      case 7:
        return (
          <div className="onboarding-finish">
            <div className="onboarding-finish-check">
              <IonIcon icon={checkmark} />
            </div>
            <h1>You're all set{user?.username ? `, ${user.username}` : ""}!</h1>
            <p>Welcome to LinkUp — time to make some connections.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen scrollY={step !== 7} className="onboarding-content">
        <div className="onboarding-topbar">
          <button
            className={`onboarding-back-btn ${step === 0 ? "onboarding-back-btn--hidden" : ""}`}
            onClick={goBack}
            aria-label="Back"
          >
            <IonIcon icon={chevronBackOutline} />
          </button>

          {step < TOTAL_STEPS - 1 && (
            <div className="onboarding-segments">
              {Array.from({ length: TOTAL_STEPS - 1 }).map((_, index) => (
                <span
                  key={index}
                  className={`onboarding-segment ${index <= step ? "onboarding-segment--filled" : ""}`}
                />
              ))}
            </div>
          )}

          {showSkip ? (
            <button className="onboarding-skip-btn" onClick={goNext}>
              Skip
            </button>
          ) : (
            <span className="onboarding-topbar-spacer" />
          )}
        </div>

        <div className="onboarding-body" key={step}>
          {renderStep()}
        </div>
      </IonContent>

      <div className="onboarding-footer">
        {step < TOTAL_STEPS - 1 ? (
          <button
            className="onboarding-continue-btn"
            disabled={!isStepValid}
            onClick={goNext}
          >
            Continue
          </button>
        ) : (
          <button
            className="onboarding-continue-btn"
            disabled={submitting}
            onClick={finishOnboarding}
          >
            {submitting ? <IonSpinner name="dots" /> : "Enter LinkUp"}
          </button>
        )}
      </div>
    </IonPage>
  );
};

/* =========================================================
   SHARED STEP SHELL
========================================================= */

const StepShell: React.FC<{
  heading: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ heading, subtitle, children }) => (
  <div className="step-shell">
    <h1 className="step-heading">{heading}</h1>
    <p className="step-subtitle">{subtitle}</p>
    <div className="step-fields">{children}</div>
  </div>
);

/* =========================================================
   PERMISSION CARD
========================================================= */

const PermissionCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  status: PermissionStatus;
  onAllow: () => void;
}> = ({ icon, title, description, status, onAllow }) => (
  <div className="permission-card">
    <div className="permission-card-icon">
      <IonIcon icon={icon} />
    </div>
    <div className="permission-card-text">
      <span className="permission-card-title">{title}</span>
      <span className="permission-card-desc">{description}</span>
    </div>

    {status === "granted" ? (
      <span className="permission-status permission-status--granted">
        <IonIcon icon={checkmark} /> Allowed
      </span>
    ) : status === "denied" ? (
      <span className="permission-status permission-status--denied">
        <IonIcon icon={closeOutline} /> Denied
      </span>
    ) : status === "unsupported" ? (
      <span className="permission-status">Unavailable</span>
    ) : (
      <button
        className="permission-allow-btn"
        onClick={onAllow}
        disabled={status === "requesting"}
      >
        {status === "requesting" ? "Requesting…" : "Allow"}
      </button>
    )}
  </div>
);

export default OnboardingPage;
