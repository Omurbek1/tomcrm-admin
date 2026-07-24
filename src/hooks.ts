import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { api } from "./api/client";
import type {
  PlatformOverview,
  Tariff,
  TenantDetail,
  TenantRow,
} from "./types";

export const useOverview = () =>
  useQuery<PlatformOverview>({
    queryKey: ["overview"],
    queryFn: async () => (await api.get("/api/platform/overview")).data,
  });

export const useTenants = (search: string, status: string) =>
  useQuery<TenantRow[]>({
    queryKey: ["tenants", search, status],
    queryFn: async () =>
      (
        await api.get("/api/platform/tenants", {
          params: { search: search || undefined, status: status || undefined },
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
