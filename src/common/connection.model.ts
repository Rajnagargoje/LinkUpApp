export type ConnectionStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type PersonConnectionStatus =
  | "NONE"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "CONNECTED";

export interface ConnectionResponse {
  connectionId: number;
  userId: string;
  username: string;
  profilePhoto?: string | null;
  age?: number | null;
  online: boolean;
  verified: boolean;
  status: ConnectionStatus;
  createdAt: string;
  acceptedAt?: string | null;
}
