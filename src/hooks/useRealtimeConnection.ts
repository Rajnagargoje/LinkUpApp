import { useEffect, useState } from "react";
import socketService from "../service/socketService";
import { useAuth } from "../contexts/AuthContext";
import { decodeJwt } from "../service/tokenStorage";
import { STOMP } from "../config/api.config";

export interface PresenceEvent {
  username: string;
  status: "ONLINE" | "OFFLINE";
}
export function useRealtimeConnection() {
  const { token, isAuthenticated, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const sessionId = token ? (decodeJwt(token)?.sid ?? "legacy") : null;

  useEffect(() => {
    setOnlineUsers(new Set());
    if (!isAuthenticated || !token) {
      socketService.disconnect();
      setIsConnected(false);
      return;
    }
    let cancelled = false;
    const connectionChanged = (connected: boolean) => {
      if (cancelled) return;
      setIsConnected(connected);
      if (connected)
        socketService.subscribe(
          "presence",
          STOMP.presenceTopic,
          (event: PresenceEvent) => {
            setOnlineUsers((previous) => {
              const next = new Set(previous);
              if (event.status === "ONLINE") next.add(event.username);
              else next.delete(event.username);
              return next;
            });
          },
        );
    };
    const unsubscribe = socketService.onConnectionChange(connectionChanged);
    void socketService
      .connect(token)
      .then(() => {
        if (!cancelled && socketService.isConnected()) connectionChanged(true);
      })
      .catch(() => {
        if (!cancelled) setIsConnected(false);
      });
    return () => {
      cancelled = true;
      unsubscribe();
      socketService.disconnect();
    };
    // Renewal keeps the same session ID. Only a different login replaces the socket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.publicId, sessionId]);
  return { isConnected, onlineUsers, currentUser: user };
}
