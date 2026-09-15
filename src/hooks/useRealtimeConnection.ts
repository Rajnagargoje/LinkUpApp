import { useEffect, useState } from "react";
import socketService from "../service/socketService";
import { useAuth } from "../contexts/AuthContext";
import { STOMP } from "../config/api.config";

export interface PresenceEvent {
  username: string;
  status: "ONLINE" | "OFFLINE";
}

/**
 * Opens the shared authenticated socket while the user is logged in,
 * and tears it down (unsubscribing everything) as soon as they log out
 * or the app shell unmounts — so a "deleted"/logged-out user can never
 * keep receiving real-time events meant for their old session.
 */
export function useRealtimeConnection() {
  const { token, isAuthenticated, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated || !token) {
      socketService.disconnect();
      setIsConnected(false);
      return;
    }

    let cancelled = false;

    socketService
      .connect(token)
      .then(() => {
        if (cancelled) return;
        setIsConnected(true);

        socketService.subscribe(
          "presence",
          STOMP.presenceTopic,
          (body: PresenceEvent) => {
            setOnlineUsers((prev) => {
              const next = new Set(prev);
              if (body.status === "ONLINE") next.add(body.username);
              else next.delete(body.username);
              return next;
            });
          }
        );
      })
      .catch((err) => {
        console.error("Realtime connection failed:", err);
      });

    const unsubscribeConn = socketService.onConnectionChange(setIsConnected);

    return () => {
      cancelled = true;
      unsubscribeConn();
      socketService.disconnect();
    };
    // Reconnect whenever the token changes (fresh login) or auth drops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  return { isConnected, onlineUsers, currentUser: user };
}
