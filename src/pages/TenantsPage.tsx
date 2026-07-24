import { Card, Col, Input, Row, Select, Statistic, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { useOverview, useTenants } from "../hooks";
import type { PaymentStatus, TenantRow, TenantStatus } from "../types";
import {
  PAYMENT_COLOR,
  PAYMENT_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
} from "../types";
import { TenantDrawer } from "./TenantDrawer";

export const TenantsPage = () => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: overview } = useOverview();
  const { data: tenants, isLoading } = useTenants(search, status);

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
      width: 130,
      render: (s: TenantStatus) => (
        <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>
      ),
    },
    {
      title: "Триал",
      dataIndex: "trialDaysLeft",
      width: 90,
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
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Всего компаний" value={overview?.total ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активные"
              value={overview?.byStatus?.active ?? 0}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Триал истекает ≤3 дн."
              value={overview?.trialsExpiringSoon ?? 0}
              valueStyle={{ color: "#f59e0b" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Триал истёк"
              value={overview?.trialsExpired ?? 0}
              valueStyle={{ color: "#ef4444" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Оплата просрочена"
              value={overview?.overdue ?? 0}
              valueStyle={{ color: "#ef4444" }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
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
            onChange={setStatus}
            options={[
              { value: "", label: "Все статусы" },
              { value: "trial", label: "Триал" },
              { value: "active", label: "Активные" },
              { value: "blocked", label: "Заблокированные" },
              { value: "deleted", label: "Удалённые" },
            ]}
          />
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
