import { SearchOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";

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
import { PageHeader } from "../components/viz";
import { CreateTenantModal } from "./CreateTenantModal";
import { MobileCards, MRow, useIsMobile } from "../components/MobileCards";
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

const companiesWord = (n: number) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11
    ? "компании"
    : "компаниям";
};

/** Кого коснётся массовое действие — видно до нажатия. */
const AffectedList = ({ rows }: { rows: TenantRow[] }) => (
  <div className="affected">
    <div className="affected-title">Затронет ({rows.length}):</div>
    <ul>
      {rows.slice(0, 50).map((r) => (
        <li key={r.id}>
          {r.name}
          <span className="affected-sub">
            {r.tariffName ?? "без тарифа"}
            {r.paidUntil
              ? ` · до ${new Date(r.paidUntil).toLocaleDateString("ru-RU")}`
              : ""}
          </span>
        </li>
      ))}
      {rows.length > 50 ? <li className="affected-sub">…и ещё {rows.length - 50}</li> : null}
    </ul>
  </div>
);

export const TenantsPage = () => {
  const init = readUrl();
  const [search, setSearch] = useState(init.search);
  // Поиск без Enter: запрос через 300 мс после последней буквы.
  const [searchInput, setSearchInput] = useState(init.search);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
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
  const isMobile = useIsMobile();
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

  // Открытая карточка ↔ URL (?id=<slug>). Пока список не пришёл, ?id= из
  // ссылки (Ctrl+K, F5, ссылка коллеге) не трогаем — иначе стирали его до
  // того, как успевали открыть карточку.
  const pendingSlug = useRef(new URLSearchParams(window.location.search).get("id"));
  useEffect(() => {
    if (!pendingSlug.current || !tenants) return;
    const found = tenants.find(
      (t) => t.slug === pendingSlug.current || t.id === pendingSlug.current,
    );
    pendingSlug.current = null;
    if (found) setOpenId(found.id);
  }, [tenants]);
  useEffect(() => {
    if (pendingSlug.current) return;
    const url = new URL(window.location.href);
    const slug = tenants?.find((t) => t.id === openId)?.slug;
    if (openId && slug) url.searchParams.set("id", slug);
    else url.searchParams.delete("id");
    window.history.replaceState(null, "", url.toString());
  }, [openId, tenants]);

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

  const resetAll = () => {
    setSearch("");
    setSearchInput("");
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
          <div style={{ fontSize: 12, color: "#94a3b8" }}>
            /{r.slug}
            {r.industryName ? ` · ${r.industryName}` : ""}
          </div>
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
      title: "В месяц",
      dataIndex: "mrr",
      width: 120,
      align: "right",
      sorter: (a, b) => Number(a.mrr ?? 0) - Number(b.mrr ?? 0),
      render: (v: number | null, r) =>
        r.status === "active" && Number(v) > 0 ? (
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(v)}</span>
        ) : (
          <span style={{ color: "#94a3b8" }}>—</span>
        ),
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
            {can("tenants.create") && (
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                Создать компанию
              </Button>
            )}
          </Space>
        }
      />

      {/* Быстрые фильтры: одно нажатие — нужный список (цифры как на «Обзоре»). */}
      <div className="chips" role="toolbar" aria-label="Быстрые фильтры">
        {(
          [
            ["", "Все", overview?.total],
            ["attention", "Требуют внимания", undefined],
            ["overdue", "Оплата просрочена", overview?.overdue],
            ["trial_expiring", "Триал ≤3 дн.", overview?.trialsExpiringSoon],
            ["expiring_7d", "Оплата истекает ≤7 дн.", undefined],
            ["inactive_14d", "Неактивны > 14 дн.", undefined],
          ] as Array<[TenantFilter, string, number | undefined]>
        ).map(([key, label, n]) => (
          <button
            key={key || "all"}
            type="button"
            className={`chip${filter === key && !status ? " is-on" : ""}`}
            aria-pressed={filter === key && !status}
            onClick={() => {
              setStatus("");
              setFilter(key);
            }}
          >
            {label}
            {n ? <span className="chip-n">{n.toLocaleString("ru-RU")}</span> : null}
          </button>
        ))}
      </div>

      <Card className="m-flat">
        <div
          className="filter-bar"
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Input
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            placeholder="Название, адрес или телефон"
            allowClear
            value={searchInput}
            style={{ maxWidth: 300 }}
            onChange={(e) => setSearchInput(e.target.value)}
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
            value={sort || ""}
            style={{ width: 170 }}
            onChange={(v) => setSort(v)}
            options={[
              { value: "", label: "Сначала новые" },
              { value: "mrr", label: "Больше платят" },
              { value: "activity", label: "Недавно заходили" },
              { value: "recordings", label: "Больше записей звонков" },
            ]}
          />
          <Checkbox
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          >
            Показать удалённые
          </Checkbox>
          <span className="muted">
            Найдено: {(tenants?.length ?? 0).toLocaleString("ru-RU")}
          </span>
          <Button type="link" size="small" onClick={resetAll}>
            Сбросить
          </Button>
          <Button
            className="m-hide"
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

        {isMobile ? (
          <MobileCards<TenantRow>
            rows={tenants ?? []}
            rowKey={(r) => r.id}
            loading={isLoading}
            emptyText="Компаний не найдено"
            onOpen={(r) => setOpenId(r.id)}
            render={(r) => {
              const st = stateOf(r);
              const d = daysAgo(r.lastActivityAt);
              return (
                <div className="m-tenant">
                  <Checkbox
                    checked={selected.includes(r.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setSelected((cur) =>
                        e.target.checked
                          ? [...cur, r.id]
                          : cur.filter((x) => x !== r.id),
                      )
                    }
                    aria-label={`Выбрать ${r.name}`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <MRow
                      main={
                        <>
                          {r.name}
                          {r.isTest ? (
                            <Tag color="purple" style={{ marginLeft: 6 }}>
                              тест
                            </Tag>
                          ) : null}
                        </>
                      }
                      sub={`/${r.slug}${r.industryName ? ` · ${r.industryName}` : ""}`}
                      side={
                        <Tag color={st.color} style={{ marginInlineEnd: 0 }}>
                          {st.label}
                        </Tag>
                      }
                    />
                    <div className="m-meta">
                      <span>{r.tariffName ?? "без тарифа"}</span>
                      {r.status === "active" && Number(r.mrr) > 0 ? (
                        <span>{money(r.mrr)}/мес</span>
                      ) : null}
                      {st.sub ? <span>{st.sub}</span> : null}
                      <span className={d != null && d > 14 ? "is-bad" : undefined}>
                        {d == null ? "нет входов" : d === 0 ? "заходили сегодня" : `заходили ${d} дн. назад`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }}
          />
        ) : (
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
        )}
      </Card>

      <Modal
        open={bulkTariffOpen}
        title={`Сменить тариф: ${selected.length}`}
        onCancel={() => setBulkTariffOpen(false)}
        onOk={runBulkTariff}
        okText="Сменить тариф"
        okButtonProps={{ disabled: !bulkTariffId }}
        destroyOnHidden
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
        <AffectedList rows={selectedRows} />
      </Modal>

      <Modal
        open={bulkExtendOpen}
        title={`Продлить подписку ${selected.length} ${companiesWord(selected.length)}`}
        onCancel={() => setBulkExtendOpen(false)}
        onOk={runBulkExtend}
        okText={`Продлить на ${bulkExtendMonths} мес.`}
        cancelText="Отмена"
        confirmLoading={bulkExtend.isPending}
        destroyOnHidden
      >
        <div style={{ marginBottom: 8 }}>
          Каждой выбранной компании продлим «оплачено до» на выбранный период
          (ручная отметка оплаты, статус станет «активна»).
        </div>
        <Segmented
          block
          value={bulkExtendMonths}
          onChange={(v) => setBulkExtendMonths(Number(v))}
          options={[1, 3, 6, 12].map((m) => ({
            value: m,
            label: `${m} мес.`,
          }))}
        />
        <AffectedList rows={selectedRows} />
      </Modal>

      <Modal
        open={bulkNotifyOpen}
        title={`Отправить уведомление ${selected.length} ${companiesWord(selected.length)}`}
        onCancel={() => setBulkNotifyOpen(false)}
        onOk={runBulkNotify}
        okText="Отправить"
        okButtonProps={{ disabled: !bulkType }}
        cancelText="Отмена"
        confirmLoading={bulkNotify.isPending}
        destroyOnHidden
      >
        <Select
          style={{ width: "100%" }}
          placeholder="Тип уведомления"
          value={bulkType}
          onChange={setBulkType}
          options={REMINDER_TYPES}
        />
        <AffectedList rows={selectedRows} />
      </Modal>

      <TenantDrawer tenantId={openId} onClose={() => setOpenId(null)} />
      <CreateTenantModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};
