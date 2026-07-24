import { Button, Card, Col, Input, Row, Select, Statistic, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { useOverview, useTenants } from "../hooks";
import type {
  PaymentStatus,
  TenantFilter,
  TenantRow,
  TenantStatus,
} from "../types";
import {
  PAYMENT_COLOR,
  PAYMENT_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from "../types";
import { TenantDrawer } from "./TenantDrawer";

const FILTER_LABEL: Record<Exclude<TenantFilter, "">, string> = {
  trial_expiring: "Триал истекает ≤3 дн.",
  trial_expired: "Триал истёк",
  overdue: "Оплата просрочена",
};

export const TenantsPage = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState<TenantFilter>("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: overview } = useOverview();
  const { data: tenants, isLoading } = useTenants(search, status, filter);

  // Клик по карточке-метрике: применяет именованный фильтр (сбрасывая статус).
  const applyFilter = (f: TenantFilter) => {
    setStatus("");
    setFilter((cur) => (cur === f ? "" : f));
  };

  const clickable = (f: TenantFilter) => ({
    onClick: () => applyFilter(f),
    style: {
      cursor: "pointer",
      outline: filter === f ? "2px solid #4f46e5" : undefined,
    } as const,
  });

  const columns: ColumnsType<TenantRow> = [
    {
      title: "Компания",
      dataIndex: "name",
      render: (_v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>/{r.slug}</div>
        </div>
      ),
    },
    {
      title: "Статус",
      dataIndex: "status",
      width: 120,
      render: (s: TenantStatus) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "Триал",
      dataIndex: "trialDaysLeft",
      width: 80,
      render: (d: number, r) =>
        r.status === "trial" ? (
          <span style={{ color: d <= 0 ? "#ef4444" : undefined }}>{d} дн.</span>
        ) : (
          "—"
        ),
    },
    { title: "Тариф", dataIndex: "tariffName", width: 120, render: (v) => v ?? "—" },
    {
      title: "Оплата",
      dataIndex: "paymentStatus",
      width: 120,
      render: (s: PaymentStatus) => (
        <Tag color={PAYMENT_COLOR[s]}>{PAYMENT_LABEL[s]}</Tag>
      ),
    },
    { title: "Сотр.", dataIndex: "employees", width: 70 },
    { title: "Сделки", dataIndex: "deals", width: 70 },
    { title: "Телефон", dataIndex: "contactPhone", width: 140, render: (v) => v ?? "—" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Бизнес-метрики */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="MRR (мес. выручка)"
              value={overview?.mrr ?? 0}
              formatter={(v) => Number(v).toLocaleString("ru-RU")}
              suffix={overview?.mrrCurrency ?? "KGS"}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Новые за месяц"
              value={overview?.newThisMonth ?? 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Конверсия триал→оплата"
              value={overview?.conversionRate ?? 0}
              suffix="%"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Отток (блок/удал.)"
              value={overview?.churned ?? 0}
              valueStyle={{ color: "#ef4444" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Операционные (кликабельные фильтры) */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Всего компаний" value={overview?.total ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card {...clickable("trial_expiring")}>
            <Statistic
              title="Триал истекает ≤3 дн."
              value={overview?.trialsExpiringSoon ?? 0}
              valueStyle={{ color: "#f59e0b" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card {...clickable("trial_expired")}>
            <Statistic
              title="Триал истёк"
              value={overview?.trialsExpired ?? 0}
              valueStyle={{ color: "#ef4444" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card {...clickable("overdue")}>
            <Statistic
              title="Оплата просрочена"
              value={overview?.overdue ?? 0}
              valueStyle={{ color: "#ef4444" }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Input.Search
            placeholder="Поиск по названию, slug, телефону"
            allowClear
            style={{ maxWidth: 360 }}
            onSearch={setSearch}
            onChange={(e) => {
              if (!e.target.value) setSearch("");
            }}
          />
          <Select
            value={status}
            style={{ width: 200 }}
            onChange={(v) => {
              setStatus(v);
              setFilter("");
            }}
            options={[
              { value: "", label: "Все статусы" },
              { value: "trial", label: "Триал" },
              { value: "active", label: "Активные" },
              { value: "blocked", label: "Заблокированные" },
              { value: "deleted", label: "Удалённые" },
            ]}
          />
          {filter && (
            <Tag
              closable
              color="blue"
              onClose={() => setFilter("")}
              style={{ padding: "4px 8px" }}
            >
              {FILTER_LABEL[filter]}
            </Tag>
          )}
          {(filter || status) && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setFilter("");
                setStatus("");
              }}
            >
              Сбросить
            </Button>
          )}
        </div>

        <Table<TenantRow>
          rowKey="id"
          loading={isLoading}
          dataSource={tenants ?? []}
          columns={columns}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          onRow={(r) => ({
            onClick: () => setOpenId(r.id),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <TenantDrawer tenantId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};
