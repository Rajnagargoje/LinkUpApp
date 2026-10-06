export type Phase = "idle" | "waiting" | "matched" | "ended";
export type PartnerKind = "HUMAN" | "AI";
export type ConnectionStatus =
  | "NONE"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "CONNECTED";
export interface Preferences {
  language: string;
  interests: string[];
  aiFallback: boolean;
}
export interface ChatMessage {
  id: string;
  clientId?: string;
  sender: string;
  senderId?: string;
  content: string;
  timeStamp: string;
  mine?: boolean;
  status?: "sending" | "sent" | "failed";
}
export interface Companion {
  personaId: string;
  name: string;
  color: string;
  updatedAt: string;
}
export interface Partner {
  name: string;
  kind: PartnerKind;
  guest: boolean;
  publicId?: string;
  personaId?: string;
  color?: string;
  personaProfile?: string;
  sharedInterests: string[];
}
export interface ChatEvent extends Partial<ChatMessage> {
  type: string;
  matchId?: string;
  selfId?: string;
  partner?: string;
  partnerKind?: PartnerKind;
  partnerGuest?: boolean;
  partnerPublicId?: string;
  personaId?: string;
  personaColor?: string;
  personaProfile?: string;
  sharedInterests?: string[];
  messages?: ChatMessage[];
  companions?: Companion[];
  message?: string;
  typing?: boolean;
  saved?: boolean;
  searching?: boolean;
  retryReply?: boolean;
  aiAvailable?: boolean;
  fallbackSeconds?: number;
  offerId?: string;
  expiresAt?: string;
  connectionStatus?: ConnectionStatus;
}
