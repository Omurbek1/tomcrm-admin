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
}

export interface PaymentRow {
  id: string;
  amount: string;
  currency: string;
  periodMonths: number | null;
  paidUntil: string | null;
  note: string | null;
  adminLogin: string;
  createdAt: string;
}

export interface PlatformOverview {
  total: number;
  byStatus: Record<string, number>;
  trialsExpiringSoon: number;
  trialsExpired: number;
  overdue: number;
  mrr: number;
  mrrCurrency: string;
  newThisMonth: number;
  everPaid: number;
  conversionRate: number;
  churned: number;
}

/** Именованные фильтры дашборда (кликабельные карточки). */
export type TenantFilter = "" | "trial_expiring" | "trial_expired" | "overdue";

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
  modules: Record<string, boolean>;
  limits: Record<string, number | null>;
  usage: Record<string, number>;
  hasOverrides: boolean;
  limitPolicy: "hard" | "soft";
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

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "tenant.status": "Смена статуса",
  "tenant.trial_extend": "Продление триала",
  "tenant.tariff": "Смена тарифа",
  "tenant.contacts": "Изменение контактов",
  "tenant.payment": "Отметка оплаты",
  "tenant.impersonate": "Вход под владельцем",
  "tariff.edit": "Редактирование тарифа",
};

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
