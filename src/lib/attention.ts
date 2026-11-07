import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { api } from "../api/client";
import type { PlatformOverview } from "../types";

/** Ответ GET /api/platform/attention — только числа, без списков. */
export interface AttentionSummary {
  overview: PlatformOverview;
  supportOpen: number;
  supportUrgent: number;
  unverified: number;
  stuckPending: number;
  badSignatures: number;
  overages: number;
}

/**
 * Что требует действия — одни и те же числа в меню (бейджи) и на «Обзоре».
 * Один лёгкий запрос раз в минуту (раньше — 5 запросов, тянувших целые
 * списки обращений, событий и превышений). Сводку кладём в кэш ["overview"],
 * чтобы разделы, где она нужна, не запрашивали её ещё раз.
 */
export const useAttention = () => {
  const qc = useQueryClient();
  const q = useQuery<AttentionSummary>({
    queryKey: ["attention"],
    queryFn: async () => (await api.get("/api/platform/attention")).data,
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
  const d = q.data;

  useEffect(() => {
    if (d?.overview) qc.setQueryData(["overview"], d.overview);
  }, [d?.overview, qc]);

  const o = d?.overview;
  return {
    overview: { data: o, isLoading: q.isLoading },
    overdue: o?.overdue ?? 0,
    trialsExpiringSoon: o?.trialsExpiringSoon ?? 0,
    trialsExpired: o?.trialsExpired ?? 0,
    supportOpen: d?.supportOpen ?? 0,
    supportUrgent: d?.supportUrgent ?? 0,
    unverifiedCount: d?.unverified ?? 0,
    stuckCount: d?.stuckPending ?? 0,
    badSignatures: d?.badSignatures ?? 0,
    overageCount: d?.overages ?? 0,
    /** Бейджи меню: сколько дел в разделе. */
    badges: {
      subscriptions: (o?.overdue ?? 0) + (o?.trialsExpiringSoon ?? 0),
      support: d?.supportOpen ?? 0,
      billing:
        (d?.unverified ?? 0) + (d?.stuckPending ?? 0) + (d?.overages ?? 0),
    } as Partial<Record<string, number>>,
  };
};
