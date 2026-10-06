import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  addOutline,
  calendarOutline,
  cameraOutline,
  chatbubbleEllipsesOutline,
  checkmarkCircle,
  chevronForwardOutline,
  closeOutline,
  createOutline,
  heartOutline,
  imagesOutline,
  lockClosedOutline,
  notificationsOffOutline,
  peopleOutline,
  personOutline,
  qrCodeOutline,
  refreshOutline,
  searchOutline,
  settingsOutline,
  shieldCheckmarkOutline,
  sparklesOutline,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router";
import toast from "react-hot-toast";
import { User } from "../../common/user.model";
import { ConversationResponse } from "../../common/chat.model";
import { ConnectionResponse } from "../../common/connection.model";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { getOrCreateDirectConversation } from "../../service/chatService";
import { updateProfile, uploadPhoto } from "../../service/userService";
import { badgeCount } from "../../service/notificationService";
import { MAX_PHOTOS, MAX_PHOTO_SIZE_MB } from "../../config/api.config";
import {
  formatChatListTime,
  notifyChatListChanged,
} from "../../utils/chatPresentation";

import "./ProfilePage.scss";
import ProfilePhotoViewer from "./ProfilePhotoViewer";
import {
  ProfileTab,
  profileTab,
  profilePhotos,
  completion,
  profileAge,
  recentConversations,
  directConversations,
  genderLabels,
  lookingForLabels,
  joinedLabel,
  birthdayLabel,
} from "./profilePresentation";
import useProfileActivity from "./useProfileActivity";

const tabs: { value: ProfileTab; label: string; icon: string }[] = [
  { value: "about", label: "About", icon: personOutline },
  { value: "chats", label: "Chats", icon: chatbubbleEllipsesOutline },
  { value: "friends", label: "Friends", icon: peopleOutline },
];
function Avatar({
  src,
  name,
  online = false,
}: {
  src?: string | null;
  name: string;
  online?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className="me-avatar">
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="me-avatar-initial" aria-hidden="true">
          {Array.from(name.trim())[0]?.toUpperCase() || "L"}
        </span>
      )}
      {online && (
        <span className="me-online-dot" role="img" aria-label="Online" />
      )}
    </span>
  );
}
function ListSkeleton({ text }: { text: string }) {
  return (
    <div className="me-list-skeleton" role="status" aria-label={text}>
      {[0, 1, 2, 3].map((value) => (
        <div key={value}>
          <i />
          <span>
            <b />
            <b />
          </span>
        </div>
      ))}
      <span className="me-sr-only">{text}</span>
    </div>
  );
}
function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="me-empty">
      <span>
        <IonIcon icon={icon} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="me-button me-button-primary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
function Retry({
  text,
  busy,
  retry,
}: {
  text: string;
  busy: boolean;
  retry: () => void;
}) {
  return (
    <div className="me-retry" role="alert">
      <p>{text}</p>
      <button disabled={busy} onClick={retry}>
        <IonIcon icon={refreshOutline} />
        {busy ? "Refreshing…" : "Retry"}
      </button>
    </div>
  );
}
function ProfileContent({
  user,
  refreshUser,
}: {
  user: User;
  refreshUser: () => Promise<void>;
}) {
  const history = useHistory();
  const location = useLocation();
  const active = /^\/app\/account\/?$/.test(location.pathname);
  const activeTab = profileTab(new URLSearchParams(location.search).get("tab"));
  const { revision } = useNotifications();
  const activity = useProfileActivity(user.publicId, active, revision);
  const [queries, setQueries] = useState({ chats: "", friends: "" });
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(24);
  const [profileError, setProfileError] = useState("");
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const openingRef = useRef(false);
  const [photoPicker, setPhotoPicker] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoFlight = useRef(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [photoOverride, setPhotoOverride] = useState<Pick<
    User,
    "photos" | "profilePhoto"
  > | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const photoSection = useRef<HTMLElement>(null);
  const tabBar = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const visible = useRef(active);
  visible.current = active;
  const profileFlight = useRef<Promise<void> | null>(null);
  const photos = useMemo(
    () => profilePhotos(photoOverride ?? user),
    [photoOverride, user.photos, user.profilePhoto],
  );
  const primaryPhoto = photoOverride
    ? photoOverride.profilePhoto
    : user.profilePhoto;
  const progress = completion({ ...user, profilePhoto: primaryPhoto }, photos);
  const age = profileAge(user);
  const chats = useMemo(
    () => recentConversations(activity.conversations ?? []),
    [activity.conversations],
  );
  const chatByFriend = useMemo(
    () =>
      new Map(
        directConversations(activity.conversations ?? []).map((chat) => [
          chat.friendPublicId,
          chat,
        ]),
      ),
    [activity.conversations],
  );
  const friends = useMemo(
    () =>
      (activity.friends ?? [])
        .slice()
        .sort((a, b) =>
          a.username.localeCompare(b.username, "en", { sensitivity: "base" }),
        ),
    [activity.friends],
  );
  const unreadChats = chats.filter((chat) => chat.unreadCount > 0).length;
  const friendSearch = queries.friends.trim().toLocaleLowerCase();
  const chatSearch = queries.chats.trim().toLocaleLowerCase();
  const shownFriends = friends.filter((friend) =>
    friend.username.toLocaleLowerCase().includes(friendSearch),
  );
  const shownChats = chats.filter(
    (chat) =>
      (!unreadOnly || chat.unreadCount > 0) &&
      (chat.friendUsername.toLocaleLowerCase().includes(chatSearch) ||
        chat.lastMessage?.toLocaleLowerCase().includes(chatSearch)),
  );
  const viewName = user.username || "Your profile";
  const edit = () => history.push("/app/account/edit");
  const changeTab = (tab: ProfileTab) => {
    const params = new URLSearchParams(location.search);
    if (tab === "about") params.delete("tab");
    else params.set("tab", tab);
    history.replace({
      ...location,
      search: params.toString() ? `?${params}` : "",
    });
  };
  const showPhotos = () => {
    changeTab("about");
    requestAnimationFrame(() =>
      photoSection.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };
  const tabKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index + tabs.length - 1) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    changeTab(tabs[next].value);
    tabBar.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next].focus();
  };
  const refreshProfile = useCallback((): Promise<void> => {
    if (profileFlight.current) return profileFlight.current;
    setProfileRefreshing(true);
    const request = refreshUser()
      .then(() => {
        if (mounted.current) setProfileError("");
      })
      .catch(() => {
        if (mounted.current)
          setProfileError(
            "Your profile could not be refreshed. Showing saved details.",
          );
      })
      .finally(() => {
        if (profileFlight.current === request) profileFlight.current = null;
        if (mounted.current) setProfileRefreshing(false);
      });
    profileFlight.current = request;
    return request;
  }, [refreshUser]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (active) void refreshProfile();
    else {
      setViewer(null);
      setPhotoPicker(false);
    }
  }, [active, refreshProfile]);
  useEffect(() => {
    setLimit(24);
  }, [activeTab, queries.chats, queries.friends, unreadOnly]);
  useEffect(
    () => () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    },
    [uploadPreview],
  );
  useEffect(() => {
    if (
      photoOverride &&
      user.profilePhoto === photoOverride.profilePhoto &&
      photoOverride.photos.every((url) => user.photos?.includes(url))
    )
      setPhotoOverride(null);
  }, [user.photos, user.profilePhoto, photoOverride]);

  const openConversation = (
    conversation: ConversationResponse,
    friend?: ConnectionResponse,
  ) => {
    if (!visible.current) return;
    history.push(`/app/friend-chat/${conversation.conversationId}`, {
      conversation,
      ...(friend ? { friend } : {}),
    });
  };
  const openFriend = async (friend: ConnectionResponse) => {
    if (openingRef.current) return;
    const existing = chatByFriend.get(friend.userId);
    if (existing) {
      openConversation(existing, friend);
      return;
    }
    openingRef.current = true;
    setOpening(friend.userId);
    try {
      const conversation = await getOrCreateDirectConversation(friend.userId);
      if (mounted.current && visible.current) {
        openConversation(conversation, friend);
        notifyChatListChanged();
      }
    } catch {
      if (mounted.current && visible.current)
        toast.error("Could not open this chat. Please try again.");
    } finally {
      openingRef.current = false;
      if (mounted.current) setOpening(null);
    }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoFlight.current) return;
    if ((user.photos?.length ?? 0) >= MAX_PHOTOS) {
      toast.error(
        `You can add up to ${MAX_PHOTOS} photos. Manage them in Edit profile.`,
      );
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
      (file.type || !/\.(jpe?g|png|webp)$/i.test(file.name))
    ) {
      toast.error("Choose a JPG, PNG or WebP photo.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024) {
      toast.error(`Choose a photo smaller than ${MAX_PHOTO_SIZE_MB} MB.`);
      return;
    }
    photoFlight.current = true;
    setPhotoBusy(true);
    setPhotoProgress(0);
    setUploadPreview(URL.createObjectURL(file));
    try {
      const response = await uploadPhoto(file, (percent) => {
        if (mounted.current) setPhotoProgress(percent);
      });
      if (!mounted.current) return;
      setPhotoOverride({
        photos: response.data.data.photos ?? [],
        profilePhoto: response.data.data.profilePhoto,
      });
      toast.success("Photo added");
      await refreshProfile();
    } catch {
      if (mounted.current)
        toast.error("Could not upload your photo. Please try again.");
    } finally {
      photoFlight.current = false;
      if (mounted.current) {
        setPhotoBusy(false);
        setUploadPreview(null);
      }
    }
  };
  const makePrimary = async (url: string) => {
    if (photoFlight.current || !photos.includes(url) || url === primaryPhoto)
      return;
    photoFlight.current = true;
    setPhotoBusy(true);
    try {
      const response = await updateProfile({ profilePhoto: url });
      if (!mounted.current) return;
      setPhotoOverride({
        photos: response.data.data.photos ?? photos,
        profilePhoto: response.data.data.profilePhoto ?? url,
      });
      setViewer(0);
      toast.success("Profile photo updated");
      await refreshProfile();
    } catch {
      if (mounted.current)
        toast.error("Could not update your profile photo. Please try again.");
    } finally {
      photoFlight.current = false;
      if (mounted.current) setPhotoBusy(false);
    }
  };
  const row = (
    name: string,
    photo: string | null | undefined,
    online: boolean,
    preview: string,
    conversation: ConversationResponse | undefined,
    onClick: () => void,
    key: string,
    busy = false,
  ) => {
    const unread = Math.max(0, conversation?.unreadCount ?? 0);
    return (
      <li key={key}>
        <button
          className={`me-person-row${unread ? " has-unread" : ""}`}
          disabled={opening !== null}
          onClick={onClick}
          aria-label={`Chat with ${name}${unread ? `, ${unread} unread messages` : ""}`}
        >
          <Avatar src={photo} name={name} online={online} />
          <span className="me-person-copy">
            <strong>{name}</strong>
            <span>{preview}</span>
          </span>
          <span className="me-person-meta">
            {conversation?.lastMessage && (
              <time dateTime={conversation.lastMessageAt ?? undefined}>
                {formatChatListTime(conversation.lastMessageAt)}
              </time>
            )}
            <span>
              {conversation?.muted && (
                <IonIcon
                  icon={notificationsOffOutline}
                  role="img"
                  aria-label="Muted"
                />
              )}
              {busy ? (
                <IonSpinner name="crescent" />
              ) : unread > 0 ? (
                <b
                  className={`me-unread${conversation?.muted ? " is-muted" : ""}`}
                >
                  {badgeCount(unread)}
                </b>
              ) : (
                <IonIcon
                  className="me-person-arrow"
                  icon={chevronForwardOutline}
                />
              )}
            </span>
          </span>
        </button>
      </li>
    );
  };
  const privateGenders = user.genderPreference?.length
    ? user.genderPreference
        .map((gender) => genderLabels[gender] ?? gender)
        .join(", ")
    : "Not set";
  const privateAges =
    user.minAgePreference != null && user.maxAgePreference != null
      ? `${user.minAgePreference}–${user.maxAgePreference} years`
      : user.minAgePreference != null
        ? `${user.minAgePreference}+ years`
        : user.maxAgePreference != null
          ? `Up to ${user.maxAgePreference} years`
          : "Not set";

  return (
    <IonPage className="linkup-me-page">
      <IonHeader className="ion-no-border">
        <IonToolbar className="me-toolbar">
          <IonTitle>My profile</IonTitle>
          <IonButtons slot="end">
            <IonButton
              aria-label="My profile QR code"
              onClick={() => history.push("/app/me/settings/invite")}
            >
              <IonIcon slot="icon-only" icon={qrCodeOutline} />
            </IonButton>
            <IonButton
              aria-label="Profile settings"
              onClick={() => history.push("/app/me/settings")}
            >
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="me-content">
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            const refresher = event.target;
            void Promise.all([
              refreshProfile(),
              activity.refresh(true),
            ]).finally(() => refresher.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>
        <main className="me-container">
          <section className="me-hero" aria-label="Your profile overview">
            <div className="me-hero-art" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="me-identity">
              <div className="me-hero-avatar">
                <button
                  aria-label={
                    photos.length
                      ? "View your profile photos"
                      : "Add your first photo"
                  }
                  onClick={() =>
                    photos.length ? setViewer(0) : setPhotoPicker(true)
                  }
                >
                  <Avatar src={primaryPhoto} name={viewName} />
                </button>
                <button
                  className="me-camera"
                  aria-label="Add profile photo"
                  disabled={
                    photoBusy || (user.photos?.length ?? 0) >= MAX_PHOTOS
                  }
                  onClick={() => setPhotoPicker(true)}
                >
                  <IonIcon icon={cameraOutline} />
                </button>
              </div>
              <div className="me-identity-copy">
                <span className="me-eyebrow">THIS IS YOU</span>
                <h1>
                  {viewName}
                  {age != null && <span>, {age}</span>}
                </h1>
                {user.emailVerified ? (
                  <span className="me-verified">
                    <IonIcon icon={checkmarkCircle} />
                    Email verified
                  </span>
                ) : (
                  <button
                    className="me-verify"
                    onClick={() => history.push("/verify-email")}
                  >
                    <IonIcon icon={shieldCheckmarkOutline} />
                    Verify email
                    <IonIcon icon={chevronForwardOutline} />
                  </button>
                )}
              </div>
            </div>
            <div className="me-hero-actions">
              <button className="me-button me-button-primary" onClick={edit}>
                <IonIcon icon={createOutline} />
                Edit profile
              </button>
              <button
                className="me-button me-button-light"
                onClick={() => history.push("/app/me/settings/invite")}
              >
                <IonIcon icon={qrCodeOutline} />
                Share / QR
              </button>
            </div>
            <div className="me-stats">
              <button onClick={() => changeTab("friends")}>
                <strong>
                  {activity.friends === null ? "—" : friends.length}
                </strong>
                <span>Friends</span>
              </button>
              <button onClick={() => changeTab("chats")}>
                <strong>
                  {activity.conversations === null ? "—" : chats.length}
                </strong>
                <span>Chats</span>
              </button>
              <button onClick={showPhotos}>
                <strong>{photos.length}</strong>
                <span>Photos</span>
              </button>
            </div>
          </section>
          {photoBusy && uploadPreview && (
            <div className="me-upload-status" role="status">
              <img src={uploadPreview} alt="Photo being uploaded" />
              <span>
                Adding your photo…<small>{photoProgress}% uploaded</small>
              </span>
              <IonSpinner name="crescent" />
            </div>
          )}
          {profileError && (
            <Retry
              text={profileError}
              busy={profileRefreshing}
              retry={() => void refreshProfile()}
            />
          )}
          <button
            className="me-completion"
            onClick={progress.next?.photos ? () => setPhotoPicker(true) : edit}
            aria-label={`${progress.percent}% profile complete. ${progress.next?.label ?? "Edit your profile"}`}
          >
            <div className="me-completion-copy">
              <span>
                <IonIcon icon={sparklesOutline} />
                <strong>
                  {progress.percent === 100
                    ? "Your profile is complete"
                    : "Make your profile feel like you"}
                </strong>
              </span>
              <b>{progress.percent}%</b>
            </div>
            <span
              className="me-progress"
              role="progressbar"
              aria-label="Profile completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percent}
            >
              <i style={{ width: `${progress.percent}%` }} />
            </span>
            <span className="me-completion-next">
              {progress.next?.label ?? "Keep your details up to date"}
              <IonIcon icon={chevronForwardOutline} />
            </span>
          </button>
          <div
            ref={tabBar}
            className="me-tabs"
            role="tablist"
            aria-label="Profile sections"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                id={`me-tab-${tab.value}`}
                aria-label={tab.label}
                aria-controls={`me-panel-${tab.value}`}
                aria-selected={activeTab === tab.value}
                tabIndex={activeTab === tab.value ? 0 : -1}
                onClick={() => changeTab(tab.value)}
                onKeyDown={(event) => tabKeys(event, index)}
              >
                <IonIcon icon={tab.icon} aria-hidden="true" />
                {tab.label}
                {tab.value === "chats" && unreadChats > 0 && (
                  <span
                    className="me-tab-dot"
                    aria-label={`${unreadChats} unread chats`}
                  />
                )}
              </button>
            ))}
          </div>
          <section
            id={`me-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`me-tab-${activeTab}`}
            className="me-panel"
          >
            {activeTab === "about" ? (
              <>
                <section className="me-card me-bio">
                  <div className="me-section-title">
                    <h2>A little about me</h2>
                    <button
                      className="me-icon-button"
                      aria-label="Edit bio"
                      onClick={edit}
                    >
                      <IonIcon icon={createOutline} />
                    </button>
                  </div>
                  {user.bio?.trim() ? (
                    <p>{user.bio}</p>
                  ) : (
                    <button className="me-add-detail" onClick={edit}>
                      <IonIcon icon={addOutline} />
                      Add a bio
                      <span>A few words can start a conversation.</span>
                    </button>
                  )}
                </section>
                <section className="me-card">
                  <div className="me-section-title">
                    <h2>The basics</h2>
                    <button
                      className="me-icon-button"
                      aria-label="Edit profile details"
                      onClick={edit}
                    >
                      <IonIcon icon={createOutline} />
                    </button>
                  </div>
                  <dl className="me-basics">
                    {[
                      [
                        calendarOutline,
                        "Age",
                        age != null ? `${age} years` : "Not added",
                      ],
                      [
                        personOutline,
                        "Gender",
                        user.gender
                          ? (genderLabels[user.gender] ?? user.gender)
                          : "Not added",
                      ],
                      [
                        heartOutline,
                        "Looking for",
                        user.lookingFor
                          ? (lookingForLabels[user.lookingFor] ??
                            user.lookingFor)
                          : "Not added",
                      ],
                      [
                        sparklesOutline,
                        "Joined LinkUp",
                        joinedLabel(user.createdAt),
                      ],
                    ].map(([icon, label, value]) => (
                      <div key={label}>
                        <IonIcon icon={icon} />
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section className="me-card">
                  <div className="me-section-title">
                    <h2>My interests</h2>
                    <button
                      className="me-icon-button"
                      aria-label="Edit interests"
                      onClick={edit}
                    >
                      <IonIcon icon={createOutline} />
                    </button>
                  </div>
                  {user.interests?.length ? (
                    <div className="me-interest-chips">
                      {[...new Set(user.interests)].map((interest) => (
                        <span key={interest}>
                          {interest.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <button className="me-add-detail" onClick={edit}>
                      <IonIcon icon={addOutline} />
                      Add interests
                      <span>Give people something to connect over.</span>
                    </button>
                  )}
                </section>
                <section ref={photoSection} className="me-card me-photos">
                  <div className="me-section-title">
                    <h2>
                      My photos <span>{photos.length}</span>
                    </h2>
                    <button
                      className="me-text-button"
                      onClick={() => setPhotoPicker(true)}
                      disabled={
                        photoBusy || (user.photos?.length ?? 0) >= MAX_PHOTOS
                      }
                    >
                      <IonIcon icon={addOutline} />
                      Add
                    </button>
                  </div>
                  {photos.length ? (
                    <div className="me-photo-grid">
                      {photos.map((url, index) => (
                        <button
                          key={url}
                          onClick={() => setViewer(index)}
                          aria-label={`View photo ${index + 1}${url === primaryPhoto ? ", profile photo" : ""}`}
                        >
                          <img src={url} alt="" loading="lazy" />
                          {url === primaryPhoto && (
                            <span>
                              <IonIcon icon={checkmarkCircle} />
                              Profile
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={imagesOutline}
                      title="Let people see you"
                      text="Add a photo to make your profile more personal."
                      action="Add a photo"
                      onAction={() => setPhotoPicker(true)}
                    />
                  )}
                  <p className="me-note">
                    Tap a photo to view it or use it as your profile picture.
                    {(user.photos?.length ?? 0) >= MAX_PHOTOS && (
                      <>
                        {" "}
                        Photo limit reached.{" "}
                        <button onClick={edit}>Manage photos</button>
                      </>
                    )}
                  </p>
                </section>
                <details className="me-private">
                  <summary>
                    <span>
                      <IonIcon icon={lockClosedOutline} />
                      <strong>Only you</strong>
                      <small>Account details & saved preferences</small>
                    </span>
                    <IonIcon
                      className="me-private-arrow"
                      icon={chevronForwardOutline}
                    />
                  </summary>
                  <div className="me-private-body">
                    <p>
                      These details are shown only on your own profile page.
                    </p>
                    <dl>
                      <div>
                        <dt>Email</dt>
                        <dd>{user.email || "Not added"}</dd>
                      </div>
                      <div>
                        <dt>Date of birth</dt>
                        <dd>{birthdayLabel(user.dob)}</dd>
                      </div>
                      <div>
                        <dt>Gender preference</dt>
                        <dd>{privateGenders}</dd>
                      </div>
                      <div>
                        <dt>Age preference</dt>
                        <dd>{privateAges}</dd>
                      </div>
                      <div>
                        <dt>Distance preference</dt>
                        <dd>
                          {user.maxDistanceKm != null
                            ? `${user.maxDistanceKm} km`
                            : "Not set"}
                        </dd>
                      </div>
                      <div>
                        <dt>Discovery visibility</dt>
                        <dd>
                          {user.locationVisible
                            ? "Visible in People & Nearby"
                            : "Hidden from People & Nearby"}
                        </dd>
                      </div>
                    </dl>
                    <button
                      className="me-button me-button-outline"
                      onClick={() => history.push("/app/me/settings/privacy")}
                    >
                      <IonIcon icon={shieldCheckmarkOutline} />
                      Manage privacy
                    </button>
                  </div>
                </details>
              </>
            ) : (
              <>
                <div className="me-list-heading">
                  <div>
                    <h2>
                      {activeTab === "chats"
                        ? "Pick up the conversation"
                        : "Your people"}
                    </h2>
                    <p>
                      {activeTab === "chats"
                        ? "Your latest one-to-one chats, newest first."
                        : "All your friends, a message away."}
                    </p>
                  </div>
                  <button
                    className="me-icon-button"
                    aria-label={
                      activeTab === "chats"
                        ? "Refresh chats"
                        : "Refresh friends"
                    }
                    disabled={activity.refreshing}
                    onClick={() => void activity.refresh()}
                  >
                    {activity.refreshing ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <IonIcon icon={refreshOutline} />
                    )}
                  </button>
                </div>
                <div className="me-search">
                  <IonIcon icon={searchOutline} />
                  <input
                    type="text"
                    inputMode="search"
                    aria-label={
                      activeTab === "chats" ? "Search chats" : "Search friends"
                    }
                    placeholder={
                      activeTab === "chats"
                        ? "Search people or messages"
                        : "Search your friends"
                    }
                    value={queries[activeTab]}
                    onChange={(event) =>
                      setQueries((old) => ({
                        ...old,
                        [activeTab]: event.target.value,
                      }))
                    }
                  />
                  {queries[activeTab] && (
                    <button
                      aria-label="Clear search"
                      onClick={() =>
                        setQueries((old) => ({ ...old, [activeTab]: "" }))
                      }
                    >
                      <IonIcon icon={closeOutline} />
                    </button>
                  )}
                </div>
                {activeTab === "chats" && (
                  <div className="me-chat-filters">
                    <button
                      aria-pressed={!unreadOnly}
                      onClick={() => setUnreadOnly(false)}
                    >
                      All chats
                    </button>
                    <button
                      aria-pressed={unreadOnly}
                      onClick={() => setUnreadOnly(true)}
                    >
                      Unread
                      {unreadChats > 0 && (
                        <span>{badgeCount(unreadChats)}</span>
                      )}
                    </button>
                    <small>Times in IST</small>
                  </div>
                )}
                {(activeTab === "chats"
                  ? activity.errors.chats
                  : activity.errors.friends) && (
                  <Retry
                    text={
                      activeTab === "chats"
                        ? activity.errors.chats
                        : activity.errors.friends
                    }
                    busy={activity.refreshing}
                    retry={() => void activity.refresh()}
                  />
                )}
                {activeTab === "chats" ? (
                  activity.conversations === null ? (
                    !activity.errors.chats && (
                      <ListSkeleton text="Loading recent chats…" />
                    )
                  ) : shownChats.length ? (
                    <>
                      <ul className="me-people-list">
                        {shownChats
                          .slice(0, limit)
                          .map((chat) =>
                            row(
                              chat.friendUsername,
                              chat.friendProfilePhoto,
                              !!chat.friendOnline,
                              chat.lastMessage || "Open your conversation",
                              chat,
                              () => openConversation(chat),
                              `chat-${chat.conversationId}`,
                            ),
                          )}
                      </ul>
                      {shownChats.length > limit && (
                        <button
                          className="me-button me-button-outline me-show-more"
                          onClick={() => setLimit((value) => value + 24)}
                        >
                          Show more chats
                        </button>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      icon={chatbubbleEllipsesOutline}
                      title={
                        chatSearch
                          ? "No matching conversations"
                          : unreadOnly
                            ? "You are all caught up"
                            : "Your next hello starts here"
                      }
                      text={
                        chatSearch
                          ? "Try another name or message."
                          : unreadOnly
                            ? "There are no unread chats to show."
                            : "Message a friend and your conversation will appear here."
                      }
                      action={
                        chatSearch
                          ? "Clear search"
                          : unreadOnly
                            ? "Show all chats"
                            : "See my friends"
                      }
                      onAction={() =>
                        chatSearch
                          ? setQueries((old) => ({ ...old, chats: "" }))
                          : unreadOnly
                            ? setUnreadOnly(false)
                            : changeTab("friends")
                      }
                    />
                  )
                ) : activity.friends === null ? (
                  !activity.errors.friends && (
                    <ListSkeleton text="Loading your friends…" />
                  )
                ) : shownFriends.length ? (
                  <>
                    <p className="me-result-count">
                      {shownFriends.length}{" "}
                      {shownFriends.length === 1 ? "friend" : "friends"}
                    </p>
                    <ul className="me-people-list">
                      {shownFriends
                        .slice(0, limit)
                        .map((friend) =>
                          row(
                            friend.username,
                            friend.profilePhoto,
                            friend.online,
                            chatByFriend.get(friend.userId)?.lastMessage ||
                              "Say hello",
                            chatByFriend.get(friend.userId),
                            () => void openFriend(friend),
                            `friend-${friend.userId}`,
                            opening === friend.userId,
                          ),
                        )}
                    </ul>
                    {shownFriends.length > limit && (
                      <button
                        className="me-button me-button-outline me-show-more"
                        onClick={() => setLimit((value) => value + 24)}
                      >
                        Show more friends
                      </button>
                    )}
                  </>
                ) : (
                  <EmptyState
                    icon={peopleOutline}
                    title={
                      friendSearch
                        ? "No friends with that name"
                        : "Good company is closer than you think"
                    }
                    text={
                      friendSearch
                        ? "Try another name or clear your search."
                        : "Explore People and start building your circle."
                    }
                    action={friendSearch ? "Clear search" : "Explore People"}
                    onAction={() =>
                      friendSearch
                        ? setQueries((old) => ({ ...old, friends: "" }))
                        : history.push("/app/people")
                    }
                  />
                )}
                {activeTab === "friends" && (
                  <button
                    className="me-request-link"
                    onClick={() => history.push("/app/friends?tab=requests")}
                  >
                    <IonIcon icon={peopleOutline} />
                    View friend requests
                    <IonIcon icon={chevronForwardOutline} />
                  </button>
                )}
              </>
            )}
          </section>
        </main>
      </IonContent>
      <input
        ref={galleryInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => void upload(event)}
        aria-label="Upload profile photo"
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        hidden
        onChange={(event) => void upload(event)}
        aria-label="Take profile photo"
      />
      <IonActionSheet
        isOpen={photoPicker}
        header="Add a photo"
        onDidDismiss={() => setPhotoPicker(false)}
        buttons={[
          {
            text: "Take photo",
            icon: cameraOutline,
            handler: () => cameraInput.current?.click(),
          },
          {
            text: "Choose from gallery",
            icon: imagesOutline,
            handler: () => galleryInput.current?.click(),
          },
          { text: "Cancel", role: "cancel" },
        ]}
      />
      <ProfilePhotoViewer
        photos={photos}
        index={active ? viewer : null}
        primary={primaryPhoto}
        busy={photoBusy}
        onChange={setViewer}
        onClose={() => setViewer(null)}
        onMakePrimary={(url) => void makePrimary(url)}
      />
    </IonPage>
  );
}
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  return user ? (
    <ProfileContent key={user.publicId} user={user} refreshUser={refreshUser} />
  ) : (
    <IonPage className="linkup-me-page">
      <IonContent>
        <div className="me-empty" role="status">
          <IonSpinner />
          <p>Loading your profile…</p>
        </div>
      </IonContent>
    </IonPage>
  );
}
