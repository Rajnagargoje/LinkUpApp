import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import toast from "react-hot-toast";
import { User } from "../common/user.model";
import * as userService from "../service/userService";
import {
  clearSession,
  getStoredUser,
  getToken,
  isTokenExpired,
  setStoredUser,
  setToken,
} from "../service/tokenStorage";
import { AUTH_LOGOUT_EVENT } from "../service/axiosClient";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  // true only while we're validating a stored session on first load —
  // used to show the splash screen instead of flashing the login page.
  isBootstrapping: boolean;
  login: (username: string, password: string) => Promise<void>;
  // Returns the freshly-created user — callers (SignUpPage) use this to
  // decide where to route next (email verification, onboarding) without
  // waiting on a state update to land first.
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

  const applySession = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setStoredUser(newUser);
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback((opts?: { silent?: boolean }) => {
    const clearLocalSession = () => {
      clearSession();
      setTokenState(null);
      setUser(null);
    };

    if (opts?.silent) {
      clearLocalSession();
      return;
    }

    userService
      .logout()
      .catch(() => {})
      .finally(clearLocalSession);
  }, []);

  // Bootstrap: validate whatever is in storage before deciding which
  // route (login vs app) to render. Prevents a flash of the home screen
  // for a dead/expired token, and prevents a flash of the login screen
  // for a perfectly valid one.
  useEffect(() => {
    const storedToken = getToken();
    const storedUser = getStoredUser();

    if (storedToken && storedUser && !isTokenExpired(storedToken)) {
      setTokenState(storedToken);
      setUser(storedUser);
    } else {
      clearSession();
    }
    setIsBootstrapping(false);
  }, []);

  // React to forced logouts triggered anywhere in the app (401/403 from
  // axiosClient, or an expired-token check from another browser tab).
  useEffect(() => {
    const handleForcedLogout = () => {
      logout({ silent: true });
      toast.error("Your session has expired. Please log in again.");
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);

    const handleStorageChange = (e: StorageEvent) => {
      // Another tab logged out / logged in — stay in sync.
      if (e.key === "linkup_token" && !e.newValue) {
        setTokenState(null);
        setUser(null);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [logout]);

  // Passive session-expiry watchdog: catches an idle tab whose token
  // expires while nobody makes an API call to trigger the 401 path.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (isTokenExpired(token)) {
        logout({ silent: true });
        toast.error("Your session has expired. Please log in again.");
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [token, logout]);

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await userService.login({ username, password });
      const jwt = response.data.data;
      setToken(jwt);
      setTokenState(jwt);

      // We only get a raw token back from /login, not a user object, so
      // fetch the profile right after so the UI has a name/email/status.
      // No fallback here anymore — /me is a real, guaranteed endpoint
      // now, so if this fails the login attempt should surface as a
      // real error rather than quietly logging someone in with a
      // half-empty, type-unsafe placeholder user.
      const me = await userService.getMe();
      applySession(jwt, me.data.data);
    },
    [applySession],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      // Register now returns { user, token } in one call — no separate
      // login/getMe round trip needed, so onboarding, email
      // verification, and photo upload can all run authenticated from
      // the very first screen after signup.
      const response = await userService.register({
        username,
        email,
        password,
      });
      const { user: newUser, token: jwt } = response.data.data;
      applySession(jwt, newUser);
      return newUser;
    },
    [applySession],
  );

  const deleteAccount = useCallback(async () => {
    await userService.deleteAccount();
    clearSession();
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await userService.getMe();
    setUser(me.data.data);
    setStoredUser(me.data.data);
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isBootstrapping,
    login,
    register,
    logout,
    deleteAccount,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
