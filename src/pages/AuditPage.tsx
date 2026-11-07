import { Button, Card, Select, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { useAudit, useTenants } from "../hooks";
import { PageHeader } from "../components/viz";
import { openTenant } from "../lib/nav";
import type { AuditRow } from "../types";
import { AUDIT_ACTION_LABEL, AUDIT_FILTERS } from "../types";
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
const SECRET = /password|token|secret|key/i;

/** Детали записи: без паролей/ключей и без голых id, значения — коротко. */
const detailsText = (d: Record<string, unknown> | null | undefined): string =>
  Object.entries(d ?? {})
    .filter(([k, v]) => !SECRET.test(k) && !(typeof v === "string" && UUID.test(v)))
    .map(([k, v]) => {
      const val =
        v && typeof v === "object" ? JSON.stringify(v) : String(v ?? "—");
      return `${k}: ${val.length > 80 ? `${val.slice(0, 79)}…` : val}`;
    })
    .join(" · ");

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
        <Tag color={SENSITIVE.has(a) ? "red" : undefined}>
          {AUDIT_ACTION_LABEL[a] ?? a}
        </Tag>
      ),
    },
    { title: "Админ", dataIndex: "adminLogin", width: 140 },
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
      render: (d: Record<string, unknown>) => (
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {detailsText(d)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader
        title="Журнал"
        subtitle="Действия администраторов платформы"
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
