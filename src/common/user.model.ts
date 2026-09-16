export type Role = "USER" | "ADMIN";
export type UserStatus = "ONLINE" | "OFFLINE" | "BUSY" | string;
export type Gender = "MALE" | "FEMALE" | "NON_BINARY" | "PREFER_NOT_TO_SAY";
export type LookingFor = "FRIENDS" | "DATING" | "NETWORKING" | "NOT_SURE";

export interface User {
  publicId: string;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  online: boolean;
  lastSeenAt: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;

  dob: string | null; // ISO date (yyyy-MM-dd)
  age: number | null;
  gender: Gender | null;
  bio: string | null;
  profilePhoto: string | null;
  photos: string[];
  interests: string[];
  onboardingCompleted: boolean;

  lookingFor: LookingFor | null;
  genderPreference: Gender[];
  minAgePreference: number | null;
  maxAgePreference: number | null;
  maxDistanceKm: number | null;

  latitude: number | null;
  longitude: number | null;
  locationVisible: boolean;

  createdAt: string;
}
