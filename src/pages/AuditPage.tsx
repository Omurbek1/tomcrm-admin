import { Button, Card, Select, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { useAudit, useTenants } from "../hooks";
import { PageHeader } from "../components/viz";
import { openTenant } from "../lib/nav";
import type { AuditRow } from "../types";
import { AUDIT_FILTERS } from "../types";
import { actionLabel, auditDetails } from "../lib/auditText";
import { ResponsiveTable } from "../components/MobileCards";

/** Действия, после которых стоит присмотреться: доступ, удаление, деньги. */
const SENSITIVE = new Set([
  "tenant.impersonate",
  "recordings.purge",
  "tenant.payment_cancel",
  "admin.delete",
  "admin.permissions",
  "admin.2fa_disable",
  "admin.password",
]);
export const AuditPage = () => {
  const [tenantId, setTenantId] = useState<string>("");
  const [filterIdx, setFilterIdx] = useState<number>(0);
  const [limit, setLimit] = useState<number>(25);
  const { data: tenants } = useTenants({ includeDeleted: true });
  const { data: audit, isLoading } = useAudit(tenantId, {
    actions: AUDIT_FILTERS[filterIdx].actions,
    limit,
  });

  const nameById = useMemo(
    () => new Map((tenants ?? []).map((t) => [t.id, t.name])),
    [tenants],
  );

  const columns: ColumnsType<AuditRow> = [
    {
      title: "Дата",
      dataIndex: "createdAt",
      width: 130,
      render: (v: string) =>
        new Date(v).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      title: "Действие",
      dataIndex: "action",
      width: 200,
      render: (a: string) => (
        <Tag color={SENSITIVE.has(a) ? "red" : undefined}>{actionLabel(a)}</Tag>
      ),
    },
    {
      title: "Кто",
      dataIndex: "adminLogin",
      width: 140,
      render: (v: string | null) => v || <span style={{ color: "var(--text-3)" }}>система</span>,
    },
    {
      title: "Компания",
      dataIndex: "tenantId",
      width: 200,
      render: (id: string | null) =>
        id ? (
          <a onClick={() => openTenant(id)}>{nameById.get(id) ?? "Компания"}</a>
        ) : (
          "—"
        ),
    },
    {
      title: "Детали",
      dataIndex: "details",
      render: (d: Record<string, unknown>, r) => (
        <span style={{ fontSize: 13, color: "var(--text-2)" }}>
          {auditDetails(r.action, d) || "—"}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader
        title="Журнал"
        subtitle="Кто и что менял: оплаты, тарифы, доступ, админы — и автоматические действия системы"
        extra={
          <Space wrap>
            <Select
              value={filterIdx}
              style={{ width: 200 }}
              onChange={(v) => {
                setFilterIdx(v);
                setLimit(25);
              }}
              options={AUDIT_FILTERS.map((f, i) => ({ value: i, label: f.label }))}
            />
            <Select
              value={tenantId}
              style={{ width: 240 }}
              showSearch
              optionFilterProp="label"
              onChange={(v) => {
                setTenantId(v);
                setLimit(25);
              }}
              options={[
                { value: "", label: "Все компании" },
                ...(tenants ?? []).map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </Space>
        }
      />
      <Card>
        <ResponsiveTable<AuditRow>
          rowKey="id"
          loading={isLoading}
          dataSource={audit?.rows ?? []}
          columns={columns}
          scroll={{ x: "max-content" }}
          pagination={false}
          size="small"
        />
        {audit?.hasMore && (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <Button onClick={() => setLimit((l) => l + 25)}>Показать ещё</Button>
          </div>
        )}
      </Card>
    </div>
  );
};
