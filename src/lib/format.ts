/**
 * Единое форматирование панели: деньги с разделением тысяч («5 000 сом»),
 * даты по-русски, текст ошибки сервера. Раньше у каждого экрана была своя
 * копия — где-то без округления, где-то без года.
 */

/** «5 000 сом»; не-сомы — с кодом валюты. Округляем до целых. */
export const money = (
  v: number | string | null | undefined,
  currency = "KGS",
): string => {
  const n = Math.round(Number(v ?? 0) || 0).toLocaleString("ru-RU");
  return currency === "KGS" ? `${n} сом` : `${n} ${currency}`;
};

/** Целое с разделением тысяч: «12 345». */
export const count = (v: number | string | null | undefined): string =>
  Math.round(Number(v ?? 0) || 0).toLocaleString("ru-RU");

/** «26.11.2026» (или «—»). 'YYYY-MM-DD' — без сдвига часового пояса. */
export const date = (v: string | Date | null | undefined): string => {
  if (!v) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-");
    return `${d}.${m}.${y}`;
  }
  return new Date(v).toLocaleDateString("ru-RU");
};

/** «26.11.26, 14:02» — для событий (счета, журнал, обращения). */
export const dateTime = (v: string | Date | null | undefined): string =>
  v
    ? new Date(v).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** «5 мин назад» / «3 ч назад» / «2 дн. назад». */
export const ago = (v: string | number | Date | null | undefined): string => {
  if (v == null || v === "") return "";
  const m = Math.round((Date.now() - new Date(v).getTime()) / 60_000);
  if (m < 60) return `${Math.max(m, 1)} мин назад`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн. назад`;
};

/** Текст ошибки с сервера (message) или запасной. */
export const errMsg = (e: unknown, fallback: string): string => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response
    ?.data?.message;
  if (Array.isArray(m)) return m.join("; ");
  return typeof m === "string" && m ? m : fallback;
};
