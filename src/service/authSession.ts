import axios from "axios";
import { API_BASE_URL } from "../config/api.config";
import {
  StoredSession,
  SessionChangedError,
  initializeSessionStorage,
  getSession,
  getSessionEpoch,
  isTokenExpired,
  updateSession,
  clearSession,
  getPendingRevocations,
  removeRevocation,
  queueRevocation,
} from "./tokenStorage";

export const sessionHttp = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
});
export interface SessionResponse extends StoredSession {
  refreshToken: string;
  refreshExpiresAt: string;
}
export class SessionExpiredError extends Error {
  constructor() {
    super("Your sign-in has expired. Please log in again.");
  }
}
let flight: { epoch: number; promise: Promise<string> } | undefined;
let revokeFlight: Promise<void> | undefined;

function requestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function ensureFreshToken(
  force = false,
  rejectedToken?: string,
): Promise<string | null> {
  await initializeSessionStorage();
  const session = getSession();
  if (!session) return null;
  if (
    rejectedToken &&
    rejectedToken !== session.token &&
    !isTokenExpired(session.token)
  )
    return session.token;
  if (
    !force &&
    !session.pendingRefreshId &&
    !isTokenExpired(session.token, 60000)
  )
    return session.token;
  const owner = getSessionEpoch();
  if (!session.refreshToken) {
    if (!force && !isTokenExpired(session.token)) return session.token;
    await clearSession(true);
    throw new SessionExpiredError();
  }
  if (flight?.epoch === owner) return flight.promise;
  const promise = renew(session, owner);
  const pending = { epoch: owner, promise };
  flight = pending;
  try {
    return await promise;
  } finally {
    if (flight === pending) flight = undefined;
  }
}
async function renew(session: StoredSession, owner: number): Promise<string> {
  const id = session.pendingRefreshId ?? requestId();
  // Persist before sending, so process death or a dropped response can retry the same rotation.
  await updateSession({ ...session, pendingRefreshId: id }, owner);
  try {
    const result = await sessionHttp.post<{ data: SessionResponse }>(
      "/auth/session/refresh",
      {
        refreshToken: session.refreshToken,
        requestId: id,
      },
    );
    const next = result.data.data;
    if (
      !next?.token ||
      !next.refreshToken ||
      next.user?.publicId !== session.user.publicId
    )
      throw new Error("Invalid session response.");
    if (getSessionEpoch() !== owner) {
      await queueRevocation(next.refreshToken);
      void flushRevocations();
      throw new SessionChangedError();
    }
    await updateSession(
      {
        token: next.token,
        user: next.user,
        refreshToken: next.refreshToken,
        refreshExpiresAt: next.refreshExpiresAt,
      },
      owner,
    );
    return next.token;
  } catch (error) {
    // Network errors, 429 and server outages preserve credentials and allow a later retry.
    if (
      axios.isAxiosError(error) &&
      [401, 403].includes(error.response?.status ?? 0) &&
      getSessionEpoch() === owner &&
      getSession()?.refreshToken === session.refreshToken
    ) {
      await clearSession(true);
      throw new SessionExpiredError();
    }
    throw error;
  }
}
export async function flushRevocations(): Promise<void> {
  if (revokeFlight) return revokeFlight;
  revokeFlight = (async () => {
    for (const token of getPendingRevocations()) {
      try {
        await sessionHttp.post("/auth/session/logout", { refreshToken: token });
        await removeRevocation(token);
      } catch {
        break;
      } // Keep offline logouts queued for the next connection.
    }
  })();
  try {
    await revokeFlight;
  } finally {
    revokeFlight = undefined;
  }
}
