import axios from "axios";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3000";

/** Адрес CRM — для impersonate-перехода (вход в компанию под владельцем). */
export const CRM_URL =
  (import.meta.env.VITE_CRM_URL as string | undefined) ??
  "http://localhost:5173";

const TOKEN_KEY = "tomstore_platform_token";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

/** Событие, по которому App сбрасывает сессию (истёк/невалиден токен). */
export const UNAUTH_EVENT = "platform-unauth";

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 401 && getToken()) {
      clearToken();
      window.dispatchEvent(new Event(UNAUTH_EVENT));
    }
    return Promise.reject(error);
  },
);
