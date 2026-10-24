export type TenantStatus = "trial" | "active" | "blocked" | "deleted";
export type PaymentStatus = "paid" | "overdue" | "none";

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  contactPhone: string | null;
  contactEmail: string | null;
  tariffId: string | null;
  tariffCode: string | null;
  tariffName: string | null;
  createdAt: string;
  employees: number;
  deals: number;
  paidUntil: string | null;
  nextChargeAt: string | null;
  paymentStatus: PaymentStatus;
  priceOverride: string | null;
  isTest: boolean;
  deletedAt: string | null;
  industryId?: string | null;
  industryName?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  lastActivityAt?: string | null;
  mrr?: number | null;
}

export interface PaymentRow {
  id: string;
  amount: string;
  currency: string;
  periodMonths: number | null;
  paidUntil: string | null;
  note: string | null;
  receipt: string | null;
  cancelled: boolean;
  adminLogin: string;
  createdAt: string;
}

export interface PaymentsResponse {
  items: PaymentRow[];
  total: number;
}

export const PAYMENT_PERIODS = [1, 3, 6, 12];

export interface PlatformOverview {
  total: number;
  deleted: number;
  byStatus: Record<string, number>;
  trialsExpiringSoon: number;
  trialsExpired: number;
  overdue: number;
  mrr: number;
  mrrCurrency: string;
  newThisMonth: number;
  everPaid: number;
  conversionRate: number | null;
  churned: number;
  /** Система ограничения подписки: состояния компаний + счётчики за сегодня. */
  subscription: {
    activeTenants: number;
    trialTenants: number;
    pastDueTenants: number;
    graceTenants: number;
    suspendedTenants: number;
    canceledTenants: number;
    today: {
      blockedApiRequests: number;
      blockedOutboundMessages: number;
      heldInboundMessages: number;
      skippedAutomations: number;
      paymentReactivations: number;
    };
  } | null;
}

/** Именованные фильтры дашборда (кликабельные карточки). */
export type TenantFilter =
  | ""
  | "trial_expiring"
  | "trial_expired"
  | "overdue"
  | "expiring_7d"
  | "inactive_14d"
  | "attention";

export interface NotificationTemplate {
  key: string;
  title: string;
  body: string;
  enabled: boolean;
  updatedAt: string;
}

export interface TenantNotification {
  id: string;
  type: string;
  channel: string;
  status: string;
  detail: string | null;
  createdAt: string;
}

export const TEMPLATE_PLACEHOLDERS = [
  "company",
  "daysLeft",
  "trialEndsAt",
  "paidUntil",
  "nextChargeAt",
  "login",
  "password",
  "crmUrl",
];

export const NOTIF_STATUS_COLOR: Record<string, string> = {
  sent: "green",
  failed: "red",
  skipped: "default",
  pending: "blue",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  paid: "Оплачено",
  overdue: "Просрочено",
  none: "Нет оплаты",
};

export const PAYMENT_COLOR: Record<PaymentStatus, string> = {
  paid: "green",
  overdue: "red",
  none: "default",
};

export interface TenantDetail {
  tenant: TenantRow;
  /** Эффективные модули (тариф + индивидуальный override). */
  modules: Record<string, boolean>;
  tariffModules: Record<string, boolean>;
  /** Переопределения модулей компании поверх тарифа (ключ есть = override). */
  overrideModules: Record<string, boolean>;
  /** Эффективные лимиты (с учётом аддонов). */
  limits: Record<string, number | null>;
  tariffLimits: Record<string, number | null>;
  usage: Record<string, number>;
  /** Купленные компанией аддоны (количества) — прибавляются к лимитам. */
  addons: Record<string, number>;
  /** Предоплата опций до даты (1/3/6/12 мес): { key: 'YYYY-MM-DD' }. */
  addonsPaidUntil?: Record<string, string>;
  hasOverrides: boolean;
  limitPolicy: "hard" | "soft";
  industry: { slug: string; name: string } | null;
  owner: {
    id: string;
    email: string | null;
    name: string;
    lastLoginAt: string | null;
  } | null;
  /** Эффективная месячная цена = MRR (та же формула, что в списке). */
  monthlyPrice: number;
  tariffPrice: number;
}

/** Группы действий журнала для фильтра (категория → набор action-ключей). */
export const AUDIT_FILTERS: Array<{ label: string; actions: string[] }> = [
  { label: "Все действия", actions: [] },
  { label: "Оплата", actions: ["tenant.payment", "tenant.payment_cancel"] },
  { label: "Вход под владельцем", actions: ["tenant.impersonate"] },
  {
    label: "Тариф и модули",
    actions: [
      "tenant.tariff",
      "tenant.bulk_tariff",
      "tenant.modules",
      "tenant.addons",
      "tenant.price_override",
    ],
  },
  { label: "Статус и триал", actions: ["tenant.status", "tenant.trial_extend", "tenant.auto_freeze", "tenant.trial_expired"] },
  { label: "Компания и контакты", actions: ["tenant.create", "tenant.contacts", "tenant.test_flag"] },
  { label: "Админы платформы", actions: ["admin.create", "admin.active", "admin.password", "admin.delete", "admin.permissions", "admin.2fa_enable", "admin.2fa_disable"] },
];

export interface AuditPage {
  rows: AuditRow[];
  hasMore: boolean;
}

export interface Tariff {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  period: string;
  isPublic: boolean;
  sortOrder: number;
  modules: Record<string, boolean>;
  limits: Record<string, number | null>;
  discounts: Record<string, number>;
  addons: Record<string, number>;
  archived: boolean;
}

/**
 * Модули-«пакеты» для конструктора тарифа. Каждый разворачивается в реальные
 * блоки CRM (blocks) — выключение пакета пишет false этим блокам (enforcement на
 * @CrmAccess). loyalty/telephony пока без блока → хранятся как флаг по key.
 * ДЕРЖАТЬ синхронно с backend entitlements.constants MODULE_BUNDLES.
 */
// Пакеты = группы сайдбара CRM (Аналитика/Продажи/Склад/Команда/Финансы/Система)
// — карточка тарифа/компании и меню компании говорят на одном языке.
// ДЕРЖАТЬ синхронно с backend entitlements.constants MODULE_BUNDLES.
export const MODULE_BUNDLES: Array<{
  key: string;
  label: string;
  blocks: string[];
}> = [
  { key: "analytics", label: "Аналитика", blocks: ["1"] },
  { key: "sales", label: "Продажи", blocks: ["23", "16", "2", "24", "15", "13"] },
  { key: "warehouse", label: "Склад", blocks: ["3", "18", "7", "11"] },
  { key: "team", label: "Команда", blocks: ["4", "19", "17"] },
  { key: "finance", label: "Финансы", blocks: ["5", "12", "10", "14"] },
  { key: "system", label: "Система", blocks: ["8", "20", "9", "22", "21", "6"] },
];

/** Всегда включённые разделы (нельзя отключить тарифом). */
export const ALWAYS_ON_BLOCKS = new Set(["4", "6", "21"]);

/** Названия разделов (фолбэк, если каталог с бэка ещё не пришёл). */
const BLOCK_LABELS: Record<string, string> = {
  "1": "Аналитика", "23": "Сделки", "2": "Продажи", "24": "Отчёты",
  "18": "Товары", "16": "Клиенты", "3": "Склад", "12": "Касса",
  "20": "Документы", "13": "Задачи", "8": "Филиалы", "5": "Финансы",
  "15": "План продаж", "10": "Owner Report", "19": "HR", "17": "Учёт времени",
  "14": "Маркетинг", "9": "Материалы", "11": "Ремонт", "7": "Поставщики",
  "22": "Интеграции", "4": "Сотрудники", "6": "Настройки", "21": "Безопасность",
};

/** Дерево «группа → разделы» — офлайн-фолбэк (онлайн берётся с бэка). */
export const MODULE_GROUPS_FALLBACK: Array<{
  key: string;
  label: string;
  sections: Array<{ key: string; label: string; alwaysOn: boolean; flag?: boolean }>;
}> = MODULE_BUNDLES.map((b) => ({
  key: b.key,
  label: b.label,
  sections: b.blocks.map((k) => ({
    key: k,
    label: BLOCK_LABELS[k] ?? k,
    alwaysOn: ALWAYS_ON_BLOCKS.has(k),
  })),
}));

/** Аддоны (докупаются поверх пакета) — цена за единицу/мес. */
export const ADDON_META: Array<{ key: string; label: string; unit: string }> = [
  { key: "wabaNumber", label: "WABA номер", unit: "за номер/мес" },
  { key: "extraSeat", label: "Доп. сотрудник", unit: "за место/мес" },
  { key: "extraWhatsapp", label: "Доп. WhatsApp номер", unit: "за номер/мес" },
];

export interface Analytics {
  mrrByTariff: Array<{
    code: string;
    name: string;
    count: number;
    mrr: number;
  }>;
  monthlyNew: Array<{ month: string; count: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
}

export interface AuditRow {
  id: string;
  adminLogin: string;
  action: string;
  tenantId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

/** Ключи лимитов тарифа + подписи для интерфейса (совпадают с бэкендом). */
export const LIMIT_META: Array<{ key: string; label: string }> = [
  { key: "users", label: "Сотрудники" },
  { key: "whatsappNumbers", label: "Номера WhatsApp" },
  { key: "dealsPerMonth", label: "Сделки в месяц" },
  { key: "products", label: "Товары" },
  { key: "branches", label: "Филиалы" },
  { key: "storageMb", label: "Хранилище, МБ" },
];

/**
 * Лимиты, которые ТАРИФ не даёт: только докупка (аддон) или ручной оверрайд
 * компании. WhatsApp-номера продаются отдельно — в редакторе тарифа их нет.
 */
export const ADDON_ONLY_LIMIT_KEYS = new Set(["whatsappNumbers"]);
export const TARIFF_LIMIT_META = LIMIT_META.filter(
  (l) => !ADDON_ONLY_LIMIT_KEYS.has(l.key),
);

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "tenant.create": "Создание компании",
  "tenant.status": "Смена статуса",
  "tenant.trial_extend": "Продление триала",
  "tenant.tariff": "Смена тарифа",
  "tenant.contacts": "Изменение контактов",
  "tenant.payment": "Отметка оплаты",
  "tenant.payment_cancel": "Отмена платежа",
  "tenant.price_override": "Индивидуальная цена",
  "tenant.addons": "Аддоны компании",
  "tenant.bulk_tariff": "Массовая смена тарифа",
  "tenant.auto_freeze": "Автозаморозка (просрочка)",
  "config.grace": "Настройка grace-периода",
  "tenant.impersonate": "Вход под владельцем",
  "tenant.test_flag": "Пометка «тест»",
  "tenant.trial_expired": "Триал истёк → заморозка",
  "tariff.edit": "Редактирование тарифа",
  "tariff.create": "Создание тарифа",
  "template.edit": "Правка шаблона",
  "notification.send": "Отправка напоминания",
  "admin.create": "Создание админа",
  "admin.active": "Вкл/выкл админа",
  "admin.password": "Смена пароля админа",
  "admin.delete": "Удаление админа",
  "admin.permissions": "Изменение прав админа",
  "admin.2fa_enable": "Включение 2FA",
  "admin.2fa_disable": "Отключение 2FA",
};

/** Типы уведомлений для ручной отправки. */
export const REMINDER_TYPES: Array<{ value: string; label: string }> = [
  { value: "trial_3d", label: "Триал: за 3 дня" },
  { value: "trial_1d", label: "Триал: за 1 день" },
  { value: "trial_0d", label: "Триал: в день истечения" },
  { value: "payment_reminder", label: "Напоминание об оплате" },
];

/** Что происходит с данными при статусе (показываем в админке). */
export const STATUS_DATA_POLICY: Record<TenantStatus, string> = {
  trial: "Пробный период: полный доступ.",
  active: "Оплачено: полный доступ.",
  blocked: "Заморозка: доступ только на чтение, данные сохраняются.",
  deleted:
    "Удаление: вход закрыт, данные сохраняются (мягкое удаление) — можно восстановить сменой статуса.",
};

export interface AdminRow {
  id: string;
  login: string;
  name: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  permissions: string[];
  totpEnabled: boolean;
}

export interface PermissionDef {
  key: string;
  label: string;
}

export const STATUS_LABEL: Record<TenantStatus, string> = {
  trial: "Триал",
  active: "Активна",
  blocked: "Заблокирована",
  deleted: "Удалена",
};

export const STATUS_COLOR: Record<TenantStatus, string> = {
  trial: "blue",
  active: "green",
  blocked: "red",
  deleted: "default",
};

/** Отрасль из справочника (супер-админка). */
export interface Industry {
  id: string;
  slug: string;
  nameRu: string;
  nameKy: string;
  nameEn: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  isDefault: boolean;
  modules: string[];
  pipelineStages: string[];
  clientTermRu: string;
  clientTermKy: string;
  clientTermEn: string;
  warehouseEnabled: boolean;
  productCatalog: IndustryProductCatalog;
  tenantsCount: number;
}

/** Каталог товаров отрасли: что считать услугами, категория по умолчанию и флаги. */
export interface IndustryProductCatalog {
  serviceCategories: string[];
  defaultCategory: string;
  requireCategory: boolean;
  showScaleCode: boolean;
  /** Штрихкоды и сканер; выключено — кнопки сканирования и поля штрихкода скрыты. */
  useBarcodes: boolean;
  /** Только услуги: форма товара сразу как услуга, без закупки и склада. */
  onlyServices: boolean;
  /** Ведётся закупочная цена. */
  trackCost: boolean;
  /** Есть склад: поступление и остатки. */
  useWarehouse: boolean;
}

export type IndustryInput = Partial<
  Omit<Industry, "id" | "tenantsCount">
>;
