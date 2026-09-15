import { STORAGE_KEYS } from "../config/api.config";
import { User } from "../common/user.model";

/**
 * All token / session persistence goes through here.
 *
 * Security note: localStorage is used because it's what the rest of the
 * app already relied on and it works everywhere Capacitor runs. It is
 * readable by any JS on the page, so it's not immune to XSS. For a
 * production mobile build, swap the get/set/clear bodies below for
 * `@capacitor/preferences` (or `capacitor-secure-storage-plugin` if you
 * need hardware-backed storage) — nothing outside this file would need
 * to change.
 */

interface DecodedToken {
  sub?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.token, token);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
}

/**
 * Decode a JWT payload WITHOUT verifying the signature. This is only
 * ever used client-side to read the expiry / username for UX purposes
 * (auto-logout, greeting text). The backend must always re-verify the
 * signature on every request — never trust this decoded value for
 * authorization decisions.
 */
export function decodeJwt(token: string): DecodedToken | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const decoded = decodeJwt(token);
  if (!decoded?.exp) return true;
  // exp is in seconds since epoch; give a 5s clock-skew buffer.
  return decoded.exp * 1000 <= Date.now() + 5000;
}

export function getUsernameFromToken(token: string | null): string | null {
  if (!token) return null;
  return decodeJwt(token)?.sub ?? null;
}
