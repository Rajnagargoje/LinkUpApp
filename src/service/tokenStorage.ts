import { STORAGE_KEYS } from "../config/api.config";
import { User } from "../common/user.model";
import { readSessionVault, writeSessionVault } from "./sessionVault";

export const AUTH_SESSION_CHANGED = "linkup:session-changed";
export const AUTH_LOGOUT_EVENT = "linkup:auth-logout";
export interface StoredSession {
  token: string;
  user: User;
  refreshToken?: string;
  refreshExpiresAt?: string;
  pendingRefreshId?: string;
}
interface VaultState {
  session: StoredSession | null;
  revocations: string[];
}
let state: VaultState = { session: null, revocations: [] };
let initialized = false;
let initialization: Promise<void> | undefined;
let writes: Promise<void> = Promise.resolve();
let epoch = 0;

export class SessionChangedError extends Error {
  constructor() {
    super("The signed-in session changed.");
  }
}
const changed = () => window.dispatchEvent(new Event(AUTH_SESSION_CHANGED));
function persist(): Promise<void> {
  const snapshot = JSON.stringify(state);
  const write = writes.catch(() => {}).then(() => writeSessionVault(snapshot));
  writes = write;
  return write;
}
export function initializeSessionStorage(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initialization) return initialization;
  initialization = (async () => {
    const raw = await readSessionVault();
    if (raw) {
      const saved = JSON.parse(raw) as VaultState;
      if (
        saved.session &&
        (!saved.session.token || !saved.session.user?.publicId)
      )
        throw new Error("Invalid saved sign-in.");
      state = {
        session: saved.session ?? null,
        revocations: Array.isArray(saved.revocations) ? saved.revocations : [],
      };
    } else {
      // Older APKs have no refresh credential. Keep a still-valid login until
      // it expires; the next password login enables renewable sessions.
      const token = localStorage.getItem(STORAGE_KEYS.token);
      const rawUser = localStorage.getItem(STORAGE_KEYS.user);
      let user: User | null = null;
      try {
        user = rawUser ? JSON.parse(rawUser) : null;
      } catch {
        /* No usable legacy profile. */
      }
      if (token && user?.publicId && !isTokenExpired(token))
        state.session = { token, user };
      await persist();
    }
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    initialized = true;
  })().finally(() => {
    initialization = undefined;
  });
  return initialization;
}
export const getSession = () => state.session;
export const getSessionEpoch = () => epoch;
export const getToken = () => state.session?.token ?? null;
export const getStoredUser = () => state.session?.user ?? null;
export const getPendingRevocations = () => [...state.revocations];

export async function installSession(session: StoredSession): Promise<void> {
  const current = ++epoch;
  state = { ...state, session };
  await persist();
  if (current !== epoch) throw new SessionChangedError();
  changed();
}
export async function updateSession(
  session: StoredSession,
  expectedEpoch: number,
): Promise<void> {
  if (epoch !== expectedEpoch) throw new SessionChangedError();
  state = { ...state, session };
  await persist();
  if (epoch !== expectedEpoch) throw new SessionChangedError();
  changed();
}
export async function setStoredUser(user: User): Promise<void> {
  const session = getSession();
  if (session && session.user.publicId === user.publicId)
    await updateSession({ ...session, user }, epoch);
}
export function clearSession(expired = false): Promise<void> {
  ++epoch;
  const token = state.session?.refreshToken;
  const revocations = token
    ? [...new Set([...state.revocations, token])].slice(-50)
    : state.revocations;
  state = { session: null, revocations };
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  changed();
  if (expired) window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  return persist();
}
export function queueRevocation(token: string): Promise<void> {
  state = {
    ...state,
    revocations: [...new Set([...state.revocations, token])].slice(-50),
  };
  return persist();
}
export function removeRevocation(token: string): Promise<void> {
  state = {
    ...state,
    revocations: state.revocations.filter((value) => value !== token),
  };
  return persist();
}

interface DecodedToken {
  sub?: string;
  exp?: number;
  sid?: string;
  [key: string]: unknown;
}
export function decodeJwt(token: string): DecodedToken | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    return JSON.parse(
      decodeURIComponent(
        Array.from(atob(padded))
          .map((char) => "%" + char.charCodeAt(0).toString(16).padStart(2, "0"))
          .join(""),
      ),
    );
  } catch {
    return null;
  }
}
export function isTokenExpired(token: string | null, bufferMs = 5000): boolean {
  const expiry = token ? decodeJwt(token)?.exp : undefined;
  return !expiry || expiry * 1000 <= Date.now() + bufferMs;
}
export const getUsernameFromToken = (token: string | null) =>
  token ? (decodeJwt(token)?.sub ?? null) : null;
