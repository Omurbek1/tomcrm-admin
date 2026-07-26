import { Button, Card, Select, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { useAudit, useTenants } from "../hooks";
import type { AuditRow } from "../types";
import { AUDIT_ACTION_LABEL, AUDIT_FILTERS } from "../types";

export const AuditPage = () => {
  const [tenantId, setTenantId] = useState<string>("");
  const [filterIdx, setFilterIdx] = useState<number>(0);
  const [limit, setLimit] = useState<number>(25);
  const { data: tenants } = useTenants("", "", "");
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
      >
        <Table<AuditRow>
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
