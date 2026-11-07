import { ADDON_META, AUDIT_ACTION_LABEL, REMINDER_TYPES } from "../types";

/**
 * Журнал действий по-человечески: название действия и детали словами
 * («триал → удалена», «На 12 мес. · Оплачено до 24.11.2026») вместо
 * сырых ключей вроде «months: 12 · paidUntil: 2026-11-24T04:28…».
 * Пароли, ключи и голые id не показываем.
 */

const EXTRA_ACTIONS: Record<string, string> = {
  "tenant.apply_industry": "Настройки под отрасль",
  "tenant.industry": "Смена отрасли",
  "tenant.modules": "Модули компании",
  "tenant.call_lines": "Линии для звонков",
  "tenant.bulk_extend": "Массовое продление",
  "tenant.owner_reset_password": "Сброс пароля владельца",
  "tenant.purge_test": "Удаление тестовой компании",
  "tenant.restore": "Восстановление компании",
  "tenant.soft_delete": "Удаление компании",
  "billing.manual_confirm": "Оплата подтверждена вручную",
  "subscription.payment_received": "Оплата получена",
  "subscription.active": "Подписка активна",
  "subscription.past_due": "Оплата просрочена",
  "subscription.grace": "Льготный период",
  "subscription.suspended": "Доступ приостановлен",
  "subscription.trial": "Пробный период",
  "config.calls_switch": "Звонки: общий выключатель",
  "config.instagram": "Настройки Instagram",
  "config.subscription_periods": "Сроки подписки",
};

export const actionLabel = (a: string): string =>
  AUDIT_ACTION_LABEL[a] ?? EXTRA_ACTIONS[a] ?? "Другое действие";

const STATUS: Record<string, string> = {
  trial: "триал",
  active: "активна",
  blocked: "заморожена",
  deleted: "удалена",
  TRIAL: "триал",
  ACTIVE: "активна",
  PAST_DUE: "просрочена",
  GRACE: "льготный период",
  SUSPENDED: "приостановлена",
  CANCELLED: "отменена",
};

const REASON: Record<string, string> = {
  overdue: "просрочка оплаты",
  trial_expired: "триал закончился",
  payment: "оплата",
  manual: "вручную",
};

const NOTIF_STATUS: Record<string, string> = {
  sent: "отправлено",
  failed: "не отправлено",
  skipped: "пропущено",
};

const FIELD: Record<string, string> = {
  name: "название",
  price: "цена",
  yearlyPrice: "цена за год",
  addons: "доп. опции",
  limits: "лимиты",
  modules: "модули",
  description: "описание",
  isActive: "активность",
  isPublic: "видимость",
  trialDays: "дни триала",
  slug: "адрес",
};

const ADDON = new Map(ADDON_META.map((a) => [a.key, a.label]));
const REMINDER = new Map(REMINDER_TYPES.map((r) => [r.value, r.label]));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const SECRET = /password|token|secret|key/i;
const ISO = /^\d{4}-\d{2}-\d{2}(T|$)/;

const num = (v: unknown) => Number(v).toLocaleString("ru-RU");
const money = (v: unknown, cur?: unknown) =>
  `${Math.round(Number(v) || 0).toLocaleString("ru-RU")} ${cur && cur !== "KGS" ? String(cur) : "сом"}`;
const date = (v: unknown) => {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("ru-RU");
};
const dateTime = (v: unknown) => {
  if (!v) return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? String(v)
    : d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};
const status = (v: unknown) => STATUS[String(v)] ?? String(v);
const yesNo = (v: unknown) => (v === true || v === "true" ? "да" : "нет");

const addonsText = (o: unknown): string => {
  const e = Object.entries((o ?? {}) as Record<string, unknown>);
  if (!e.length) return "нет";
  return e
    .map(([k, v]) => {
      const l = ADDON.get(k) ?? k;
      return typeof v === "boolean" ? `${l}: ${yesNo(v)}` : `${l}: ${num(v)}`;
    })
    .join(", ");
};

const permsText = (v: unknown): string => {
  const a = Array.isArray(v) ? v : [];
  if (a.includes("*")) return "все права";
  return a.length ? `${a.length} прав` : "без прав";
};

/** Детали записи журнала одной строкой. */
export const auditDetails = (
  action: string,
  details: Record<string, unknown> | null | undefined,
): string => {
  const d: Record<string, unknown> = { ...(details ?? {}) };
  const parts: string[] = [];
  const take = (k: string) => {
    const v = d[k];
    delete d[k];
    return v;
  };
  const has = (k: string) => d[k] !== undefined && d[k] !== null && d[k] !== "";

  // Было → стало
  if (has("from") || has("to")) {
    const from = take("from");
    const to = take("to");
    if (action === "tenant.price_override")
      parts.push(`Цена: ${money(from)} → ${money(to)}`);
    else if (action === "tenant.test_flag")
      parts.push(`Тестовая: ${yesNo(from)} → ${yesNo(to)}`);
    else parts.push(`${status(from)} → ${status(to)}`);
  }
  if (has("reason")) {
    const r = String(take("reason"));
    parts.push(`Причина: ${REASON[r] ?? r}`);
  }

  // Деньги и сроки
  if (has("amount")) parts.push(`Сумма: ${money(take("amount"), d.currency)}`);
  delete d.currency;
  if (has("months")) parts.push(`На ${num(take("months"))} мес.`);
  if (has("periodMonths")) parts.push(`На ${num(take("periodMonths"))} мес.`);
  if (has("days")) parts.push(`На ${num(take("days"))} дн.`);
  if (has("paidUntil")) parts.push(`Оплачено до ${date(take("paidUntil"))}`);
  if (has("trialEndsAt") && !action.startsWith("subscription."))
    parts.push(`Триал до ${date(take("trialEndsAt"))}`);
  delete d.trialEndsAt;
  if (has("graceDays")) parts.push(`Льготных дней: ${num(take("graceDays"))}`);
  if (has("purgeDays"))
    parts.push(`Данные удалятся через ${num(take("purgeDays"))} дн.`);
  if (has("count")) parts.push(`Компаний: ${num(take("count"))}`);

  // Вход под владельцем
  if (has("ownerName")) parts.push(`Владелец: ${String(take("ownerName"))}`);
  if (has("grantedMin")) parts.push(`Доступ на ${num(take("grantedMin"))} мин`);
  if (has("expiresAt")) parts.push(`до ${dateTime(take("expiresAt"))}`);

  // Компания, контакты, админы
  if (has("companyName")) parts.push(`Компания: ${String(take("companyName"))}`);
  if (has("login")) parts.push(`Логин: ${String(take("login"))}`);
  if (has("slug")) parts.push(`Адрес: /${String(take("slug"))}`);
  if (has("phone"))
    parts.push(`Телефон: +${String(take("phone")).replace(/^\+/, "")}`);
  if (has("email")) parts.push(`Почта: ${String(take("email"))}`);
  if (d.permissions !== undefined)
    parts.push(`Права: ${permsText(take("permissions"))}`);

  // Опции, модули, тариф
  if (d.addons !== undefined) {
    const before = take("before");
    const after = addonsText(take("addons"));
    parts.push(
      before !== undefined
        ? `Опции: ${addonsText(before)} → ${after}`
        : `Опции: ${after}`,
    );
  }
  if (d.modules !== undefined) {
    const m = Object.entries((take("modules") ?? {}) as Record<string, unknown>);
    const on = m.filter(([, v]) => v === true).length;
    const off = m.filter(([, v]) => v === false).length;
    parts.push(
      m.length ? `Модули: включено ${on}, выключено ${off}` : "Модули: как в тарифе",
    );
  }
  if (d.patch && typeof d.patch === "object") {
    const keys = Object.keys(take("patch") as object).map((k) => FIELD[k] ?? k);
    parts.push(`Изменено: ${keys.join(", ")}`);
  }

  // Напоминания
  if (has("type")) {
    const t = String(take("type"));
    parts.push(REMINDER.get(t) ?? t);
  }
  if (has("status")) {
    const s = String(take("status"));
    parts.push(NOTIF_STATUS[s] ?? status(s));
  }

  // Остальное — без секретов, id и вложенных объектов
  for (const [k, v] of Object.entries(d)) {
    if (v === null || v === undefined || v === "") continue;
    if (SECRET.test(k) || /id$/i.test(k)) continue;
    if (typeof v === "string" && UUID.test(v)) continue;
    if (typeof v === "object") continue;
    const val =
      typeof v === "boolean" ? yesNo(v) : ISO.test(String(v)) ? date(v) : String(v);
    parts.push(`${FIELD[k] ?? k}: ${val.length > 60 ? `${val.slice(0, 59)}…` : val}`);
  }
  return parts.join(" · ");
};
