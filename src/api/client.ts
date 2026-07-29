import axios from "axios";

/**
 * Абсолютный адрес из env. Частая ошибка в Vercel — задать голый хост без
 * `https://` (`tomstore-crm-backend-...up.railway.app`): тогда axios/`window.open`
 * трактуют его как ОТНОСИТЕЛЬНЫЙ путь и клеят к домену Vercel → 404 на
 * `/api/platform/login`. Нормализуем: нет протокола → подставляем `https://`,
 * снимаем хвостовые слэши.
 */
const absoluteUrl = (raw: string | undefined, fallback: string): string => {
  const v = (raw ?? "").trim();
  if (!v) return fallback;
  if (/^https?:\/\//i.test(v)) return v.replace(/\/+$/, "");
  return `https://${v.replace(/^\/+/, "").replace(/\/+$/, "")}`;
};

const API_URL = absoluteUrl(
  import.meta.env.VITE_API_URL as string | undefined,
  "http://localhost:3000",
);

/** Адрес CRM — для impersonate-перехода (вход в компанию под владельцем). */
export const CRM_URL = absoluteUrl(
  import.meta.env.VITE_CRM_URL as string | undefined,
  "http://localhost:5173",
);

const TOKEN_KEY = "tomstore_platform_token";
const PERMS_KEY = "tomstore_platform_perms";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PERMS_KEY);
};

// ── Права текущего админа (для скрытия/блокировки действий в UI) ──────────────
let permsCache: string[] | null = null;

export const setPermissions = (perms: string[]): void => {
  permsCache = perms;
  localStorage.setItem(PERMS_KEY, JSON.stringify(perms));
};

export const getPermissions = (): string[] => {
  if (permsCache) return permsCache;
  try {
    permsCache = JSON.parse(localStorage.getItem(PERMS_KEY) || "[]");
  } catch {
    permsCache = [];
  }
  return permsCache ?? [];
};

/** Есть ли право (или полный доступ "*"). UI-скрытие — не защита (бэкенд гейтит). */
export const can = (perm: string): boolean => {
  const list = getPermissions();
  return list.includes("*") || list.includes(perm);
};

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
