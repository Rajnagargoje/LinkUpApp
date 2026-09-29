import axiosClient from "./axiosClient";

export interface SystemRoom {
  roomId: string;
  title: string;
  topic: string;
  description: string;
  rules: string[];
}

export const getSystemRoomsApi = () => axiosClient.get<SystemRoom[]>("/v1/rooms/system");
export const joinSystemRoomApi = (roomId: string) =>
  axiosClient.post<SystemRoom>(`/v1/rooms/system/${encodeURIComponent(roomId)}/join`);
export const createRoomApi = (roomId: string) => axiosClient.post("/v1/rooms", { roomId });
export const joinChatApi = (roomId: string) => axiosClient.get(`/v1/rooms/${encodeURIComponent(roomId)}`);
export const getMessagesApi = (roomId: string, size = 50, page = 0) =>
  axiosClient.get(`/v1/rooms/${encodeURIComponent(roomId)}/messages?size=${size}&page=${page}`);
