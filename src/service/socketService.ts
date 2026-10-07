import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { WS_ENDPOINT } from "../config/api.config";
import { ensureFreshToken } from "./authSession";
import { decodeJwt, getToken } from "./tokenStorage";

type ConnectionListener = (connected: boolean) => void;
const identity = (token: string | null) => {
  const claims = token ? decodeJwt(token) : null;
  return claims ? `${claims.sub}:${claims.sid ?? "legacy"}` : null;
};
class SocketService {
  private client: Client | null = null;
  private subscriptions = new Map<string, StompSubscription>();
  private listeners = new Set<ConnectionListener>();
  private currentIdentity: string | null = null;
  private connecting: Promise<void> | null = null;
  private rejectConnection: ((error: Error) => void) | null = null;
  private authRetry: ReturnType<typeof setTimeout> | undefined;

  isConnected(): boolean {
    return !!this.client?.connected;
  }
  onConnectionChange(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify(connected: boolean) {
    this.listeners.forEach((listener) => listener(connected));
  }

  connect(token: string | null): Promise<void> {
    const owner = identity(token);
    if (this.client && owner === this.currentIdentity)
      return this.connecting ?? Promise.resolve();
    this.disconnect();
    this.currentIdentity = owner;
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_ENDPOINT),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
    });
    this.client = client;
    this.connecting = new Promise<void>((resolve, reject) => {
      this.rejectConnection = reject;
      client.beforeConnect = async () => {
        try {
          const fresh = await ensureFreshToken();
          if (this.client !== client || !fresh || identity(fresh) !== owner) {
            await client.deactivate();
            return;
          }
          client.connectHeaders = { Authorization: `Bearer ${fresh}` };
        } catch {
          // beforeConnect failures do not trigger STOMP's own reconnect timer.
          await client.deactivate();
          if (this.client === client && getToken()) {
            clearTimeout(this.authRetry);
            this.authRetry = setTimeout(() => {
              if (this.client === client) client.activate();
            }, 5000);
          }
        }
      };
      client.onConnect = () => {
        if (this.client !== client) {
          void client.deactivate();
          return;
        }
        this.rejectConnection = null;
        this.notify(true);
        resolve();
      };
      client.onDisconnect = () => {
        if (this.client === client) this.notify(false);
      };
      client.onWebSocketClose = () => {
        if (this.client !== client) return;
        this.subscriptions.clear();
        this.notify(false);
      };
      client.onStompError = () => {
        if (this.client !== client) return;
        // A revoked session is detected by refresh; an outage keeps the login intact.
        void ensureFreshToken(true).catch(() => {});
      };
    });
    client.activate();
    return this.connecting;
  }
  disconnect(): void {
    clearTimeout(this.authRetry);
    const client = this.client;
    this.client = null;
    this.currentIdentity = null;
    this.connecting = null;
    this.rejectConnection?.(new Error("Chat connection closed."));
    this.rejectConnection = null;
    this.subscriptions.forEach((sub) => {
      try {
        sub.unsubscribe();
      } catch {
        /* Already closed. */
      }
    });
    this.subscriptions.clear();
    if (client) void client.deactivate();
    this.notify(false);
  }
  subscribe(
    key: string,
    destination: string,
    onMessage: (body: any, raw: IMessage) => void,
  ): void {
    if (!this.client?.connected) return;
    this.subscriptions.get(key)?.unsubscribe();
    this.subscriptions.set(
      key,
      this.client.subscribe(destination, (message) => {
        let body: unknown;
        try {
          body = JSON.parse(message.body);
        } catch {
          body = message.body;
        }
        onMessage(body, message);
      }),
    );
  }
  unsubscribe(key: string): void {
    if (this.client?.connected) this.subscriptions.get(key)?.unsubscribe();
    this.subscriptions.delete(key);
  }
  publish(destination: string, body: unknown): boolean {
    if (!this.client?.connected) return false;
    this.client.publish({ destination, body: JSON.stringify(body) });
    return true;
  }
}
export default new SocketService();
