import axiosClient from "./axiosClient";
import { ENDPOINTS } from "../config/api.config";
import { ApiEnvelope } from "./userService";
import { ConnectionResponse } from "../common/connection.model";

/**
 * Send connection request
 */
export async function sendConnectionRequest(publicId: string) {
  return axiosClient.post<ApiEnvelope<ConnectionResponse>>(
    ENDPOINTS.sendConnectionRequest(publicId),
  );
}

/**
 * Get received friend requests
 */
export async function getReceivedRequests() {
  return axiosClient.get<ApiEnvelope<ConnectionResponse[]>>(
    ENDPOINTS.receivedRequests,
  );
}

/**
 * Get sent friend requests
 */
export async function getSentRequests() {
  return axiosClient.get<ApiEnvelope<ConnectionResponse[]>>(
    ENDPOINTS.sentRequests,
  );
}

/**
 * Accept friend request
 */
export async function acceptConnectionRequest(connectionId: number) {
  return axiosClient.post<ApiEnvelope<ConnectionResponse>>(
    ENDPOINTS.acceptConnection(connectionId),
  );
}

/**
 * Reject friend request
 */
export async function rejectConnectionRequest(connectionId: number) {
  return axiosClient.post<ApiEnvelope<void>>(
    ENDPOINTS.rejectConnection(connectionId),
  );
}

/**
 * Get current user's friends
 */
export async function getFriends() {
  return axiosClient.get<ApiEnvelope<ConnectionResponse[]>>(ENDPOINTS.friends);
}

/**
 * Get relationship status with another user
 */
export async function getConnectionStatus(publicId: string) {
  return axiosClient.get<ApiEnvelope<string>>(
    ENDPOINTS.connectionStatus(publicId),
  );
}

/**
 * Remove/unfriend a user
 */
export async function unfriend(publicId: string) {
  return axiosClient.delete<ApiEnvelope<void>>(ENDPOINTS.unfriend(publicId));
}
