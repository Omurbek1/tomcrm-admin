/**
 * Единый визуальный язык графиков админки (палитра валидирована dataviz-скиллом:
 * колор-слепые ΔE≥8, контраст, фиксированный порядок категорий). Меняем цвета
 * только здесь — все чарты подхватывают.
 */

/** Категориальная палитра — в ФИКСИРОВАННОМ порядке, не циклим (макс. 8). */
export const CATEGORICAL = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

export const SERIES = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  green: "#008300",
  red: "#e34948",
  violet: "#4a3aa7",
  yellow: "#eda100",
};

/** Статусы компаний → цвет (status-палитра, отдельная от категориальной). */
export const STATUS_COLOR: Record<string, string> = {
  active: "#1baf7a",
  trial: "#2a78d6",
  blocked: "#e34948",
  frozen: "#eb6834",
  deleted: "#9ca3af",
};

export const STATUS_LABEL: Record<string, string> = {
  active: "Активные",
  trial: "Триал",
  blocked: "Заблокированы",
  frozen: "Заморожены",
  deleted: "Удалённые",
};

/** Рецессивные оси/сетка (не спорят с данными) и чернильные токены текста. */
export const AXIS_INK = "#94a3b8";
export const GRID_INK = "#eef1f5";
export const TEXT_MUTED = "#64748b";

/** Число с разделением тысяч ПРОБЕЛАМИ (2 500 000) — обязательное правило проекта. */
export const num = (n: number | string | null | undefined): string =>
  `${Math.round(Number(n || 0)).toLocaleString("ru-RU")}`;

/** «YYYY-MM» → «мар 24» для подписей оси. */
export const monthLabel = (ym: string): string => {
  const [y, m] = String(ym).split("-");
  const names = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  const i = Math.max(0, Math.min(11, Number(m) - 1));
  return `${names[i]} ${String(y).slice(2)}`;
};
