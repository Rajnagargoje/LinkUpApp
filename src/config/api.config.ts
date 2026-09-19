/**
 * Central place for every backend URL / endpoint / storage key.
 *
 * If your Spring Boot backend uses different route names, this is the
 * ONLY file you should need to touch — everything else (axiosClient,
 * userService, socketService, AuthContext) reads from here.
 */

// Base host used for both REST calls and the WebSocket (SockJS) handshake.
// In production, drive this from an env var (import.meta.env.VITE_API_HOST)
// instead of hardcoding localhost. Also note: this won't resolve from a
// real device/emulator — you'll need your machine's LAN IP (or 10.0.2.2
// for the Android emulator) once you're off the browser.
export const API_HOST = "http://localhost:8081";

export const API_BASE_URL = `${API_HOST}/api`;

// SockJS connects over http(s), not ws(s) — it upgrades internally.
export const WS_ENDPOINT = `${API_HOST}/chat`;

export const ENDPOINTS = {
  register: "/user/register",
  login: "/user/login",
  checkUsername: "/user/check-username",
  me: "/user/me",
  updateProfile: "/user/me",
  logout: "/user/logout",
  deleteAccount: "/user/me",
  updateStatus: "/user/status",
  photos: "/user/me/photos",

  sendEmailCode: "/auth/email/send-code",
  verifyEmailCode: "/auth/email/verify-code",

  updateLocation: (username: string) => `/users/${username}/location`,

  nearbyPeople: (username: string) => `/people/${username}/nearby`,

  getPersonProfile: (username: string) => `/people/${username}`,

  // -----------------------------
  // CONNECTIONS
  // -----------------------------

  sendConnectionRequest: (publicId: string) =>
    `/connections/request/${publicId}`,

  receivedRequests: "/connections/requests",

  sentRequests: "/connections/sent",

  acceptConnection: (connectionId: number) =>
    `/connections/${connectionId}/accept`,

  rejectConnection: (connectionId: number) =>
    `/connections/${connectionId}/reject`,

  friends: "/connections/friends",

  connectionStatus: (publicId: string) => `/connections/status/${publicId}`,

  unfriend: (publicId: string) => `/connections/${publicId}`,

  // -----------------------------
  // FRIEND CHAT
  // -----------------------------

  conversations: "/conversations",

  directConversation: (friendPublicId: string) =>
    `/conversations/direct/${friendPublicId}`,

  conversationMessages: (conversationId: number) =>
    `/conversations/${conversationId}/messages`,

  markConversationRead: (conversationId: number) =>
    `/conversations/${conversationId}/read`,

  message: (messageId: number) => `/conversations/messages/${messageId}`,

  markMessageDelivered: (messageId: number) =>
    `/conversations/messages/${messageId}/delivered`,

  markMessageRead: (messageId: number) =>
    `/conversations/messages/${messageId}/read`,
};

// STOMP destinations used by socketService. Adjust to match your
// @MessageMapping / @SendTo annotations on the backend if they differ.
export const STOMP = {
  presenceTopic: "/topic/presence",
  personalQueue: (username: string) => `/user/${username}/queue/messages`,
  sendDirectMessage: "/app/chat.send",
  friendConversationQueue: (conversationId: number) =>
    `/user/queue/conversations/${conversationId}`,
  roomTopic: (roomId: string) => `/topic/room/${roomId}`,
  sendRoomMessage: (roomId: string) => `/app/sendMessage/${roomId}`,
};

export const STORAGE_KEYS = {
  token: "linkup_token",
  user: "linkup_user",
};

// Matches the backend's actual policy exactly (UpdateProfileDTO/
// RegisterUserDTO validation) — the backend only accepts these specific
// symbols, not "any non-word character" like an earlier, looser version
// of this regex allowed. Keep these in sync if the backend policy changes.
export const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$%^&+=!]).{8,}$/;

export const USERNAME_MIN_LENGTH = 4; // backend rejects shorter than this
export const USERNAME_MAX_LENGTH = 20;

export const MAX_PHOTOS = 6; // matches backend's UpdateProfileDTO + PhotoController cap
export const MAX_PHOTO_SIZE_MB = 5;
