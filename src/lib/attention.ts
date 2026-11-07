import {
  useBillingHealth,
  useLimitOverages,
  useOverview,
  useSupportTickets,
  useUnverifiedEvents,
} from "../hooks";

/**
 * Что требует действия — одни и те же числа в меню (бейджи) и на «Обзоре».
 * Все запросы уже есть в разделах и делят кэш React Query: открытие раздела
 * после «Обзора» не грузит данные повторно.
 */
export const useAttention = () => {
  const overview = useOverview();
  const support = useSupportTickets("open");
  const unverified = useUnverifiedEvents();
  const health = useBillingHealth();
  const overages = useLimitOverages();

  const o = overview.data;
  const supportOpen = support.data?.length ?? 0;
  const supportUrgent =
    support.data?.filter((t) => t.priority === "high").length ?? 0;
  const unverifiedCount = unverified.data?.length ?? 0;
  const stuckCount = health.data?.stuckPending.length ?? 0;
  const badSignatures = health.data?.invalidSignatureLastHour ?? 0;
  const overageCount = overages.data?.length ?? 0;

  return {
    overview,
    support,
    unverified,
    health,
    overages,
    overdue: o?.overdue ?? 0,
    trialsExpiringSoon: o?.trialsExpiringSoon ?? 0,
    trialsExpired: o?.trialsExpired ?? 0,
    supportOpen,
    supportUrgent,
    unverifiedCount,
    stuckCount,
    badSignatures,
    overageCount,
    /** Бейджи меню: сколько дел в разделе. */
    badges: {
      tenants: (o?.overdue ?? 0) + (o?.trialsExpiringSoon ?? 0),
      support: supportOpen,
      billing: unverifiedCount + stuckCount + overageCount,
    } as Partial<Record<string, number>>,
  };
};
