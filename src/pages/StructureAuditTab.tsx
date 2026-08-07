import { useState } from "react";
import { Button, Empty, List, Select, Space, Typography } from "antd";
import {
  useTenantStructureAudit,
  type StructureAuditEntry,
} from "../hooks";

const { Text } = Typography;

// Читаемые значения (никаких uuid/кодов в UI — как в CRM).
const STAGE_TYPE: Record<string, string> = {
  open: "В работе",
  won: "Успех",
  lost: "Провал",
};
const DEDUPE: Record<string, string> = {
  merge: "объединять",
  flag: "помечать",
  block: "блокировать",
  off: "выключено",
};
const LEAD_VIS: Record<string, string> = {
  off: "Выключено",
  rop_only: "Только РОП",
  all: "РОП и менеджеры",
  auto: "Автоматическое",
};
const REPEAT: Record<string, string> = {
  previous: "Прежнему менеджеру",
  distribute: "Через распределение",
  rop: "РОПу на проверку",
};
const ROLE_LABEL: Record<string, string> = {
  owner: "Владелец",
  admin: "Администратор",
  superadmin: "Супер-админ",
  sales_head: "РОП",
  manager: "Менеджер",
};
const FIELD_LABEL: Record<string, string> = {
  name: "Название",
  isDefault: "По умолчанию",
  dedupeMode: "Контроль дублей",
  defaultStage: "Стартовый этап",
  recordingRetentionDays: "Хранение записей",
  type: "Тип этапа",
  color: "Цвет",
  slaDays: "SLA (дней)",
  leadVisibility: "Распределение",
  repeatAssignment: "Повторные обращения",
};

const fmt = (key: string, v: unknown): string => {
  if (key === "isDefault") return v ? "по умолчанию" : "обычная";
  if (key === "recordingRetentionDays")
    return v == null || v === 0 ? "бессрочно" : `${String(v)} дн`;
  if (v === null || v === undefined || v === "") return "не задан";
  if (typeof v === "boolean") return v ? "Да" : "Нет";
  if (key === "type") return STAGE_TYPE[String(v)] ?? String(v);
  if (key === "dedupeMode") return DEDUPE[String(v)] ?? String(v);
  if (key === "leadVisibility") return LEAD_VIS[String(v)] ?? String(v);
  if (key === "repeatAssignment") return REPEAT[String(v)] ?? String(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

const diffKeys = (
  b: Record<string, unknown>,
  a: Record<string, unknown>,
): string[] =>
  [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
    (k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]),
  );

const title = (e: StructureAuditEntry): string => {
  const b = e.before ?? {};
  const a = e.after ?? {};
  const name = e.entityName || "";
  switch (e.action) {
    case "pipeline.create":
      return `Создана воронка «${name}»`;
    case "pipeline.delete":
      return `Удалена воронка «${name}»`;
    case "stage.create":
      return `Добавлен этап «${name}»${
        a.position ? ` (позиция ${String(a.position)})` : ""
      }`;
    case "stage.delete":
      return `Удалён этап «${name}»${
        a.movedDeals
          ? `, ${String(a.movedDeals)} сдел. → ${fmt("movedTo", a.movedTo)}`
          : ""
      }`;
    case "stage.reorder":
      return "Изменён порядок этапов";
  }
  const keys = diffKeys(b, a);
  if (keys.length === 1) {
    const k = keys[0];
    const arrow = `${fmt(k, b[k])} → ${fmt(k, a[k])}`;
    if (k === "type") return `Тип этапа «${name}»: ${arrow}`;
    if (k === "name" && e.action === "stage.update")
      return `Переименован этап: ${arrow}`;
    if (k === "name") return `Переименована воронка: ${arrow}`;
    if (k === "leadVisibility") return `Правило распределения: ${arrow}`;
    if (k === "repeatAssignment") return `Повторные обращения: ${arrow}`;
    if (k === "defaultStage") return `Стартовый этап «${name}»: ${arrow}`;
    return `${FIELD_LABEL[k] ?? k}: ${arrow}`;
  }
  return e.action === "settings.update"
    ? "Изменены правила распределения"
    : e.action.startsWith("stage")
      ? `Изменён этап «${name}»`
      : `Изменена воронка «${name}»`;
};

const author = (e: StructureAuditEntry) =>
  e.actorName ||
  (e.actorRole ? ROLE_LABEL[e.actorRole] || e.actorRole : "") ||
  "Система";

/** §6.1/§6.2 Изменения структуры воронок/этапов/правил компании — для платформы. */
export function StructureAuditTab({ tenantId }: { tenantId: string | null }) {
  const [limit, setLimit] = useState(20);
  const [type, setType] = useState<string>("");
  const { data, isLoading } = useTenantStructureAudit(tenantId, {
    limit,
    type: type || undefined,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <Select
        size="small"
        value={type || "all"}
        style={{ width: "100%", marginBottom: 8 }}
        onChange={(v) => {
          setType(v === "all" ? "" : v);
          setLimit(20);
        }}
        options={[
          { value: "all", label: "Все изменения структуры" },
          { value: "pipeline", label: "Воронка" },
          { value: "stage", label: "Этапы" },
          { value: "settings", label: "Распределение" },
        ]}
      />
      {!isLoading && items.length === 0 ? (
        <Empty description="Изменений структуры не было" />
      ) : (
        <List
          size="small"
          loading={isLoading}
          loadMore={
            items.length < total ? (
              <div style={{ textAlign: "center", padding: 8 }}>
                <Button size="small" onClick={() => setLimit((l) => l + 20)}>
                  Показать ещё ({items.length} из {total})
                </Button>
              </div>
            ) : undefined
          }
          dataSource={items}
          renderItem={(e) => (
            <List.Item>
              <Space direction="vertical" size={0} style={{ width: "100%" }}>
                <Text>{title(e)}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {author(e)} ·{" "}
                  {new Date(e.createdAt).toLocaleString("ru-RU")}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </>
  );
}
