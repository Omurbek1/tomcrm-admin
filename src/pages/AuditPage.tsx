import { Card, Select, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { useAudit, useTenants } from "../hooks";
import type { AuditRow } from "../types";
import { AUDIT_ACTION_LABEL } from "../types";

export const AuditPage = () => {
  const [tenantId, setTenantId] = useState<string>("");
  const { data: tenants } = useTenants("", "", "");
  const { data: audit, isLoading } = useAudit(tenantId);

  const nameById = useMemo(
    () => new Map((tenants ?? []).map((t) => [t.id, t.name])),
    [tenants],
  );

  const columns: ColumnsType<AuditRow> = [
    {
      title: "Дата",
      dataIndex: "createdAt",
      width: 170,
      render: (v: string) => new Date(v).toLocaleString("ru-RU"),
    },
    {
      title: "Действие",
      dataIndex: "action",
      width: 200,
      render: (a: string) => (
        <Tag>{AUDIT_ACTION_LABEL[a] ?? a}</Tag>
      ),
    },
    { title: "Админ", dataIndex: "adminLogin", width: 140 },
    {
      title: "Компания",
      dataIndex: "tenantId",
      width: 200,
      render: (id: string | null) =>
        id ? (nameById.get(id) ?? id.slice(0, 8)) : "—",
    },
    {
      title: "Детали",
      dataIndex: "details",
      render: (d: Record<string, unknown>) => (
        <span style={{ fontSize: 12, color: "#64748b" }}>
          {Object.entries(d ?? {})
            .filter(([k]) => k !== "password")
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(", ")}
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <Card
        title="Журнал действий администраторов"
        extra={
          <Select
            value={tenantId}
            style={{ width: 260 }}
            showSearch
            optionFilterProp="label"
            onChange={setTenantId}
            options={[
              { value: "", label: "Все компании" },
              ...(tenants ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        }
      >
        <Table<AuditRow>
          rowKey="id"
          loading={isLoading}
          dataSource={audit ?? []}
          columns={columns}
          pagination={{ pageSize: 25, showSizeChanger: false }}
          size="small"
        />
      </Card>
    </div>
  );
};
