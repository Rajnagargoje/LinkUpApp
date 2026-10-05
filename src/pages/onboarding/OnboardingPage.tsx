import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonContent,
  IonAlert,
  IonHeader,
  IonToolbar,
  IonFooter,
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
  calendarOutline,
  personOutline,
  heartOutline,
  sparklesOutline,
  createOutline,
  imagesOutline,
  shieldCheckmarkOutline,
  chevronForwardOutline,
} from "ionicons/icons";
import { useHistory } from "react-router";
import toast from "react-hot-toast";
import "./OnboardingPage.scss";
import { useAuth } from "../../contexts/AuthContext";
import { Geolocation } from "@capacitor/geolocation";
import * as userService from "../../service/userService";
import { MAX_PHOTOS, MAX_PHOTO_SIZE_MB } from "../../config/api.config";

/* =========================================================
   DATA
========================================================= */

interface OnboardingData {
  dob: string; // yyyy-MM-dd, unchanged backend payload
  gender: string; // display label, mapped to backend enum on submit
  lookingFor: string; // single choice now — matches backend's LookingFor enum
  interests: string[];
  bio: string;
}

type PermissionStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unsupported";

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

// Ask about all permissions before showing the photo capture/upload step.
const STEPS = [
  { label: "Birthday", icon: calendarOutline },
  { label: "Gender", icon: personOutline },
  { label: "Looking for", icon: heartOutline },
  { label: "Interests", icon: sparklesOutline },
  { label: "About you", icon: createOutline },
  { label: "Location", icon: locationOutline },
  { label: "Camera", icon: cameraOutline },
  { label: "Notifications", icon: notificationsOutline },
  { label: "Photos", icon: imagesOutline },
  { label: "Ready", icon: checkmark },
] as const;
const TOTAL_STEPS = STEPS.length;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
type BirthdayParts = { day: string; month: string; year: string };
type PermissionKey = keyof PermissionsState;

function birthdayParts(iso: string): BirthdayParts {
  const [year = "", month = "", day = ""] = iso.slice(0, 10).split("-");
  return { day, month, year };
}

function birthdayISO(parts: BirthdayParts): string {
  if (!parts.day || !parts.month || !parts.year) return "";
  const year = Number(parts.year),
    month = Number(parts.month),
    day = Number(parts.day);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return "";
  return `${parts.year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function birthdayAge(iso: string): number | null {
  const parts = birthdayParts(iso);
  if (!birthdayISO(parts)) return null;
  const today = new Date();
  let age = today.getFullYear() - Number(parts.year);
  if (
    today.getMonth() + 1 < Number(parts.month) ||
    (today.getMonth() + 1 === Number(parts.month) &&
      today.getDate() < Number(parts.day))
  )
    age--;
  return age;
}
const BIO_MAX_LENGTH = 150;

const OnboardingPage: React.FC<{ editMode?: boolean }> = ({
  editMode = false,
}) => {
  const history = useHistory();
  const { user, refreshUser } = useAuth();

  const [step, setStep] = useState(0);

  const [data, setData] = useState<OnboardingData>(() => ({
    dob: editMode ? (user?.dob?.slice(0, 10) ?? "") : "",
    gender: editMode
      ? (Object.keys(GENDER_TO_ENUM).find(
          (label) => GENDER_TO_ENUM[label] === user?.gender,
        ) ?? "")
      : "",
    lookingFor: editMode
      ? (Object.keys(LOOKING_FOR_TO_ENUM).find(
          (id) => LOOKING_FOR_TO_ENUM[id] === user?.lookingFor,
        ) ?? "")
      : "",
    interests: editMode
      ? (user?.interests ?? []).map(
          (value) =>
            INTEREST_OPTIONS.find(
              (option) => option.id === value || option.label === value,
            )?.id ?? value,
        )
      : [],
    bio: editMode ? (user?.bio ?? "") : "",
  }));
  const [birthday, setBirthday] = useState<BirthdayParts>(() =>
    birthdayParts(data.dob),
  );
  const [confirmBirthday, setConfirmBirthday] = useState(false);
  const [interestSearch, setInterestSearch] = useState("");
  const contentRef = useRef<HTMLIonContentElement>(null);
  const submitInFlight = useRef(false);

  useEffect(() => {
    void contentRef.current?.scrollToTop(0);
  }, [step]);

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
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoUploadInFlight = useRef(false);

  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof OnboardingData>(
    key: K,
    value: OnboardingData[K],
  ) => {
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
    if (!file || photoUploadInFlight.current || removingPhoto) return;
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`You can add up to ${MAX_PHOTOS} photos`);
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      toast.error(`Image must be ${MAX_PHOTO_SIZE_MB}MB or smaller`);
      return;
    }

    photoUploadInFlight.current = true;
    setUploading(true);
    setUploadProgress(0);
    try {
      const res = await userService.uploadPhoto(file, setUploadProgress);
      setPhotos(res.data.data.photos);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Couldn't upload that photo");
    } finally {
      photoUploadInFlight.current = false;
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemovePhoto = async (url: string) => {
    if (removingPhoto || uploading) return;
    setRemovingPhoto(true);
    const previous = photos;
    setPhotos((p) => p.filter((u) => u !== url)); // optimistic
    try {
      const res = await userService.deletePhoto(url);
      setPhotos(res.data.data.photos);
    } catch {
      setPhotos(previous); // roll back on failure
      toast.error("Couldn't remove that photo");
    } finally {
      setRemovingPhoto(false);
    }
  };

  /* =========================================================
     PERMISSIONS — real browser API calls, not decorative
  ========================================================= */

  const requestLocation = async () => {
    setPermissions((p) => ({ ...p, location: "requesting" }));

    try {
      const currentPermission = await Geolocation.checkPermissions();
      let locationGranted =
        currentPermission.location === "granted" ||
        currentPermission.coarseLocation === "granted";

      if (!locationGranted) {
        const requestedPermission = await Geolocation.requestPermissions();
        locationGranted =
          requestedPermission.location === "granted" ||
          requestedPermission.coarseLocation === "granted";
      }

      if (!locationGranted) {
        setPermissions((p) => ({ ...p, location: "denied" }));
        return;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });

      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setPermissions((p) => ({ ...p, location: "granted" }));
    } catch (error) {
      console.error("Location permission error:", error);
      setPermissions((p) => ({ ...p, location: "denied" }));
    }
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
    try {
      const result = await Notification.requestPermission();
      setPermissions((p) => ({
        ...p,
        notifications: result === "granted" ? "granted" : "denied",
      }));
    } catch {
      setPermissions((p) => ({ ...p, notifications: "denied" }));
    }
  };

  const age = birthdayAge(data.dob);
  const currentYear = new Date().getFullYear();
  const firstYear = Math.min(1900, Number(birthday.year) || 1900);
  const years = Array.from(
    { length: currentYear - firstYear + 1 },
    (_, index) => currentYear - index,
  );
  const daysInMonth = birthday.month
    ? new Date(
        Number(birthday.year) || 2000,
        Number(birthday.month),
        0,
      ).getDate()
    : 31;
  const birthdayLabel = data.dob
    ? `${Number(birthday.day)} ${MONTHS[Number(birthday.month) - 1]} ${birthday.year}`
    : "";

  const updateBirthday = (key: keyof BirthdayParts, value: string) => {
    const next = { ...birthday, [key]: value };
    if (next.day && next.month && next.year) {
      const count = new Date(
        Number(next.year),
        Number(next.month),
        0,
      ).getDate();
      if (Number(next.day) > count) next.day = "";
    }
    setBirthday(next);
    update("dob", birthdayISO(next));
  };

  const isStepValid = useMemo(() => {
    switch (step) {
      case 0:
        return age !== null && age >= 18;
      case 1:
        return Boolean(data.gender);
      case 2:
        return Boolean(data.lookingFor);
      case 3:
        return data.interests.length >= 3;
      default:
        return true; // Bio, photos and all permissions remain optional.
    }
  }, [step, age, data]);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => {
    if (editMode && step === 0) history.replace("/app/account");
    else setStep((s) => Math.max(s - 1, 0));
  };

  const finishOnboarding = async () => {
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    setSubmitting(true);
    try {
      await userService.updateProfile({
        dob: data.dob.slice(0, 10),
        gender: GENDER_TO_ENUM[data.gender],
        lookingFor: LOOKING_FOR_TO_ENUM[data.lookingFor],
        bio: editMode ? data.bio : data.bio || undefined,
        // Send labels, not raw ids — nicer to display anywhere this list
        // shows up later (e.g. "Coffee" instead of "coffee").
        interests: data.interests.map(
          (id) => INTEREST_OPTIONS.find((i) => i.id === id)?.label ?? id,
        ),
        // photos/profilePhoto are already saved server-side by each
        // upload in the Photos step — NOT re-sent here, since PATCH /me
        // would overwrite the list with whatever's sent (or clear it,
        // if omitted incorrectly some other way).
      });

      if (coords && user?.username) {
        try {
          await userService.updateLocation(
            user.username,
            coords.latitude,
            coords.longitude,
          );
        } catch {
          // Non-critical — they can enable location again later in Settings.
          toast.error(
            "Couldn't save your location, but your profile is saved.",
          );
        }
      }

      await refreshUser(); // picks up onboardingCompleted: true so ProtectedRoute lets them through
      toast.success(editMode ? "Profile updated!" : "You're all set!");
      history.replace(editMode ? "/app/account" : "/app/home");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't save your profile. Please try again.",
      );
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  const permissionSteps: Record<
    PermissionKey,
    {
      heading: string;
      description: string;
      action: string;
      detail: string;
      icon: string;
      request: () => Promise<void>;
    }
  > = {
    location: {
      heading: "Your next connection could be nearby.",
      description: "Use your location to discover people around you.",
      action: "Use my location",
      detail: "You can control location visibility in Settings.",
      icon: locationOutline,
      request: requestLocation,
    },
    camera: {
      heading: "A little more you, in every moment.",
      description:
        "Allow camera access to take a photo when you set up your profile.",
      action: "Enable camera",
      detail:
        "This step is optional. You can still choose photos from your gallery.",
      icon: cameraOutline,
      request: requestCamera,
    },
    notifications: {
      heading: "Know when someone says hello.",
      description: "Allow notifications for messages and updates from LinkUp.",
      action: "Enable notifications",
      detail:
        "You can change notification permissions later in your device settings.",
      icon: notificationsOutline,
      request: requestNotifications,
    },
  };
  const permissionKey: PermissionKey | null =
    step === 5
      ? "location"
      : step === 6
        ? "camera"
        : step === 7
          ? "notifications"
          : null;
  const permission = permissionKey ? permissionSteps[permissionKey] : null;
  const permissionStatus = permissionKey ? permissions[permissionKey] : null;
  const requesting = Object.values(permissions).some(
    (status) => status === "requesting",
  );
  const busy = submitting || uploading || removingPhoto || requesting;
  const isFinish = step === TOTAL_STEPS - 1;
  const showSkip = step >= 3 && !isFinish && permissionStatus !== "granted";
  const visibleInterests = INTEREST_OPTIONS.filter((interest) =>
    interest.label.toLowerCase().includes(interestSearch.trim().toLowerCase()),
  );
  const unknownInterests = data.interests.filter(
    (id) => !INTEREST_OPTIONS.some((option) => option.id === id),
  );

  const continueStep = () => {
    if (busy || !isStepValid) return;
    if (step === 0) setConfirmBirthday(true);
    else if (permission && permissionStatus === "idle")
      void permission.request();
    else goNext();
  };

  const renderPermission = () => {
    if (!permission || !permissionKey) return null;
    const status = permissions[permissionKey];
    return (
      <StepShell heading={permission.heading} subtitle={permission.description}>
        <div
          className={`onboarding-permission-art onboarding-permission-art--${permissionKey}`}
          aria-hidden="true"
        >
          <div className="onboarding-permission-orbit" />
          <div className="onboarding-permission-symbol">
            <IonIcon icon={permission.icon} />
          </div>
          <span className="onboarding-art-check">
            <IonIcon
              icon={status === "granted" ? checkmark : shieldCheckmarkOutline}
            />
          </span>
        </div>
        {permissionKey === "notifications" && (
          <div className="onboarding-notification-preview">
            <span className="onboarding-notification-logo">L</span>
            <div>
              <span className="onboarding-small-label">
                Notification preview
              </span>
              <strong>LinkUp</strong>
              <p>You have a new message.</p>
            </div>
          </div>
        )}
        <div className="onboarding-permission-note">
          <IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />
          <p>{permission.detail}</p>
        </div>
        <div
          className={`onboarding-permission-status onboarding-permission-status--${status}`}
          role="status"
          aria-live="polite"
        >
          {status === "granted" && (
            <>
              <IonIcon icon={checkmarkCircle} aria-hidden="true" />
              <span>{STEPS[step].label} access enabled</span>
            </>
          )}
          {status === "requesting" && (
            <>
              <IonSpinner name="crescent" />
              <span>Waiting for permission…</span>
            </>
          )}
          {status === "denied" && (
            <>
              <span>
                Access was not enabled. You can continue, try again, or check
                your device settings.
              </span>
              <button
                type="button"
                className="onboarding-text-button"
                onClick={() => void permission.request()}
                disabled={busy}
              >
                Try again
              </button>
            </>
          )}
          {status === "unsupported" && (
            <span>
              This permission is unavailable here. You can continue without
              enabling it.
            </span>
          )}
        </div>
      </StepShell>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <StepShell
            heading="When’s your birthday?"
            subtitle="Choose your date of birth. You must be 18 or older to use LinkUp."
          >
            <div className="onboarding-birthday-fields">
              <label htmlFor="onboarding-birth-day">
                Day
                <select
                  aria-label="Day"
                  id="onboarding-birth-day"
                  value={birthday.day}
                  onChange={(e) => updateBirthday("day", e.target.value)}
                >
                  <option value="">DD</option>
                  {Array.from(
                    { length: daysInMonth },
                    (_, index) => index + 1,
                  ).map((day) => (
                    <option key={day} value={String(day).padStart(2, "0")}>
                      {String(day).padStart(2, "0")}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="onboarding-birth-month">
                Month
                <select
                  aria-label="Month"
                  id="onboarding-birth-month"
                  value={birthday.month}
                  onChange={(e) => updateBirthday("month", e.target.value)}
                >
                  <option value="">MM</option>
                  {MONTHS.map((month, index) => (
                    <option
                      key={month}
                      value={String(index + 1).padStart(2, "0")}
                    >
                      {month.slice(0, 3)}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="onboarding-birth-year">
                Year
                <select
                  aria-label="Year"
                  id="onboarding-birth-year"
                  value={birthday.year}
                  onChange={(e) => updateBirthday("year", e.target.value)}
                >
                  <option value="">YYYY</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="onboarding-age-preview" aria-live="polite">
              <IonIcon icon={calendarOutline} aria-hidden="true" />
              <div>
                <span className="onboarding-small-label">Your age</span>
                <strong>
                  {age !== null && age >= 0
                    ? `${age} years old`
                    : "Select your birthday"}
                </strong>
              </div>
            </div>
            {age !== null && age < 18 && (
              <p className="onboarding-error" role="alert">
                You must be 18 or older to continue.
              </p>
            )}
            <p className="onboarding-field-hint">
              You can review your birthday before continuing.
            </p>
          </StepShell>
        );
      case 1:
        return (
          <StepShell
            heading="How do you identify?"
            subtitle="Choose the option that feels right for you."
          >
            <div
              className="onboarding-option-list"
              role="group"
              aria-label="Gender"
            >
              {GENDER_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`onboarding-option-row ${data.gender === option ? "is-selected" : ""}`}
                  aria-pressed={data.gender === option}
                  onClick={() => update("gender", option)}
                >
                  <span>{option}</span>
                  <IonIcon
                    icon={
                      data.gender === option ? checkmarkCircle : personOutline
                    }
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </StepShell>
        );
      case 2:
        return (
          <StepShell
            heading="What brings you to LinkUp?"
            subtitle="Pick the one that fits best. Your next conversation starts here."
          >
            <div
              className="onboarding-purpose-grid"
              role="group"
              aria-label="Looking for"
            >
              {LOOKING_FOR_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`onboarding-purpose-card ${data.lookingFor === option.id ? "is-selected" : ""}`}
                  aria-pressed={data.lookingFor === option.id}
                  onClick={() => update("lookingFor", option.id)}
                >
                  <span className="onboarding-purpose-emoji" aria-hidden="true">
                    {option.emoji}
                  </span>
                  <strong>{option.label}</strong>
                  <span className="onboarding-choice-mark" aria-hidden="true">
                    {data.lookingFor === option.id && (
                      <IonIcon icon={checkmarkCircle} />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </StepShell>
        );
      case 3:
        return (
          <StepShell
            heading="Find your common ground."
            subtitle="Choose at least 3 interests, or skip this step for now."
          >
            <label
              className="onboarding-search-label"
              htmlFor="onboarding-interest-search"
            >
              Search interests
              <input
                id="onboarding-interest-search"
                type="search"
                placeholder="Music, coffee, travel…"
                value={interestSearch}
                onChange={(e) => setInterestSearch(e.target.value)}
              />
            </label>
            <div className="onboarding-selection-count" aria-live="polite">
              {data.interests.length} selected
            </div>
            <div
              className="onboarding-interest-wrap"
              role="group"
              aria-label="Interests"
            >
              {visibleInterests.map((interest) => (
                <button
                  type="button"
                  key={interest.id}
                  className={`onboarding-interest-chip ${data.interests.includes(interest.id) ? "is-selected" : ""}`}
                  aria-pressed={data.interests.includes(interest.id)}
                  onClick={() => toggleInterest(interest.id)}
                >
                  <span aria-hidden="true">{interest.emoji}</span>
                  {interest.label}
                  {data.interests.includes(interest.id) && (
                    <IonIcon icon={checkmark} aria-hidden="true" />
                  )}
                </button>
              ))}
              {unknownInterests
                .filter((value) =>
                  value.toLowerCase().includes(interestSearch.toLowerCase()),
                )
                .map((value) => (
                  <button
                    type="button"
                    key={value}
                    className="onboarding-interest-chip is-selected"
                    aria-pressed="true"
                    onClick={() => toggleInterest(value)}
                  >
                    {value}
                    <IonIcon icon={checkmark} aria-hidden="true" />
                  </button>
                ))}
            </div>
            {!visibleInterests.length && !unknownInterests.length && (
              <p className="onboarding-field-hint">
                No matching interests. Try another word.
              </p>
            )}
          </StepShell>
        );
      case 4:
        return (
          <StepShell
            heading="Give them a reason to say hello."
            subtitle="A few words about you can start a great conversation."
          >
            <div className="onboarding-bio-inspiration">
              <IonIcon icon={sparklesOutline} aria-hidden="true" />
              <p>
                Think about your ideal weekend, a favourite hobby, or something
                you could talk about for hours.
              </p>
            </div>
            <IonTextarea
              className="onboarding-textarea"
              aria-label="About you"
              placeholder="Coffee enthusiast, weekend hiker, always up for a good conversation…"
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
      case 6:
      case 7:
        return renderPermission();
      case 8:
        return (
          <StepShell
            heading="Let people see the real you."
            subtitle="Take a new photo or choose one from your gallery. Your first photo is your profile picture."
          >
            <div className="onboarding-photo-counter">
              {photos.length} of {MAX_PHOTOS} photos added
            </div>
            {photos.length < MAX_PHOTOS && (
              <div
                className="onboarding-photo-sources"
                role="group"
                aria-label="Add a photo"
              >
                <button
                  type="button"
                  className="onboarding-photo-source"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading || removingPhoto}
                >
                  <IonIcon icon={cameraOutline} aria-hidden="true" />
                  <strong>Take photo</strong>
                </button>
                <button
                  type="button"
                  className="onboarding-photo-source"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || removingPhoto}
                >
                  <IonIcon icon={imagesOutline} aria-hidden="true" />
                  <strong>Choose from gallery</strong>
                </button>
              </div>
            )}
            {uploading && (
              <div
                className="onboarding-photo-progress"
                role="status"
                aria-live="polite"
              >
                <IonSpinner name="crescent" />
                <span>
                  {uploadProgress >= 100
                    ? "Finishing upload…"
                    : `Uploading photo… ${uploadProgress}%`}
                </span>
              </div>
            )}
            {photos.length > 0 ? (
              <div className="onboarding-photo-grid">
                {photos.map((url, index) => (
                  <div
                    className={`onboarding-photo-tile ${index === 0 ? "onboarding-photo-tile--primary" : ""}`}
                    key={url}
                  >
                    <img
                      src={url}
                      alt={
                        index === 0
                          ? "Your profile photo"
                          : `Your photo ${index + 1}`
                      }
                    />
                    {index === 0 && (
                      <span className="onboarding-photo-primary-badge">
                        Profile photo
                      </span>
                    )}
                    <button
                      type="button"
                      className="onboarding-photo-remove"
                      onClick={() => void handleRemovePhoto(url)}
                      disabled={uploading || removingPhoto}
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <IonIcon icon={closeOutline} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              !uploading && (
                <div className="onboarding-photo-empty">
                  <IonIcon icon={personOutline} aria-hidden="true" />
                  <strong>Your profile starts with you</strong>
                  <p>Add a clear photo so people can recognise you.</p>
                </div>
              )
            )}
            {photos.length >= MAX_PHOTOS && (
              <p className="onboarding-field-hint">
                All {MAX_PHOTOS} photo slots are filled. Remove a photo to add
                another.
              </p>
            )}
            <p className="onboarding-field-hint">
              JPG, PNG or WebP · up to {MAX_PHOTO_SIZE_MB}MB per photo
            </p>
            <input
              ref={fileInputRef}
              id="onboarding-gallery-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={
                uploading || removingPhoto || photos.length >= MAX_PHOTOS
              }
              onChange={handleFileSelected}
            />
            {/* Capacitor's Android WebChromeClient opens the native camera for image/* + capture. */}
            <input
              ref={cameraInputRef}
              id="onboarding-camera-input"
              type="file"
              accept="image/*"
              capture="user"
              hidden
              disabled={
                uploading || removingPhoto || photos.length >= MAX_PHOTOS
              }
              onChange={handleFileSelected}
            />
          </StepShell>
        );
      default:
        return (
          <div className="onboarding-finish">
            <div className="onboarding-finish-mark">
              <IonIcon icon={checkmark} aria-hidden="true" />
            </div>
            <h1 className="onboarding-step-heading">
              {editMode
                ? "Ready to save your changes?"
                : "Ready for your next hello?"}
            </h1>
            <p className="onboarding-step-subtitle">
              {editMode
                ? "Review your profile, then save your updates."
                : "Your profile is ready. Let’s make some connections."}
            </p>
            <div className="onboarding-review-card">
              {photos[0] ? (
                <img
                  src={photos[0]}
                  className="onboarding-review-avatar"
                  alt="Your profile photo"
                />
              ) : (
                <span className="onboarding-review-avatar onboarding-review-avatar--empty">
                  <IonIcon icon={personOutline} aria-hidden="true" />
                </span>
              )}
              <strong>
                {user?.username || "Your profile"}
                {age !== null ? `, ${age}` : ""}
              </strong>
              <span>
                {data.gender}
                {data.lookingFor
                  ? ` · ${LOOKING_FOR_OPTIONS.find((option) => option.id === data.lookingFor)?.label ?? ""}`
                  : ""}
              </span>
              {data.bio && <p>{data.bio}</p>}
              {data.interests.length > 0 && (
                <div className="onboarding-review-interests">
                  {data.interests.map((id) => (
                    <span key={id}>
                      {INTEREST_OPTIONS.find((option) => option.id === id)
                        ?.label ?? id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <IonPage className="linkup-onboarding-page">
      <IonHeader className="onboarding-header ion-no-border">
        <IonToolbar className="onboarding-toolbar">
          <div className="onboarding-topbar">
            <button
              type="button"
              className={`onboarding-back-btn ${step === 0 && !editMode ? "onboarding-back-btn--hidden" : ""}`}
              onClick={goBack}
              disabled={busy}
              aria-label={
                editMode && step === 0
                  ? "Back to your profile"
                  : "Previous step"
              }
            >
              <IonIcon icon={chevronBackOutline} aria-hidden="true" />
            </button>
            <span className="onboarding-brand">
              LinkUp
              <span>
                {editMode
                  ? "Edit profile"
                  : permission
                    ? "Make it yours"
                    : "Your profile"}
              </span>
            </span>
            <span className="onboarding-step-counter" aria-live="polite">
              {isFinish ? "Ready" : `${step + 1} / ${TOTAL_STEPS - 1}`}
            </span>
          </div>
        </IonToolbar>
        {!isFinish && (
          <div className="onboarding-progress-wrap">
            <div
              className="onboarding-progress"
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={0}
              aria-valuemax={TOTAL_STEPS - 1}
              aria-valuenow={step + 1}
            >
              {STEPS.slice(0, -1).map((item, index) => (
                <span
                  key={item.label}
                  className={index <= step ? "is-complete" : ""}
                />
              ))}
            </div>
          </div>
        )}
      </IonHeader>

      <IonContent ref={contentRef} className="onboarding-content">
        <div
          className={`onboarding-body ${permission ? "onboarding-body--permission" : ""}`}
          key={step}
        >
          {!isFinish && (
            <div className="onboarding-step-label">
              <span className="onboarding-step-symbol">
                <IonIcon icon={STEPS[step].icon} aria-hidden="true" />
              </span>
              <span>{STEPS[step].label}</span>
              {step >= 3 && (
                <span className="onboarding-optional">Optional</span>
              )}
            </div>
          )}
          {renderStep()}
        </div>
      </IonContent>

      <IonFooter className="onboarding-footer ion-no-border">
        <div className="onboarding-footer-inner">
          <button
            type="button"
            className="onboarding-continue-btn"
            disabled={busy || (!isFinish && !isStepValid)}
            onClick={isFinish ? finishOnboarding : continueStep}
          >
            {submitting || requesting ? (
              <>
                <IonSpinner name="crescent" />
                <span>{submitting ? "Saving…" : "Requesting…"}</span>
              </>
            ) : (
              <>
                <span>
                  {isFinish
                    ? editMode
                      ? "Save changes"
                      : "Enter LinkUp"
                    : permission && permissionStatus === "idle"
                      ? permission.action
                      : "Continue"}
                </span>
                <IonIcon icon={chevronForwardOutline} aria-hidden="true" />
              </>
            )}
          </button>
          {showSkip && (
            <button
              type="button"
              className="onboarding-skip-btn"
              onClick={goNext}
              disabled={busy}
            >
              {permission ? "Not now" : "Skip for now"}
            </button>
          )}
        </div>
      </IonFooter>

      <IonAlert
        isOpen={confirmBirthday}
        cssClass="linkup-onboarding-birthday-alert"
        header="Confirm your birthday"
        subHeader={birthdayLabel}
        message={`Age: ${age ?? ""} years. Is your date of birth correct?`}
        onDidDismiss={() => setConfirmBirthday(false)}
        buttons={[
          { text: "Edit", role: "cancel" },
          { text: "Confirm", handler: goNext },
        ]}
      />
    </IonPage>
  );
};

const StepShell: React.FC<{
  heading: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ heading, subtitle, children }) => (
  <section className="onboarding-step-shell">
    <h1 className="onboarding-step-heading">{heading}</h1>
    <p className="onboarding-step-subtitle">{subtitle}</p>
    <div className="onboarding-step-fields">{children}</div>
  </section>
);

export default OnboardingPage;
