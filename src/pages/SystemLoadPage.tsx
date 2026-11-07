import { ReloadOutlined } from "@ant-design/icons";
import { App, Button, Card, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { api } from "../api/client";
import { ResponsiveTable } from "../components/MobileCards";
import { PageHeader } from "../components/viz";
import { useTenants } from "../hooks";
import { openTenant } from "../lib/nav";

const { Text } = Typography;

type HeavyTenant = {
  tenantId: string;
  slowCount: number;
  slowTotalMs: number;
  slowMaxMs: number;
  avgMs: number;
  lastSeen: number;
};
type HeavyResp = { since: number; tracked: number; tenants: HeavyTenant[] };
type Tick = {
  label: string;
  lastMs: number;
  maxMs: number;
  tenants: number;
  at: number;
  runs: number;
};

const n = (v: number) => v.toLocaleString("ru-RU");
const ms = (v: number) =>
  v >= 1000
    ? (v / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " с"
    : n(v) + " мс";
const ago = (t: number) => {
  if (!t) return "—";
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "только что";
  if (m < 60) return m + " мин назад";
  const h = Math.round(m / 60);
  return h < 24 ? h + " ч назад" : Math.round(h / 24) + " дн. назад";
};

/**
 * «Нагрузка» — диагностика масштаба: какие компании дают больше всего
 * медленных запросов к базе и сколько идут фоновые задачи. Данные — с
 * последнего запуска сервера (или «Начать замер заново»).
 */
export const SystemLoadPage = () => {
  const { message, modal } = App.useApp();
  const qc = useQueryClient();
  const heavy = useQuery<HeavyResp>({
    queryKey: ["tenant-metrics"],
    queryFn: async () =>
      (await api.get("/api/platform/tenant-metrics", { params: { limit: 30 } }))
        .data,
    retry: false,
  });
  const ticks = useQuery<Tick[]>({
    queryKey: ["scheduler-ticks"],
    queryFn: async () => (await api.get("/api/platform/scheduler-ticks")).data,
    retry: false,
  });
  const reset = useMutation({
    mutationFn: async () =>
      (await api.post("/api/platform/tenant-metrics/reset")).data,
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["tenant-metrics"] }),
  });
  const { data: tenants } = useTenants({});
  const nameById = useMemo(
    () => new Map((tenants ?? []).map((t) => [t.id, t.name])),
    [tenants],
  );

  const refresh = () => {
    void heavy.refetch();
    void ticks.refetch();
  };

  const heavyCols: ColumnsType<HeavyTenant> = [
    {
      title: "Компания",
      dataIndex: "tenantId",
      render: (id: string) =>
        id === "unknown" ? (
          <Text type="secondary">без компании (служебные)</Text>
        ) : (
          <a onClick={() => openTenant(id)}>{nameById.get(id) ?? "Компания"}</a>
        ),
    },
    {
      title: "Медленных запросов",
      dataIndex: "slowCount",
      align: "right",
      render: (v: number) => n(v),
    },
    {
      title: "Всего времени",
      dataIndex: "slowTotalMs",
      align: "right",
      render: (v: number) => <b>{ms(v)}</b>,
    },
    {
      title: "В среднем",
      dataIndex: "avgMs",
      align: "right",
      render: (v: number) => ms(v),
    },
    {
      title: "Самый долгий",
      dataIndex: "slowMaxMs",
      align: "right",
      render: (v: number) => ms(v),
    },
    { title: "Последний", dataIndex: "lastSeen", render: (v: number) => ago(v) },
  ];

  const tickCols: ColumnsType<Tick> = [
    {
      title: "Задача",
      dataIndex: "label",
      render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code>,
    },
    {
      title: "Последний прогон",
      dataIndex: "lastMs",
      align: "right",
      render: (v: number) => (
        <Text type={v >= 30_000 ? "danger" : undefined} strong={v >= 30_000}>
          {ms(v)}
        </Text>
      ),
    },
    {
      title: "Максимум",
      dataIndex: "maxMs",
      align: "right",
      render: (v: number) => ms(v),
    },
    {
      title: "Компаний",
      dataIndex: "tenants",
      align: "right",
      render: (v: number) => n(v),
    },
    {
      title: "Прогонов",
      dataIndex: "runs",
      align: "right",
      render: (v: number) => n(v),
    },
    { title: "Когда", dataIndex: "at", render: (v: number) => ago(v) },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Нагрузка"
        subtitle="Кто нагружает базу и сколько идут фоновые задачи — с последнего запуска сервера"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={refresh}
            loading={heavy.isFetching || ticks.isFetching}
          >
            Обновить
          </Button>
        }
      />

      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title="Тяжёлые компании"
        extra={
          <Button
            size="small"
            loading={reset.isPending}
            onClick={() =>
              modal.confirm({
                title: "Начать замер заново?",
                content:
                  "Счётчики медленных запросов обнулятся — так видно нагрузку после изменений.",
                okText: "Начать заново",
                cancelText: "Отмена",
                onOk: () =>
                  reset.mutateAsync().then(
                    () => void message.success("Замер начат заново"),
                    () => void message.error("Не удалось сбросить"),
                  ),
              })
            }
          >
            Начать замер заново
          </Button>
        }
      >
        <div className="form-hint">
          Медленные запросы к базе по компаниям, самые «тяжёлые» сверху.
          {heavy.data
            ? " Замер с " +
              new Date(heavy.data.since).toLocaleString("ru-RU") +
              " · компаний с медленными запросами: " +
              n(heavy.data.tracked) +
              "."
            : ""}
        </div>
        <ResponsiveTable<HeavyTenant>
          rowKey="tenantId"
          size="small"
          loading={heavy.isLoading}
          dataSource={heavy.data?.tenants ?? []}
          columns={heavyCols}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "Медленных запросов нет — база не перегружена" }}
          mobileEmptyText="Медленных запросов нет — база не перегружена"
        />
      </Card>

      <Card size="small" title="Фоновые задачи">
        <div className="form-hint">
          Напоминания, рассылки, синхронизации — проходят по всем компаниям по
          расписанию, самые долгие сверху. Красным —{" "}
          <Tag color="red" style={{ margin: 0 }}>
            ≥ 30 с
          </Tag>
          : задача близка к своему интервалу, пора выносить её в отдельную очередь.
        </div>
        <ResponsiveTable<Tick>
          rowKey="label"
          size="small"
          loading={ticks.isLoading}
          dataSource={ticks.data ?? []}
          columns={tickCols}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "Фоновые задачи ещё не запускались" }}
          mobileEmptyText="Фоновые задачи ещё не запускались"
        />
      </Card>
    </div>
  );
};
