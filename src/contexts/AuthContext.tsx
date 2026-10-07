import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { App as NativeApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import toast from "react-hot-toast";
import { User } from "../common/user.model";
import * as userService from "../service/userService";

import { detachPushDevice } from "../service/pushService";
import {
  ensureFreshToken,
  flushRevocations,
  SessionResponse,
} from "../service/authSession";
import {
  getStoredUser,
  getToken,
  AUTH_SESSION_CHANGED,
  AUTH_LOGOUT_EVENT,
  initializeSessionStorage,
  queueRevocation,
  installSession,
  getSession,
  clearSession,
  getSessionEpoch,
  setStoredUser,
} from "../service/tokenStorage";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string,
  ) => Promise<User>;
  logout: (opts?: { silent?: boolean }) => void;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const authAttempt = useRef(0);

  useEffect(() => {
    let mounted = true;
    const sync = () => {
      if (mounted) {
        setUser(getStoredUser());
        setTokenState(getToken());
      }
    };
    const expired = () => {
      void detachPushDevice().catch(() => {});
      toast.error("Your sign-in has expired. Please log in again.");
    };
    window.addEventListener(AUTH_SESSION_CHANGED, sync);
    window.addEventListener(AUTH_LOGOUT_EVENT, expired);
    void (async () => {
      try {
        await initializeSessionStorage();
        try {
          await ensureFreshToken();
        } catch {
          /* Offline: preserve the cached session for retry. */
        }
        void flushRevocations();
        sync();
      } catch {
        if (mounted)
          toast.error(
            "Could not restore your saved sign-in. Please restart the app.",
          );
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    })();
    return () => {
      mounted = false;
      window.removeEventListener(AUTH_SESSION_CHANGED, sync);
      window.removeEventListener(AUTH_LOGOUT_EVENT, expired);
    };
  }, []);

  useEffect(() => {
    const renew = () => {
      if (document.visibilityState !== "hidden") {
        void ensureFreshToken().catch(() => {});
        void flushRevocations();
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") renew();
    };
    const interval = window.setInterval(renew, 30000);
    window.addEventListener("online", renew);
    window.addEventListener("linkup:app-resume", renew);
    document.addEventListener("visibilitychange", visible);
    const handle = Capacitor.isNativePlatform()
      ? NativeApp.addListener("appStateChange", (state) => {
          if (state.isActive) renew();
        })
      : null;
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", renew);
      window.removeEventListener("linkup:app-resume", renew);
      document.removeEventListener("visibilitychange", visible);
      if (handle)
        void handle.then((listener) => listener.remove()).catch(() => {});
    };
  }, []);

  const applySession = useCallback(
    async (session: SessionResponse, attempt: number) => {
      if (attempt !== authAttempt.current) {
        await queueRevocation(session.refreshToken);
        void flushRevocations();
        throw new Error("Sign-in was cancelled.");
      }
      if (!session.token || !session.refreshToken || !session.user?.publicId)
        throw new Error("Invalid sign-in response.");
      try {
        await installSession(session);
      } catch (error) {
        await queueRevocation(session.refreshToken);
        if (getSession()?.refreshToken === session.refreshToken)
          await clearSession();
        void flushRevocations();
        throw error;
      }
    },
    [],
  );
  const login = useCallback(
    async (username: string, password: string) => {
      const attempt = ++authAttempt.current;
      await initializeSessionStorage();
      const result = await userService.login({ username, password });
      await applySession(result.data.data, attempt);
    },
    [applySession],
  );
  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const attempt = ++authAttempt.current;
      await initializeSessionStorage();
      const result = await userService.register({ username, email, password });
      await applySession(result.data.data, attempt);
      return result.data.data.user;
    },
    [applySession],
  );
  const logout = useCallback((_opts?: { silent?: boolean }) => {
    ++authAttempt.current;
    // Capture the push credentials before clearing local sign-in immediately.
    void detachPushDevice().catch(() => {});
    void clearSession()
      .then(() => flushRevocations())
      .catch(() => {
        toast.error("Could not finish saving sign-out. Please try again.");
      });
  }, []);
  const deleteAccount = useCallback(async () => {
    const owner = getSessionEpoch();
    await detachPushDevice();
    await userService.deleteAccount();
    if (owner === getSessionEpoch()) {
      ++authAttempt.current;
      await clearSession();
      void flushRevocations();
    }
  }, []);
  const refreshUser = useCallback(async () => {
    const owner = getSessionEpoch();
    const response = await userService.getMe();
    if (owner === getSessionEpoch()) await setStoredUser(response.data.data);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isBootstrapping,
        login,
        register,
        logout,
        deleteAccount,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
