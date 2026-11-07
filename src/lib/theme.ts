import { theme as antdTheme, type ThemeConfig } from "antd";
import { useSyncExternalStore } from "react";

/**
 * Тема панели: светлая, тёмная (графит), чёрная (OLED — настоящий чёрный)
 * или как в системе. Выбор хранится в браузере; системная следит за
 * prefers-color-scheme. Цвета своих стилей — CSS-переменные в index.css
 * (html[data-theme=…]), antd — алгоритм и токены ниже.
 */
export type ThemeMode = "light" | "dark" | "black" | "system";
export type ResolvedTheme = "light" | "dark" | "black";

const KEY = "tomstore_platform_theme";
const EVENT = "platform-theme";
const media = () =>
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

export const readMode = (): ThemeMode => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "black" || v === "system")
      return v;
  } catch {
    /* приватный режим — по умолчанию */
  }
  return "light";
};

export const resolve = (mode: ThemeMode): ResolvedTheme =>
  mode === "system" ? (media()?.matches ? "dark" : "light") : mode;

/** Ставит data-theme на <html> — до первой отрисовки, без вспышки белого. */
export const applyTheme = (mode: ThemeMode = readMode()): ResolvedTheme => {
  const r = resolve(mode);
  document.documentElement.dataset.theme = r;
  document.documentElement.style.colorScheme = r === "light" ? "light" : "dark";
  return r;
};

export const setMode = (mode: ThemeMode): void => {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* не запомним — применим на сессию */
  }
  applyTheme(mode);
  window.dispatchEvent(new Event(EVENT));
};

const subscribe = (cb: () => void) => {
  const m = media();
  const onSystem = () => {
    if (readMode() === "system") {
      applyTheme("system");
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  m?.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, cb);
    m?.removeEventListener("change", onSystem);
  };
};

/** Текущий режим и итоговая тема (системная уже раскрыта). */
export const useTheme = (): { mode: ThemeMode; resolved: ResolvedTheme } => {
  const mode = useSyncExternalStore(subscribe, readMode, () => "light" as ThemeMode);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolve(readMode()),
    () => "light" as ResolvedTheme,
  );
  return { mode, resolved };
};

const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const BASE_TOKEN = {
  colorPrimary: "#2a78d6",
  colorLink: "#2a78d6",
  borderRadius: 8,
  fontFamily: FONT,
};

/** Тема antd под итоговый режим. */
export const antdThemeFor = (t: ResolvedTheme): ThemeConfig => {
  if (t === "light")
    return {
      token: { ...BASE_TOKEN, colorBgLayout: "#f4f6fa" },
      components: {
        Table: { headerBg: "#f8fafc", headerColor: "#475569", rowHoverBg: "#f5f8fd" },
        Card: { borderRadiusLG: 12 },
      },
    };
  const black = t === "black";
  return {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      ...BASE_TOKEN,
      colorPrimary: "#3987e5",
      colorLink: "#6da7ec",
      colorBgLayout: black ? "#000000" : "#0f1520",
      colorBgContainer: black ? "#0b0b0c" : "#161e2b",
      colorBgElevated: black ? "#141416" : "#1d2635",
      colorBorder: black ? "#26262a" : "#2b3646",
      colorBorderSecondary: black ? "#1c1c1f" : "#232d3c",
    },
    components: {
      Table: {
        headerBg: black ? "#111113" : "#1a2331",
        headerColor: "#aab6c6",
        rowHoverBg: black ? "#151518" : "#1c2636",
      },
      Card: { borderRadiusLG: 12 },
      // Дерево модулей в окнах — на фоне окна, без своей подложки.
      Tree: { colorBgContainer: "transparent" },
    },
  };
};
