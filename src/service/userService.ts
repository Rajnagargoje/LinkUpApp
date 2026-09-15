import { User } from "../common/user.model";
import axiosClient from "./axiosClient";
import { ENDPOINTS } from "../config/api.config";

export interface LoginPayload {
  username: string; // accepted as either username OR email by the backend
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface ApiEnvelope<T> {
  status: number;
  message: string;
  data: T;
}

export interface RegisterResponseData {
  user: User;
  token: string;
}

export interface UsernameAvailability {
  available: boolean;
  suggestions: string[];
}

/**
 * POST /api/user/login
 * Backend returns { status, message, data: "<jwt>" } — data is the raw
 * token string, not an object.
 */
export async function login(payload: LoginPayload) {
  return axiosClient.post<ApiEnvelope<string>>(ENDPOINTS.login, payload);
}

/**
 * POST /api/user/register
 * Now returns a token immediately alongside the created user, so the
 * frontend never needs a separate login call right after signup —
 * onboarding, email verification, and photo upload all need an
 * authenticated session from the very first screen.
 */
export async function register(payload: RegisterPayload) {
  return axiosClient.post<ApiEnvelope<RegisterResponseData>>(
    ENDPOINTS.register,
    payload
  );
}

/**
 * GET /api/user/check-username?username=...
 * Public — no auth required, runs during signup before an account exists.
 */
export async function checkUsernameAvailability(username: string) {
  return axiosClient.get<ApiEnvelope<UsernameAvailability>>(
    ENDPOINTS.checkUsername,
    { params: { username } }
  );
}

/**
 * GET current logged-in user's profile. Token is attached automatically
 * by axiosClient's request interceptor.
 */
export async function getMe() {
  return axiosClient.get<ApiEnvelope<User>>(ENDPOINTS.me);
}

/**
 * PATCH /api/user/me — profile completion (onboarding) and later
 * profile edits. Only send fields that are actually changing; the
 * backend leaves anything omitted/undefined untouched.
 */
export interface UpdateProfilePayload {
  dob?: string; // ISO date yyyy-MM-dd
  gender?: string;
  bio?: string;
  profilePhoto?: string;
  photos?: string[];
  interests?: string[];
  lookingFor?: string;
  genderPreference?: string[];
  minAgePreference?: number;
  maxAgePreference?: number;
  maxDistanceKm?: number;
}

export async function updateProfile(payload: UpdateProfilePayload) {
  return axiosClient.patch<ApiEnvelope<User>>(
    ENDPOINTS.updateProfile,
    payload
  );
}

/**
 * Best-effort server-side logout (flips status -> OFFLINE). JWTs are
 * stateless, so the client-side token wipe in AuthContext is what
 * actually matters — this call is allowed to fail silently.
 */
export async function logout() {
  return axiosClient.post(ENDPOINTS.logout);
}

/**
 * DELETE the current user's account (soft-delete server-side).
 */
export async function deleteAccount() {
  return axiosClient.delete(ENDPOINTS.deleteAccount);
}

/**
 * PATCH /api/user/status?status=ONLINE|OFFLINE|BUSY
 * The backend reads this as a query param, NOT a JSON body.
 */
export async function updateStatus(status: "ONLINE" | "OFFLINE" | "BUSY") {
  return axiosClient.patch(ENDPOINTS.updateStatus, null, {
    params: { status },
  });
}

/**
 * POST /api/auth/email/send-code — no body, sends to whichever email
 * the current token belongs to.
 */
export async function sendEmailVerificationCode() {
  return axiosClient.post(ENDPOINTS.sendEmailCode);
}

export async function verifyEmailCode(code: string) {
  return axiosClient.post(ENDPOINTS.verifyEmailCode, { code });
}

/**
 * POST /api/user/me/photos — multipart upload. Appends server-side to
 * the user's photo list and returns the updated profile, so there's no
 * need for a follow-up PATCH /me after each photo.
 */
export async function uploadPhoto(file: File | Blob, onProgress?: (pct: number) => void) {
  const formData = new FormData();
  formData.append("file", file);
  // Deliberately NOT setting Content-Type here — the browser needs to
  // generate it itself (multipart/form-data; boundary=...). Setting it
  // manually without a boundary means the backend can't parse the body
  // at all and every upload fails.
  return axiosClient.post<ApiEnvelope<User>>(ENDPOINTS.photos, formData, {
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
}

export async function deletePhoto(url: string) {
  return axiosClient.delete<ApiEnvelope<User>>(ENDPOINTS.photos, {
    params: { url },
  });
}

export async function updateLocation(
  username: string,
  latitude: number,
  longitude: number
) {
  return axiosClient.post(ENDPOINTS.updateLocation(username), {
    latitude,
    longitude,
  });
}

export async function getNearbyPeople(username: string, radius: number = 10) {
  return axiosClient.get(ENDPOINTS.nearbyPeople(username), {
    params: { radius },
  });
}
