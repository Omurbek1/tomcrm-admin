/**
 * Навигация панели платформы: разделы, группы меню и адрес (?view=…).
 * Раздел живёт в адресе — F5, «Назад» и ссылка коллеге открывают тот же экран.
 * Хост статический (без SPA-fallback на пути), поэтому — параметр, а не путь.
 */

export type View =
  | "home"
  | "tenants"
  | "subscriptions"
  | "analytics"
  | "tariffs"
  | "billing"
  | "industries"
  | "templates"
  | "integrations"
  | "audit"
  | "admins"
  | "support";

/** Вкладка внутри пункта меню: близкие разделы — один пункт, разные вкладки. */
export type NavTab = { key: View; label: string; hint: string };
export type NavItem = {
  key: View;
  label: string;
  hint: string;
  /** Есть — пункт меню объединяет несколько разделов вкладками. */
  tabs?: NavTab[];
};
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
      {
        key: "subscriptions",
        label: "Подписки и оплаты",
        hint: "Сроки, продление, счета, вебхуки",
        tabs: [
          { key: "subscriptions", label: "Подписки", hint: "Сроки, продление, смена тарифа" },
          { key: "billing", label: "Счета и оплаты", hint: "Счета, ручные оплаты, вебхуки Finik" },
        ],
      },
      { key: "tariffs", label: "Тарифы", hint: "Цены, лимиты, неоплата, звонки" },
      { key: "analytics", label: "Аналитика", hint: "MRR, рост, отток" },
    ],
  },
  {
    title: "Система",
    items: [
      {
        key: "industries",
        label: "Настройки",
        hint: "Отрасли, уведомления, интеграции",
        tabs: [
          { key: "industries", label: "Отрасли", hint: "Профили отраслей" },
          { key: "templates", label: "Уведомления", hint: "Тексты сообщений клиентам" },
          { key: "integrations", label: "Интеграции", hint: "Ключи Meta, Instagram" },
        ],
      },
      {
        key: "admins",
        label: "Доступ",
        hint: "Администраторы, 2FA, журнал действий",
        tabs: [
          { key: "admins", label: "Администраторы", hint: "Доступы и 2FA" },
          { key: "audit", label: "Журнал", hint: "Кто что менял" },
        ],
      },
    ],
  },
];

/** Все разделы (включая вкладки) — для поиска Ctrl+K и проверки адреса. */
export const NAV_ITEMS: NavTab[] = NAV_GROUPS.flatMap((g) =>
  g.items.flatMap((i) => i.tabs ?? [{ key: i.key, label: i.label, hint: i.hint }]),
);
const VIEWS = new Set<string>(NAV_ITEMS.map((i) => i.key));

/** Пункт меню, в который входит раздел (для подсветки и вкладок). */
export const sectionOf = (v: View): NavItem | undefined =>
  NAV_GROUPS.flatMap((g) => g.items).find(
    (i) => i.key === v || i.tabs?.some((t) => t.key === v),
  );

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
