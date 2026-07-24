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
import { CreateTenantModal } from "./CreateTenantModal";
import { TenantDrawer } from "./TenantDrawer";

const FILTER_LABEL: Record<Exclude<TenantFilter, "">, string> = {
  trial_expiring: "Триал истекает ≤3 дн.",
  trial_expired: "Триал истёк",
  overdue: "Оплата просрочена",
};

const CSV_COLUMNS: Array<{ key: keyof TenantRow; label: string }> = [
  { key: "name", label: "Компания" },
  { key: "slug", label: "Slug" },
  { key: "status", label: "Статус" },
  { key: "tariffName", label: "Тариф" },
  { key: "paymentStatus", label: "Оплата" },
  { key: "paidUntil", label: "Оплачено до" },
  { key: "trialEndsAt", label: "Триал до" },
  { key: "employees", label: "Сотрудники" },
  { key: "deals", label: "Сделки" },
  { key: "contactPhone", label: "Телефон" },
  { key: "contactEmail", label: "Email" },
  { key: "createdAt", label: "Создана" },
];

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportCsv = (rows: TenantRow[]): void => {
  const head = CSV_COLUMNS.map((c) => c.label).join(";");
  const body = rows
    .map((r) => CSV_COLUMNS.map((c) => csvCell(r[c.key])).join(";"))
    .join("\n");
  // BOM — чтобы Excel корректно открыл кириллицу в UTF-8.
  const blob = new Blob(["﻿" + head + "\n" + body], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tomstore-companies.csv";
  link.click();
  URL.revokeObjectURL(url);
};

export const TenantsPage = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState<TenantFilter>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>Компании</h2>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          Создать компанию
        </Button>
      </div>

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
          <Button
            style={{ marginLeft: "auto" }}
            onClick={() => exportCsv(tenants ?? [])}
            disabled={!tenants?.length}
          >
            Экспорт CSV
          </Button>
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
      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
};
