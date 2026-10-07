import axios from "axios";
import { API_BASE_URL } from "../config/api.config";
import { ensureFreshToken } from "./authSession";
import {
  clearSession,
  getSessionEpoch,
  getToken,
  SessionChangedError,
} from "./tokenStorage";
export { AUTH_LOGOUT_EVENT } from "./tokenStorage";

declare module "axios" {
  interface AxiosRequestConfig {
    _sessionEpoch?: number;
    _authRetried?: boolean;
  }
}
export const baseURL = API_BASE_URL;
const axiosClient = axios.create({ baseURL, timeout: 15000 });

axiosClient.interceptors.request.use(async (config) => {
  const owner = config._sessionEpoch ?? getSessionEpoch();
  const token = await ensureFreshToken();
  if (owner !== getSessionEpoch()) throw new SessionChangedError();
  config._sessionEpoch = owner;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const sent = config?.headers?.Authorization;
    if (
      error.response?.status !== 401 ||
      !config ||
      typeof sent !== "string" ||
      !sent.startsWith("Bearer ") ||
      config._sessionEpoch !== getSessionEpoch()
    )
      throw error;
    if (config._authRetried) {
      if (sent === `Bearer ${getToken()}`) await clearSession(true);
      throw error;
    }
    config._authRetried = true;
    const token = await ensureFreshToken(true, sent.slice(7));
    if (!token || config._sessionEpoch !== getSessionEpoch()) throw error;
    config.headers.Authorization = `Bearer ${token}`;
    return axiosClient.request(config);
  },
);
export default axiosClient;
