import axios from "axios";
import { API_BASE_URL } from "../config/api.config";
import { getToken } from "./tokenStorage";

export const baseURL = API_BASE_URL;

// Fired whenever the backend tells us the session is no longer valid
// (401/403). AuthContext listens for this and clears state + redirects,
// so ANY screen making an API call gets a consistent forced-logout,
// not just the one that happened to trigger the request.
export const AUTH_LOGOUT_EVENT = "linkup:auth-logout";

const axiosClient = axios.create({
  baseURL,
  timeout: 15000,
});

axiosClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    // Standard bearer scheme — matches what the backend's login endpoint
    // issues and what Spring Security expects in the Authorization header.
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      // Session expired / invalid / revoked. Let AuthContext handle
      // clearing storage + redirecting — we just broadcast it here so
      // every caller (chat pages, settings, etc.) reacts the same way.
      window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
    }

    // Always reject so the calling code's try/catch actually runs —
    // silently swallowing 401s here previously meant callers thought
    // requests had "succeeded" with `undefined`.
    return Promise.reject(error);
  }
);

export default axiosClient;
