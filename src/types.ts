export type TenantStatus = "trial" | "active" | "blocked" | "deleted";

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
}

export interface PlatformOverview {
  total: number;
  byStatus: Record<string, number>;
  trialsExpiringSoon: number;
  trialsExpired: number;
}

export interface TenantDetail {
  tenant: TenantRow;
  modules: Record<string, boolean>;
  limits: Record<string, number | null>;
  usage: Record<string, number>;
  hasOverrides: boolean;
}

export interface Tariff {
  id: string;
  code: string;
  name: string;
  price: string;
  currency: string;
  period: string;
  isPublic: boolean;
}

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
