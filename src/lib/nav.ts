/**
 * Навигация панели платформы: разделы, группы меню и адрес (?view=…).
 * Раздел живёт в адресе — F5, «Назад» и ссылка коллеге открывают тот же экран.
 * Хост статический (без SPA-fallback на пути), поэтому — параметр, а не путь.
 */

export type View =
  | "home"
  | "tenants"
  | "analytics"
  | "tariffs"
  | "billing"
  | "industries"
  | "templates"
  | "integrations"
  | "audit"
  | "admins"
  | "support";

export type NavItem = { key: View; label: string; hint: string };
export type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Работа",
    items: [
      { key: "home", label: "Обзор", hint: "Что требует действия сейчас" },
      { key: "tenants", label: "Компании", hint: "Все компании, карточка, доступ" },
      { key: "support", label: "Поддержка", hint: "Обращения клиентов" },
    ],
  },
  {
    title: "Деньги",
    items: [
      { key: "billing", label: "Биллинг", hint: "Счета, оплаты, вебхуки" },
      { key: "tariffs", label: "Тарифы", hint: "Цены, лимиты, опции" },
      { key: "analytics", label: "Аналитика", hint: "MRR, рост, отток" },
    ],
  },
  {
    title: "Настройки платформы",
    items: [
      { key: "industries", label: "Отрасли", hint: "Профили отраслей" },
      { key: "templates", label: "Уведомления", hint: "Тексты напоминаний" },
      { key: "integrations", label: "Интеграции", hint: "Ключи Meta, Instagram" },
    ],
  },
  {
    title: "Безопасность",
    items: [
      { key: "audit", label: "Журнал", hint: "Кто что менял" },
      { key: "admins", label: "Администраторы", hint: "Доступы и 2FA" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
const VIEWS = new Set<string>(NAV_ITEMS.map((i) => i.key));

export const viewLabel = (v: View): string =>
  NAV_ITEMS.find((i) => i.key === v)?.label ?? "";

export const readView = (): View => {
  const v = new URLSearchParams(window.location.search).get("view") ?? "";
  return (VIEWS.has(v) ? v : "home") as View;
};

export const NAV_EVENT = "platform-nav";

/**
 * Перейти в раздел. params — параметры экрана (фильтры, ?id=slug карточки):
 * при смене раздела прежние параметры сбрасываются, чтобы фильтры одного
 * экрана не «прилипали» к другому.
 */
export const navigate = (view: View, params?: Record<string, string>): void => {
  const p = new URLSearchParams();
  if (view !== "home") p.set("view", view);
  for (const [k, v] of Object.entries(params ?? {})) if (v) p.set(k, v);
  const qs = p.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (next !== `${window.location.pathname}${window.location.search}`)
    window.history.pushState(null, "", next);
  window.dispatchEvent(new Event(NAV_EVENT));
};

/** Открыть карточку компании (по slug или id) — из любого раздела. */
export const openTenant = (slugOrId: string): void =>
  navigate("tenants", { id: slugOrId });
