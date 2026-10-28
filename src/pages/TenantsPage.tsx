import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import {
  useBulkExtend,
  useBulkNotify,
  useBulkTariff,
  useIndustries,
  useOverview,
  useTariffs,
  useTenants,
} from "../hooks";
import type { TenantFilter, TenantRow } from "../types";
import { formatBytes, REMINDER_TYPES } from "../types";
import { PlatformRecordingsBadge } from "./PlatformRecordingsBadge";
import { can } from "../api/client";
import { PageHeader, StatTile } from "../components/viz";
import { SERIES } from "../lib/chartTheme";
import { CreateTenantModal } from "./CreateTenantModal";
import { TenantDrawer } from "./TenantDrawer";

const money = (n: number | null | undefined): string =>
  `${Math.round(Number(n || 0)).toLocaleString("ru-RU")} сом`;

const fmtShort = (v: string | Date | null | undefined): string => {
  if (!v) return "";
  return new Date(v).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
};

const daysAgo = (v: string | null | undefined): number | null =>
  v ? Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000) : null;

/** Объединённое состояние компании (статус + триал + оплата) — один бейдж + подпись. */
const stateOf = (
  r: TenantRow,
): { color: string; label: string; sub: string } => {
  if (r.status === "deleted") return { color: "default", label: "Удалена", sub: "" };
  if (r.status === "blocked")
    return { color: "default", label: "Заморожена", sub: "" };
  if (r.status === "trial") {
    const d = r.trialDaysLeft;
    return {
      color: d <= 0 ? "red" : "blue",
      label: "Триал",
      sub: d > 0 ? `осталось ${d} дн.` : "истёк",
    };
  }
  // active
  if (!r.paidUntil)
    return { color: "green", label: "Активна", sub: "оплата не заведена" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pu = new Date(r.paidUntil);
  const diff = Math.ceil((pu.getTime() - today.getTime()) / 86_400_000);
  if (diff >= 0)
    return { color: "green", label: "Активна", sub: `оплачено до ${fmtShort(pu)}` };
  const overdue = -diff;
  if (overdue <= 3) {
    const graceEnd = new Date(pu.getTime() + 3 * 86_400_000);
    return { color: "gold", label: "Grace", sub: `доступ до ${fmtShort(graceEnd)}` };
  }
  return { color: "red", label: "Просрочена", sub: `${overdue} дн.` };
};

const CSV_COLUMNS: Array<{ key: keyof TenantRow; label: string }> = [
  { key: "name", label: "Компания" },
  { key: "slug", label: "Slug" },
  { key: "status", label: "Статус" },
  { key: "tariffName", label: "Тариф" },
  { key: "industryName", label: "Отрасль" },
  { key: "mrr", label: "MRR (KGS)" },
  { key: "paidUntil", label: "Оплачено до" },
  { key: "trialEndsAt", label: "Триал до" },
  { key: "lastActivityAt", label: "Последняя активность" },
  { key: "employees", label: "Сотрудники" },
  { key: "deals", label: "Объём (сделки)" },
  { key: "ownerName", label: "Владелец" },
  { key: "ownerPhone", label: "Телефон владельца" },
  { key: "contactPhone", label: "Контактный телефон" },
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

const readUrl = () => {
  const p = new URLSearchParams(window.location.search);
  return {
    search: p.get("q") ?? "",
    status: p.get("status") ?? "",
    filter: (p.get("filter") ?? "") as TenantFilter,
    industryId: p.get("industry") ?? "",
    tariffId: p.get("tariff") ?? "",
    sort: p.get("sort") ?? "",
    includeDeleted: p.get("deleted") === "1",
  };
};

export const TenantsPage = () => {
  const init = readUrl();
  const [search, setSearch] = useState(init.search);
  const [status, setStatus] = useState(init.status);
  const [filter, setFilter] = useState<TenantFilter>(init.filter);
  const [industryId, setIndustryId] = useState(init.industryId);
  const [tariffId, setTariffId] = useState(init.tariffId);
  const [sort, setSort] = useState(init.sort);
  const [includeDeleted, setIncludeDeleted] = useState(init.includeDeleted);

  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTariffOpen, setBulkTariffOpen] = useState(false);
  const [bulkNotifyOpen, setBulkNotifyOpen] = useState(false);
  const [bulkExtendOpen, setBulkExtendOpen] = useState(false);
  const [bulkExtendMonths, setBulkExtendMonths] = useState(1);
  const [bulkTariffId, setBulkTariffId] = useState<string>();
  const [bulkType, setBulkType] = useState<string>();

  const { message } = App.useApp();
  const { data: overview } = useOverview();
  const { data: tenants, isLoading } = useTenants({
    search,
    status,
    filter,
    industryId,
    tariffId,
    includeDeleted,
    sort,
  });
  const { data: tariffs } = useTariffs();
  const { data: industries } = useIndustries();
  const bulkTariff = useBulkTariff();
  const bulkNotify = useBulkNotify();
  const bulkExtend = useBulkExtend();

  const runBulkExtend = () => {
    bulkExtend.mutate(
      { ids: selected, periodMonths: bulkExtendMonths },
      {
        onSuccess: (r) => {
          message.success(
            `Продлено: ${r.extended}${r.failed ? `, пропущено ${r.failed}` : ""}`,
          );
          setBulkExtendOpen(false);
          setSelected([]);
        },
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось продлить";
          message.error(msg);
        },
      },
    );
  };

  // Состояние фильтров → URL (F5/ссылка коллеге сохраняют рабочий экран).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const set = (k: string, v: string | boolean) =>
      v ? p.set(k, String(v === true ? 1 : v)) : p.delete(k);
    set("q", search);
    set("status", status);
    set("filter", filter);
    set("industry", industryId);
    set("tariff", tariffId);
    set("sort", sort);
    set("deleted", includeDeleted);
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) p.set("id", id);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${p.toString()}`,
    );
  }, [search, status, filter, industryId, tariffId, sort, includeDeleted]);

  // Открытая карточка ↔ URL (?id=<slug>).
  useEffect(() => {
    const url = new URL(window.location.href);
    const slug = tenants?.find((t) => t.id === openId)?.slug;
    if (openId && slug) url.searchParams.set("id", slug);
    else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
  }, [openId, tenants]);
  useEffect(() => {
    if (openId) return;
    const slug = new URLSearchParams(window.location.search).get("id");
    const found = slug ? tenants?.find((t) => t.slug === slug) : undefined;
    if (found) setOpenId(found.id);
  }, [tenants, openId]);

  const selectedRows = useMemo(
    () => (tenants ?? []).filter((t) => selected.includes(t.id)),
    [tenants, selected],
  );

  const runBulkTariff = () => {
    if (!bulkTariffId) return;
    bulkTariff.mutate(
      { ids: selected, tariffId: bulkTariffId },
      {
        onSuccess: (r) => {
          message.success(`Тариф изменён у ${r.updated} компаний`);
          setBulkTariffOpen(false);
          setSelected([]);
        },
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось";
          message.error(msg);
        },
      },
    );
  };

  const runBulkNotify = () => {
    if (!bulkType) return;
    bulkNotify.mutate(
      { ids: selected, type: bulkType },
      {
        onSuccess: (r) => {
          message.success(
            `Отправлено ${r.sent}, пропущено ${r.skipped}, ошибок ${r.failed}`,
          );
          setBulkNotifyOpen(false);
          setSelected([]);
        },
        onError: () => message.error("Не удалось отправить"),
      },
    );
  };

  const applyFilter = (f: TenantFilter) => {
    setStatus("");
    setFilter((cur) => (cur === f ? "" : f));
  };
  const resetAll = () => {
    setSearch("");
    setStatus("");
    setFilter("");
    setIndustryId("");
    setTariffId("");
    setSort("");
    setIncludeDeleted(false);
  };

  const columns: ColumnsType<TenantRow> = [
    {
      title: "Компания",
      dataIndex: "name",
      render: (_v, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {r.name}
            {r.isTest && (
              <Tag color="purple" style={{ marginLeft: 6 }}>
                тест
              </Tag>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>/{r.slug}</div>
        </div>
      ),
    },
    {
      title: "Состояние",
      key: "state",
      width: 170,
      render: (_v, r) => {
        const s = stateOf(r);
        return (
          <div>
            <Tag color={s.color}>{s.label}</Tag>
            {s.sub && (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{s.sub}</div>
            )}
          </div>
        );
      },
    },
    {
      title: "Тариф",
      dataIndex: "tariffName",
      width: 110,
      render: (v) => v ?? "—",
    },
    {
      title: "Последняя активность",
      key: "activity",
      width: 150,
      render: (_v, r) => {
        const d = daysAgo(r.lastActivityAt);
        if (d == null) return <span style={{ color: "#94a3b8" }}>нет входов</span>;
        const stale = d > 14;
        return (
          <span style={{ color: stale ? "#ef4444" : undefined }}>
            {fmtShort(r.lastActivityAt)}
            <div style={{ fontSize: 12, color: stale ? "#ef4444" : "#94a3b8" }}>
              {d === 0 ? "сегодня" : `${d} дн. назад`}
            </div>
          </span>
        );
      },
    },
    {
      title: "Отрасль",
      dataIndex: "industryName",
      width: 130,
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "Владелец",
      key: "owner",
      width: 160,
      render: (_v, r) =>
        r.ownerName || r.ownerPhone ? (
          <div>
            <div>{r.ownerName ?? "—"}</div>
            {r.ownerPhone && (
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                {r.ownerPhone}
              </div>
            )}
          </div>
        ) : (
          "—"
        ),
    },
    {
      title: (
        <Tooltip title="Объём данных: число сделок — показатель размера клиента">
          Объём
        </Tooltip>
      ),
      dataIndex: "deals",
      width: 90,
      sorter: (a, b) => a.deals - b.deals,
      render: (v: number) => v.toLocaleString("ru-RU"),
    },
    {
      title: (
        <Tooltip title="Сколько места занимают записи звонков компании">
          Записи
        </Tooltip>
      ),
      dataIndex: "recordingsBytes",
      width: 100,
      sorter: (a, b) => (a.recordingsBytes ?? 0) - (b.recordingsBytes ?? 0),
      render: (v: number | null | undefined, r) =>
        v ? (
          <Tooltip title={`${r.recordingsCount ?? 0} шт.`}>{formatBytes(v)}</Tooltip>
        ) : (
          "—"
        ),
    },
    {
      title: "Создана",
      dataIndex: "createdAt",
      width: 110,
      render: (v: string) => new Date(v).toLocaleDateString("ru-RU"),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
      <PageHeader
        title="Компании"
        subtitle="Все компании платформы"
        extra={
          <Space>
            <PlatformRecordingsBadge />
            <Button
              onClick={() => applyFilter("attention")}
              danger={filter === "attention"}
            >
              ⚠ Требуют внимания
            </Button>
            {can("tenants.create") && (
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                Создать компанию
              </Button>
            )}
          </Space>
        }
      />

      {/* Метрики — единый минималистичный стиль (кликабельные = фильтры) */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} lg={6}>
          <StatTile
            label="MRR (мес. выручка)"
            value={money(overview?.mrr ?? 0)}
            accent={SERIES.aqua}
            tip="Сумма месячных цен активных компаний с действующей оплатой (годовой ÷ 12). Без удалённых/замороженных/тестовых."
          />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <StatTile
            label="Всего компаний"
            value={overview?.total ?? 0}
            accent={SERIES.blue}
            hint="активные + триал"
            tip="Живые компании (активные + триал), без удалённых."
          />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <StatTile
            label="Новые за месяц"
            value={overview?.newThisMonth ?? 0}
            accent={SERIES.violet}
            tip="Зарегистрированы с 1-го числа месяца, без тестовых."
          />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <StatTile
            label="Конверсия"
            value={overview?.conversionRate == null ? "—" : overview.conversionRate}
            suffix={overview?.conversionRate == null ? "" : "%"}
            accent={SERIES.yellow}
            hint={overview?.conversionRate == null ? "мало компаний" : "триал → оплата"}
            tip="Доля хоть раз оплативших от всех неудалённых. Скрыта при малом числе (шум)."
          />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <StatTile
            label="Триал ≤3 дн."
            value={overview?.trialsExpiringSoon ?? 0}
            accent={SERIES.orange}
            onClick={() => applyFilter("trial_expiring")}
            active={filter === "trial_expiring"}
            tip="Кликните, чтобы отфильтровать список."
          />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <StatTile
            label="Оплата просрочена"
            value={overview?.overdue ?? 0}
            accent={SERIES.red}
            onClick={() => applyFilter("overdue")}
            active={filter === "overdue"}
            tip="Кликните, чтобы отфильтровать список."
          />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <StatTile
            label="Отток (блок/удал.)"
            value={overview?.churned ?? 0}
            accent={SERIES.red}
            tip="Заблокированные + удалённые. Тестовые исключены."
          />
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <StatTile
            label="Удалённые"
            value={overview?.deleted ?? 0}
            accent="#94a3b8"
            tip="Удалённые компании — отдельно, чтобы не задваивать отток."
          />
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
            defaultValue={search}
            style={{ maxWidth: 300 }}
            onSearch={setSearch}
            onChange={(e) => {
              if (!e.target.value) setSearch("");
            }}
          />
          <Select
            value={status}
            style={{ width: 150 }}
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
          <Select
            value={tariffId || ""}
            style={{ width: 150 }}
            onChange={(v) => setTariffId(v)}
            options={[
              { value: "", label: "Все тарифы" },
              ...(tariffs ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
          <Select
            value={industryId || ""}
            style={{ width: 160 }}
            onChange={(v) => setIndustryId(v)}
            options={[
              { value: "", label: "Все отрасли" },
              ...(industries ?? []).map((i) => ({
                value: i.id,
                label: i.nameRu,
              })),
            ]}
          />
          <Select
            value={filter || ""}
            style={{ width: 190 }}
            onChange={(v) => {
              setFilter(v as TenantFilter);
              setStatus("");
            }}
            options={[
              { value: "", label: "Без доп. фильтра" },
              { value: "expiring_7d", label: "Оплата истекает ≤7 дн." },
              { value: "inactive_14d", label: "Неактивны > 14 дн." },
              { value: "trial_expiring", label: "Триал истекает ≤3 дн." },
              { value: "overdue", label: "Оплата просрочена" },
              { value: "attention", label: "⚠ Требуют внимания" },
            ]}
          />
          <Select
            value={sort || ""}
            style={{ width: 170 }}
            onChange={(v) => setSort(v)}
            options={[
              { value: "", label: "Сортировка: дата" },
              { value: "mrr", label: "Сортировка: MRR" },
              { value: "activity", label: "Сортировка: активность" },
              { value: "recordings", label: "Сортировка: объём записей" },
            ]}
          />
          <Checkbox
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          >
            Показать удалённые
          </Checkbox>
          <Button type="link" size="small" onClick={resetAll}>
            Сбросить
          </Button>
          <Button
            style={{ marginLeft: "auto" }}
            onClick={() => exportCsv(tenants ?? [])}
            disabled={!tenants?.length}
          >
            Экспорт CSV
          </Button>
        </div>

        {selected.length > 0 && (
          <Space style={{ marginBottom: 12 }} wrap>
            <Tag color="blue">Выбрано: {selected.length}</Tag>
            <Button
              size="small"
              disabled={!can("tenants.tariff")}
              onClick={() => setBulkTariffOpen(true)}
            >
              Сменить тариф
            </Button>
            <Button
              size="small"
              disabled={!can("billing.edit")}
              onClick={() => setBulkExtendOpen(true)}
            >
              Продлить
            </Button>
            <Button
              size="small"
              disabled={!can("tenants.notify")}
              onClick={() => setBulkNotifyOpen(true)}
            >
              Отправить уведомление
            </Button>
            <Button size="small" onClick={() => exportCsv(selectedRows)}>
              Экспорт выбранных
            </Button>
            <Button size="small" type="text" onClick={() => setSelected([])}>
              Снять выбор
            </Button>
          </Space>
        )}

        <Table<TenantRow>
          rowKey="id"
          loading={isLoading}
          dataSource={tenants ?? []}
          columns={columns}
          scroll={{ x: "max-content" }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys as string[]),
          }}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            hideOnSinglePage: true,
          }}
          onRow={(r) => ({
            onClick: () => setOpenId(r.id),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      <Modal
        open={bulkTariffOpen}
        title={`Сменить тариф у ${selected.length} компаний`}
        onCancel={() => setBulkTariffOpen(false)}
        onOk={runBulkTariff}
        okText="Применить"
        cancelText="Отмена"
        confirmLoading={bulkTariff.isPending}
      >
        <Select
          style={{ width: "100%" }}
          placeholder="Выберите тариф"
          value={bulkTariffId}
          onChange={setBulkTariffId}
          options={(tariffs ?? [])
            .filter((t) => !t.archived)
            .map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }))}
        />
      </Modal>

      <Modal
        open={bulkExtendOpen}
        title={`Продлить подписку ${selected.length} компаниям`}
        onCancel={() => setBulkExtendOpen(false)}
        onOk={runBulkExtend}
        okText="Продлить"
        cancelText="Отмена"
        confirmLoading={bulkExtend.isPending}
      >
        <div style={{ marginBottom: 8 }}>
          Каждой выбранной компании продлим «оплачено до» на выбранный период
          (ручная отметка оплаты, статус станет «активна»).
        </div>
        <Select
          style={{ width: "100%" }}
          value={bulkExtendMonths}
          onChange={setBulkExtendMonths}
          options={[1, 3, 6, 12].map((m) => ({
            value: m,
            label: `${m} мес.`,
          }))}
        />
      </Modal>

      <Modal
        open={bulkNotifyOpen}
        title={`Отправить уведомление ${selected.length} компаниям`}
        onCancel={() => setBulkNotifyOpen(false)}
        onOk={runBulkNotify}
        okText="Отправить"
        cancelText="Отмена"
        confirmLoading={bulkNotify.isPending}
      >
        <Select
          style={{ width: "100%" }}
          placeholder="Тип уведомления"
          value={bulkType}
          onChange={setBulkType}
          options={REMINDER_TYPES}
        />
      </Modal>

      <TenantDrawer tenantId={openId} onClose={() => setOpenId(null)} />
      <CreateTenantModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};
