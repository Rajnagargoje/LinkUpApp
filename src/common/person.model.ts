export interface Persons {
  publicId: string;
  name: string;
  age: number;
  profilePhoto?: string;
  distanceKm: number;
  online: boolean;
  verified?: boolean;
  meta?: string;
}

export type RelationshipStatus =
  | "SINGLE"
  | "IN_RELATIONSHIP"
  | "MARRIED"
  | "COMPLICATED"
  | "PREFER_NOT_TO_SAY";

// export type LookingFor =
//   | "FRIENDSHIP"
//   | "DATING"
//   | "RELATIONSHIP"
//   | "CHAT"
//   | "NETWORKING"
//   | "NOT_SURE";
export type LookingFor =
  | "FRIENDS"
  | "DATING"
  | "NETWORKING"
  | "RELATIONSHIP"
  | "CHAT"
  | "NOT_SURE";

export interface ProfilePhoto {
  id: string;
  url: string;
  isPrimary: boolean;
  order: number;
}

export interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
}

export interface ConnectionSummary {
  count: number;
  mutualCount: number;
}

export interface Person {
  photos: never[];
  id: string;
  username: string;
  name: string;
  age: number;
  gender?: "MALE" | "FEMALE" | "NON_BINARY" | "PREFER_NOT_TO_SAY";
  nationality?: string;
  bio?: string;
  distanceKm?: number;
  online: boolean;
  lastSeenAt?: string;
  isNewUser?: boolean;
  lookingFor: LookingFor | null;
  relationshipStatus?: RelationshipStatus;
  interests: string[];
  profilePhotos: ProfilePhoto[];
  postsCount: number;
  connections: ConnectionSummary;
  verified: boolean;
  connectionStatus: "NONE" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "CONNECTED";
  blocked: boolean;
  blockedByMe: boolean;
  blockedByUser: boolean;
  reportedByMe: boolean;
  accent?: "primary" | "secondary" | "success" | "warning";
}
