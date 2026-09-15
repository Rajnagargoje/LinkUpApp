import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WS_ENDPOINT } from "../config/api.config";

type ConnectionListener = (connected: boolean) => void;

/**
 * Thin wrapper around a single shared STOMP client so:
 *  - every screen (random chat, room chat, presence) reuses ONE
 *    authenticated socket instead of each opening its own,
 *  - the JWT is attached on every (re)connect automatically, so a
 *    freshly-logged-in user's socket is always authenticated the same
 *    way their REST calls are,
 *  - reconnects, subscriptions and teardown are handled in one place.
 *
 * Backend note: this assumes a Spring STOMP endpoint at /chat that reads
 * the token from the STOMP CONNECT "Authorization" header (typical when
 * you register a ChannelInterceptor on inbound CONNECT frames). If your
 * backend instead expects the token as a query param on the SockJS URL,
 * change the webSocketFactory below.
 */
class SocketService {
  private client: Client | null = null;
  private subscriptions = new Map<string, StompSubscription>();
  private listeners = new Set<ConnectionListener>();
  private currentToken: string | null = null;

  isConnected(): boolean {
    return !!this.client?.connected;
  }

  onConnectionChange(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(connected: boolean) {
    this.listeners.forEach((l) => l(connected));
  }

  connect(token: string | null): Promise<void> {
    // Already connected with the same token — nothing to do.
    if (this.client?.connected && this.currentToken === token) {
      return Promise.resolve();
    }

    // Token changed (e.g. re-login) — tear down the old socket first.
    if (this.client) {
      this.disconnect();
    }

    this.currentToken = token;

    return new Promise((resolve, reject) => {
      const client = new Client({
        webSocketFactory: () => new SockJS(WS_ENDPOINT),
        connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {}, // flip to console.log for verbose STOMP frames
      });

      client.onConnect = () => {
        this.notify(true);
        resolve();
      };

      client.onDisconnect = () => {
        this.notify(false);
      };

      client.onStompError = (frame) => {
        console.error("STOMP error:", frame.headers["message"], frame.body);
        reject(new Error(frame.headers["message"] || "STOMP error"));
      };

      client.onWebSocketError = (event) => {
        console.error("WebSocket error:", event);
      };

      this.client = client;
      client.activate();
    });
  }

  disconnect(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.client?.deactivate();
    this.client = null;
    this.currentToken = null;
    this.notify(false);
  }

  /**
   * Subscribe to a destination. Passing the same `key` again replaces
   * the previous subscription for that key (handy when a component
   * re-subscribes on prop changes, e.g. a new roomId).
   */
  subscribe(
    key: string,
    destination: string,
    onMessage: (body: any, raw: IMessage) => void
  ): void {
    if (!this.client?.connected) {
      console.warn(`socketService: not connected, cannot subscribe to ${destination}`);
      return;
    }
    this.subscriptions.get(key)?.unsubscribe();
    const sub = this.client.subscribe(destination, (message) => {
      try {
        onMessage(JSON.parse(message.body), message);
      } catch {
        onMessage(message.body, message);
      }
    });
    this.subscriptions.set(key, sub);
  }

  unsubscribe(key: string): void {
    this.subscriptions.get(key)?.unsubscribe();
    this.subscriptions.delete(key);
  }

  publish(destination: string, body: unknown): boolean {
    if (!this.client?.connected) {
      console.warn(`socketService: not connected, cannot publish to ${destination}`);
      return false;
    }
    this.client.publish({
      destination,
      body: JSON.stringify(body),
    });
    return true;
  }
}

// Single shared instance for the whole app.
const socketService = new SocketService();
export default socketService;
