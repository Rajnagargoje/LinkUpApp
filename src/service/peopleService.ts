import { ENDPOINTS } from "../config/api.config";
import axiosClient from "./axiosClient";

export async function getPersonProfile(username: string) {
  return axiosClient.get(ENDPOINTS.getPersonProfile(username));
}
