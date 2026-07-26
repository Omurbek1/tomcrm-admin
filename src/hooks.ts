import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "./api/client";
import type {
  AuditPage,
  AdminRow,
  Analytics,
  NotificationTemplate,
  PaymentsResponse,
  PlatformOverview,
  Tariff,
  TenantDetail,
  TenantNotification,
  TenantRow,
} from "./types";

export const useOverview = () =>
  useQuery<PlatformOverview>({
    queryKey: ["overview"],
    queryFn: async () => (await api.get("/api/platform/overview")).data,
  });

export const useTenants = (search: string, status: string, filter = "") =>
  useQuery<TenantRow[]>({
    queryKey: ["tenants", search, status, filter],
    queryFn: async () =>
      (
        await api.get("/api/platform/tenants", {
          params: {
            search: search || undefined,
            status: status || undefined,
            filter: filter || undefined,
          },
        })
      ).data,
  });

export const useTenant = (id: string | null) =>
  useQuery<TenantDetail>({
    queryKey: ["tenant", id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/api/platform/tenants/${id}`)).data,
  });

export const useTariffs = () =>
  useQuery<Tariff[]>({
    queryKey: ["tariffs"],
    queryFn: async () => (await api.get("/api/platform/tariffs")).data,
  });

export interface ModuleCatalog {
  bundles: Array<{ key: string; label: string; blocks: string[] }>;
  addons: Array<{ key: string; label: string; unit: string }>;
}

/** Единый справочник модулей-пакетов и аддонов с бэка (единственный источник). */
export const useModuleCatalog = () =>
  useQuery<ModuleCatalog>({
    queryKey: ["module-catalog"],
    queryFn: async () =>
      (await api.get("/api/platform/module-catalog")).data,
    staleTime: 60 * 60_000,
  });

/** Общая инвалидация после действия над компанией. */
const useInvalidateTenant = () => {
  const qc = useQueryClient();
  return (id: string) => {
    void qc.invalidateQueries({ queryKey: ["tenant", id] });
    void qc.invalidateQueries({ queryKey: ["tenants"] });
    void qc.invalidateQueries({ queryKey: ["overview"] });
  };
};

export const useSetStatus = () => {
  const invalidate = useInvalidateTenant();
  return useMutation({
    mutationFn: async (v: { id: string; status: string }) =>
      (
        await api.patch(`/api/platform/tenants/${v.id}/status`, {
          status: v.status,
        })
      ).data as TenantRow,
    onSuccess: (_d, v) => invalidate(v.id),
  });
};

export const useExtendTrial = () => {
  const invalidate = useInvalidateTenant();
  return useMutation({
    mutationFn: async (v: { id: string; days: number }) =>
      (
        await api.patch(`/api/platform/tenants/${v.id}/trial`, {
          days: v.days,
        })
      ).data as TenantRow,
    onSuccess: (_d, v) => invalidate(v.id),
  });
};

export const useSetTariff = () => {
  const invalidate = useInvalidateTenant();
  return useMutation({
    mutationFn: async (v: { id: string; tariffId: string }) =>
      (
        await api.patch(`/api/platform/tenants/${v.id}/tariff`, {
          tariffId: v.tariffId,
        })
      ).data as TenantRow,
    onSuccess: (_d, v) => invalidate(v.id),
  });
};

export const useSetTest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; isTest: boolean }) =>
      (await api.patch(`/api/platform/tenants/${v.id}/test`, { isTest: v.isTest }))
        .data as TenantRow,
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["tenant", v.id] });
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
      void qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
};

export const useSetContacts = () => {
  const invalidate = useInvalidateTenant();
  return useMutation({
    mutationFn: async (v: {
      id: string;
      contactPhone: string;
      contactEmail: string;
    }) =>
      (
        await api.patch(`/api/platform/tenants/${v.id}/contacts`, {
          contactPhone: v.contactPhone,
          contactEmail: v.contactEmail,
        })
      ).data as TenantRow,
    onSuccess: (_d, v) => invalidate(v.id),
  });
};

export interface CreateTenantResult {
  tenant: TenantRow;
  login: string;
  tempPassword: string;
  trialEndsAt: string;
}

/** Проверка slug на лету (не хук — вызывается из формы с дебаунсом). */
export const checkSlug = async (
  slug: string,
): Promise<{ slug: string; available: boolean }> =>
  (await api.get("/api/platform/slug-check", { params: { slug } })).data;

export const useCreateTenant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      companyName: string;
      slug?: string;
      tariffId?: string;
      ownerName: string;
      ownerPhone: string;
      ownerEmail: string;
      trialDays?: number;
      isTest?: boolean;
    }) =>
      (await api.post("/api/platform/tenants", input)).data as CreateTenantResult,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
};

// ── Уведомления клиентам ────────────────────────────────────────────────────

export const useTemplates = () =>
  useQuery<NotificationTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => (await api.get("/api/platform/templates")).data,
  });

export const useUpdateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      key: string;
      title?: string;
      body?: string;
      enabled?: boolean;
    }) =>
      (await api.patch(`/api/platform/templates/${v.key}`, v))
        .data as NotificationTemplate,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["templates"] }),
  });
};

export const useNotifications = (tenantId?: string | null) =>
  useQuery<TenantNotification[]>({
    queryKey: ["notifications", tenantId],
    enabled: !!tenantId,
    queryFn: async () =>
      (await api.get(`/api/platform/tenants/${tenantId}/notifications`)).data,
  });

export const useSendReminder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; type: string }) =>
      (await api.post(`/api/platform/tenants/${v.id}/notify`, { type: v.type }))
        .data as { status: string; detail?: string },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["notifications", v.id] });
      void qc.invalidateQueries({ queryKey: ["audit", v.id] });
    },
  });
};

// ── Аналитика / индив.цена / массовые действия (P5) ─────────────────────────

export const useAnalytics = () =>
  useQuery<Analytics>({
    queryKey: ["analytics"],
    queryFn: async () => (await api.get("/api/platform/analytics")).data,
  });

export const useSetPriceOverride = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; price: number | null }) =>
      (await api.patch(`/api/platform/tenants/${v.id}/price`, { price: v.price }))
        .data as TenantRow,
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["tenant", v.id] });
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
};

export const useSetTenantAddons = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; addons: Record<string, number> }) =>
      (await api.patch(`/api/platform/tenants/${v.id}/addons`, v.addons)).data,
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["tenant", v.id] });
    },
  });
};

export const useSetTenantModules = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id: string;
      modules: Record<string, boolean>;
    }) =>
      (await api.patch(`/api/platform/tenants/${v.id}/modules`, v.modules)).data,
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["tenant", v.id] });
    },
  });
};

export const useBulkTariff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { ids: string[]; tariffId: string }) =>
      (await api.post("/api/platform/tenants/bulk/tariff", v)).data as {
        updated: number;
      },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenants"] });
      void qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });
};

export const useBulkNotify = () =>
  useMutation({
    mutationFn: async (v: { ids: string[]; type: string }) =>
      (await api.post("/api/platform/tenants/bulk/notify", v)).data as {
        sent: number;
        failed: number;
        skipped: number;
      },
  });

export const useImpersonate = () =>
  useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/api/platform/tenants/${id}/impersonate`)).data as {
        token: string;
        userId: string;
        userName: string | null;
      },
  });

export const usePayments = (tenantId: string | null, page = 1, pageSize = 10) =>
  useQuery<PaymentsResponse>({
    queryKey: ["payments", tenantId, page],
    enabled: !!tenantId,
    queryFn: async () =>
      (
        await api.get(`/api/platform/tenants/${tenantId}/payments`, {
          params: { limit: pageSize, offset: (page - 1) * pageSize },
        })
      ).data,
  });

const invalidatePayments = (qc: ReturnType<typeof useQueryClient>, id: string) => {
  void qc.invalidateQueries({ queryKey: ["tenant", id] });
  void qc.invalidateQueries({ queryKey: ["payments", id] });
  void qc.invalidateQueries({ queryKey: ["tenants"] });
  void qc.invalidateQueries({ queryKey: ["overview"] });
  void qc.invalidateQueries({ queryKey: ["audit", id] });
};

export const useRecordPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id: string;
      amount: number;
      currency: string;
      periodMonths: number;
      note?: string;
      receipt?: string;
    }) =>
      (
        await api.post(`/api/platform/tenants/${v.id}/payment`, {
          amount: v.amount,
          currency: v.currency,
          periodMonths: v.periodMonths,
          note: v.note,
          receipt: v.receipt,
        })
      ).data as TenantRow,
    onSuccess: (_d, v) => invalidatePayments(qc, v.id),
  });
};

export const useCancelPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; paymentId: string }) =>
      (
        await api.post(
          `/api/platform/tenants/${v.id}/payments/${v.paymentId}/cancel`,
        )
      ).data,
    onSuccess: (_d, v) => invalidatePayments(qc, v.id),
  });
};

export const useConfig = () =>
  useQuery<{ graceDays: number }>({
    queryKey: ["config"],
    queryFn: async () => (await api.get("/api/platform/config")).data,
  });

export const useSetConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (graceDays: number) =>
      (await api.patch("/api/platform/config", { graceDays })).data as {
        graceDays: number;
      },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["config"] }),
  });
};

/** Аудит-лог: по компании (tenantId) или весь (без id). */
export const useAudit = (
  tenantId?: string | null,
  opts?: { actions?: string[]; limit?: number },
) =>
  useQuery<AuditPage>({
    queryKey: ["audit", tenantId ?? "all", opts?.actions ?? [], opts?.limit ?? 20],
    enabled: tenantId !== undefined,
    queryFn: async () =>
      (
        await api.get("/api/platform/audit", {
          params: {
            ...(tenantId ? { tenantId } : {}),
            ...(opts?.actions?.length ? { actions: opts.actions.join(",") } : {}),
            limit: opts?.limit ?? 20,
          },
        })
      ).data,
  });

// ── Тарифы (редактирование) ─────────────────────────────────────────────────

export interface TariffPatch {
  name?: string;
  description?: string | null;
  price?: number;
  currency?: string;
  period?: string;
  isPublic?: boolean;
  sortOrder?: number;
  modules?: Record<string, boolean>;
  limits?: Record<string, number | null>;
  discounts?: Record<string, number>;
  addons?: Record<string, number>;
  archived?: boolean;
}

export type TariffCreate = TariffPatch & { code: string; name: string };

export const useEditTariff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; patch: TariffPatch }) =>
      (await api.patch(`/api/platform/tariffs/${v.id}`, v.patch)).data as Tariff,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tariffs"] });
      void qc.invalidateQueries({ queryKey: ["tenant"] });
    },
  });
};

export const useCreateTariff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: TariffCreate) =>
      (await api.post(`/api/platform/tariffs`, v)).data as Tariff,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tariffs"] });
    },
  });
};

// ── Админы платформы ────────────────────────────────────────────────────────

export const useAdmins = () =>
  useQuery<AdminRow[]>({
    queryKey: ["admins"],
    queryFn: async () => (await api.get("/api/platform/admins")).data,
  });

const useInvalidateAdmins = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admins"] });
};

export const useCreateAdmin = () => {
  const invalidate = useInvalidateAdmins();
  return useMutation({
    mutationFn: async (v: {
      login: string;
      name?: string;
      password: string;
      permissions: string[];
    }) => (await api.post("/api/platform/admins", v)).data as AdminRow,
    onSuccess: () => void invalidate(),
  });
};

export const useSetAdminPermissions = () => {
  const invalidate = useInvalidateAdmins();
  return useMutation({
    mutationFn: async (v: { id: string; permissions: string[] }) =>
      (
        await api.patch(`/api/platform/admins/${v.id}/permissions`, {
          permissions: v.permissions,
        })
      ).data as AdminRow,
    onSuccess: () => void invalidate(),
  });
};

export const usePermissionCatalog = () =>
  useQuery<Array<{ key: string; label: string }>>({
    queryKey: ["permissions-catalog"],
    queryFn: async () => (await api.get("/api/platform/permissions")).data,
    staleTime: Infinity,
  });

export const useMe = () =>
  useQuery<AdminRow>({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/api/platform/me")).data,
  });

export const use2faSetup = () =>
  useMutation({
    mutationFn: async () =>
      (await api.post("/api/platform/2fa/setup")).data as {
        secret: string;
        otpauthUrl: string;
      },
  });

export const use2faEnable = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post("/api/platform/2fa/enable", { code })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["me"] }),
  });
};

export const use2faDisable = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post("/api/platform/2fa/disable", { code })).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["me"] }),
  });
};

export const useSetAdminActive = () => {
  const invalidate = useInvalidateAdmins();
  return useMutation({
    mutationFn: async (v: { id: string; isActive: boolean }) =>
      (
        await api.patch(`/api/platform/admins/${v.id}/active`, {
          isActive: v.isActive,
        })
      ).data as AdminRow,
    onSuccess: () => void invalidate(),
  });
};

export const useChangeAdminPassword = () =>
  useMutation({
    mutationFn: async (v: { id: string; password: string }) =>
      (
        await api.patch(`/api/platform/admins/${v.id}/password`, {
          password: v.password,
        })
      ).data as AdminRow,
  });

export const useDeleteAdmin = () => {
  const invalidate = useInvalidateAdmins();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/api/platform/admins/${id}`)).data,
    onSuccess: () => void invalidate(),
  });
};
