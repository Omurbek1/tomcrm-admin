import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Input,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { PlusOutlined } from "@ant-design/icons";

import { can } from "../api/client";
import { openAddSubscription } from "../components/AddSubscriptionModal";
import { QueryError } from "../components/QueryError";
import { TenantLink } from "../components/TenantLink";
import { PageHeader, StatTile } from "../components/viz";
import { SERIES } from "../lib/chartTheme";
import {
  useBillingHealth,
  useBillingInvoices,
  useLimitOverages,
  useConfirmEvent,
  useMarkInvoicePaid,
  useUnverifiedEvents,
  type BillingInvoiceRow,
  type LimitOverageRow,
  type UnverifiedEvent,
} from "../hooks";
import { ResponsiveTable } from "../components/MobileCards";

const { Text } = Typography;

const money = (v: string | number, currency = "KGS") =>
  `${Number(v).toLocaleString("ru-RU")} ${currency === "KGS" ? "сом" : currency}`;

const som = (v: number) => `${Math.round(v).toLocaleString("ru-RU")} сом`;

const date = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const STATUS: Record<
  BillingInvoiceRow["status"],
  { color: string; label: string }
> = {
  draft: { color: "default", label: "Черновик" },
  pending: { color: "processing", label: "Ожидает" },
  paid: { color: "success", label: "Оплачен" },
  expired: { color: "default", label: "Истёк" },
  cancelled: { color: "default", label: "Отменён" },
  failed: { color: "error", label: "Ошибка" },
};

const MANUAL_METHOD: Record<string, string> = {
  cash: "наличные",
  transfer: "перевод",
  card: "карта",
  free: "бесплатно",
};


const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11
    ? one
    : d >= 2 && d <= 4 && (h < 12 || h > 14)
      ? few
      : many;
};

export const BillingPage = () => {
  const { message } = App.useApp();
  const { data: invoices, isLoading, isError, refetch } = useBillingInvoices();
  const { data: overages } = useLimitOverages();
  const { data: health } = useBillingHealth();
  const { data: unverified } = useUnverifiedEvents();
  const confirmEvent = useConfirmEvent();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const markPaid = useMarkInvoicePaid();

  // Фильтры (клиентские — список небольшой, приходит целиком).
  // Фильтры приходят и из адреса: «Обзор» открывает сразу нужные счета
  // (?status=pending&provider=finik) или раздел (?focus=overages).
  const [statusF, setStatusF] = useState<"all" | BillingInvoiceRow["status"]>(
    () =>
      (new URLSearchParams(window.location.search).get("status") as
        | BillingInvoiceRow["status"]
        | null) ?? "all",
  );
  const [providerF, setProviderF] = useState<"all" | "finik" | "manual">(
    () =>
      (new URLSearchParams(window.location.search).get("provider") as
        | "finik"
        | "manual"
        | null) ?? "all",
  );
  const toggleStatus = (s: BillingInvoiceRow["status"]) =>
    setStatusF((cur) => (cur === s ? "all" : s));
  const [search, setSearch] = useState("");
  useEffect(() => {
    const url = new URL(window.location.href);
    if (statusF === "all") url.searchParams.delete("status");
    else url.searchParams.set("status", statusF);
    if (providerF === "all") url.searchParams.delete("provider");
    else url.searchParams.set("provider", providerF);
    window.history.replaceState(null, "", url.toString());
  }, [statusF, providerF]);
  // ?focus= из «Обзора» — прокрутить к нужному блоку, когда он появится.
  const focus = new URLSearchParams(window.location.search).get("focus");
  const focusReady =
    focus === "overages" ? !!overages?.length
    : focus === "unverified" ? !!unverified?.length
    : focus === "health" ? !!health
    : false;
  useEffect(() => {
    if (!focus || !focusReady) return;
    document
      .getElementById(`billing-${focus}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Прокрутили один раз — убираем из адреса, F5 не дёргает страницу снова.
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    window.history.replaceState(null, "", url.toString());
  }, [focus, focusReady]);
  const [payingId, setPayingId] = useState<string | null>(null);

  const editable = can("billing.edit");
  const rows = useMemo(() => invoices || [], [invoices]);

  // Деньги по месяцу оплаты (paidAt), только KGS.
  const received = useMemo(() => {
    const now = new Date();
    const cur = `${now.getFullYear()}-${now.getMonth()}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prev = `${prevDate.getFullYear()}-${prevDate.getMonth()}`;
    const r = { cur: 0, curN: 0, prev: 0, prevN: 0 };
    for (const i of rows) {
      if (i.status !== "paid" || !i.paidAt || i.currency !== "KGS") continue;
      const d = new Date(i.paidAt);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (k === cur) {
        r.cur += Number(i.amount) || 0;
        r.curN += 1;
      } else if (k === prev) {
        r.prev += Number(i.amount) || 0;
        r.prevN += 1;
      }
    }
    return r;
  }, [rows]);
  const counts = useMemo(() => {
    const c = { total: rows.length, paid: 0, pending: 0, failed: 0 };
    for (const r of rows) {
      if (r.status === "paid") c.paid += 1;
      else if (r.status === "pending") c.pending += 1;
      else if (r.status === "failed") c.failed += 1;
    }
    return c;
  }, [rows]);

  // Главный сигнал: оплата в Finik прошла, но вебхук не зачислил → ждут «Провести».
  const pendingFinik = useMemo(
    () => rows.filter((r) => r.status === "pending" && r.provider === "finik"),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (statusF === "all" || r.status === statusF) &&
        (providerF === "all" || r.provider === providerF) &&
        (!q || (r.tenantName || "").toLowerCase().includes(q)),
    );
  }, [rows, statusF, providerF, search]);

  const credit = async (r: BillingInvoiceRow) => {
    setPayingId(r.id);
    try {
      await markPaid.mutateAsync(r.id);
      message.success("Счёт проведён — подписка активирована");
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Не удалось провести счёт";
      message.error(msg);
    } finally {
      setPayingId(null);
    }
  };

  const confirm = async (ev: UnverifiedEvent) => {
    setConfirmingId(ev.eventId);
    try {
      await confirmEvent.mutateAsync(ev.eventId);
      message.success("Подтверждено вручную — подписка активирована");
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Не удалось подтвердить";
      message.error(msg);
    } finally {
      setConfirmingId(null);
    }
  };

  const columns: ColumnsType<BillingInvoiceRow> = [
    // Компания — первой: на телефоне первая колонка становится заголовком карточки.
    {
      title: "Компания",
      width: 240,
      dataIndex: "tenantName",
      key: "tenantName",
      render: (v: string | null, r) => <TenantLink id={r.tenantId} name={v} />,
      ellipsis: true,
    },
    { title: "Дата", dataIndex: "createdAt", key: "createdAt", render: date, width: 130 },
    {
      title: "Назначение",
      key: "kind",
      width: 150,
      render: (_: unknown, r) =>
        r.kind === "addon" ? (
          <Tag color="purple">Докупка{r.addonQty ? ` ×${r.addonQty}` : ""}</Tag>
        ) : (
          <Text>Подписка</Text>
        ),
    },
    {
      title: "Период",
      dataIndex: "periodMonths",
      key: "periodMonths",
      render: (v: number) => `${v} мес.`,
      width: 80,
    },
    {
      title: "Сумма",
      dataIndex: "amount",
      key: "amount",
      render: (v: string, r) => money(v, r.currency),
      width: 120,
    },
    {
      title: "Способ",
      dataIndex: "provider",
      key: "provider",
      width: 150,
      render: (v: string, r) =>
        v === "manual" ? (
          <Tooltip
            title={
              [r.adminLogin ? `Отметил: ${r.adminLogin}` : null, r.note]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            <Tag>
              Вручную
              {r.manualMethod ? ` · ${MANUAL_METHOD[r.manualMethod] ?? r.manualMethod}` : ""}
            </Tag>
          </Tooltip>
        ) : (
          <Tag color="blue">{v === "finik" ? "Finik QR" : v}</Tag>
        ),
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      width: 190,
      render: (v: BillingInvoiceRow["status"], r) => {
        const m = STATUS[v] ?? STATUS.draft;
        return (
          <Space size={4}>
            <Tag color={m.color}>{m.label}</Tag>
            {v === "pending" && r.provider === "finik" && (
              <Tooltip title="Оплата в Finik могла пройти, но Finik ещё не прислал подтверждение. Проверьте и проведите вручную.">
                <Tag color="warning">ждёт подтверждения Finik</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Оплачено до",
      dataIndex: "paidUntil",
      key: "paidUntil",
      width: 120,
      render: (v: string | null) =>
        v ? new Date(v).toLocaleDateString("ru-RU") : "—",
    },
    {
      title: "Действие",
      key: "action",
      width: 130,
      fixed: "right",
      render: (_: unknown, r) =>
        editable && r.status === "pending" ? (
          <Popconfirm
            title="Провести этот счёт?"
            description="Подписка активируется, счёт станет «Оплачен». Задвоения не будет."
            okText="Провести"
            cancelText="Отмена"
            onConfirm={() => credit(r)}
          >
            <Button
              size="small"
              type="primary"
              ghost
              loading={payingId === r.id}
            >
              Провести
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  const statusOptions = [
    { value: "all", label: `Все · ${counts.total}` },
    { value: "pending", label: `Ожидают · ${counts.pending}` },
    { value: "paid", label: `Оплачены · ${counts.paid}` },
    { value: "failed", label: `Ошибки · ${counts.failed}` },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Биллинг"
        subtitle="Счета, ручные и онлайн-оплаты, проверка оплат Finik"
        extra={
          editable && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openAddSubscription()}
            >
              Добавить подписку
            </Button>
          )
        }
      />
      {/* (4.2/4.3) Алерт здоровья вебхуков — виден в UI, не только в логах */}
      {health &&
        (health.invalidSignatureLastHour > 0 ||
          health.stuckPending.length > 0) && (
          <Alert
            id="billing-health"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            title="Finik присылает оплаты, которые не удаётся принять"
            description={
              <>
                {health.invalidSignatureLastHour > 0 && (
                  <div>
                    Отклонено по подписи за час:{" "}
                    <b>{health.invalidSignatureLastHour}</b> из{" "}
                    {health.webhookLastHour}. Похоже, ключ проверки Finik
                    не задан или устарел — передайте разработчику
                    (FINIK_WEBHOOK_PUBLIC_PEM).
                  </div>
                )}
                {health.stuckPending.length > 0 && (
                  <div>
                    Счетов, по которым Finik ответил, но они всё ещё «Ожидают»
                    (дольше 30 мин): <b>{health.stuckPending.length}</b>. Проведите их
                    вручную кнопкой «Провести».
                  </div>
                )}
              </>
            }
          />
        )}

      {/* 1.3 Оплачено ≠ используется — видно как ошибку, блокировка через 3 дня */}
      {overages && overages.length > 0 && (
        <Card
          size="small"
          type="inner"
          title={`Превышения оплаченных лимитов (${overages.length})`}
          id="billing-overages"
          style={{ marginBottom: 16, borderColor: "var(--danger)" }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Используется больше, чем оплачено. Компании уведомлены; по номерам
            WhatsApp через 3 дня отправка с лишних номеров останавливается.
          </Text>
          <ResponsiveTable<LimitOverageRow>
            rowKey={(r) => `${r.tenantId}:${r.optionKey}`}
            size="small"
            style={{ marginTop: 12 }}
            pagination={false}
            dataSource={overages}
            columns={[
              {
                title: "Компания",
                dataIndex: "tenantName",
                render: (v: string | null, r) => <TenantLink id={r.tenantId} name={v} />,
              },
              {
                title: "Опция",
                dataIndex: "optionKey",
                render: (v: string) =>
                  v === "whatsappNumbers"
                    ? "Номера WhatsApp"
                    : v === "users"
                      ? "Сотрудники"
                      : v,
              },
              {
                title: "Используется / оплачено",
                render: (_, r) => (
                  <Text type="danger" strong>
                    {r.usedQty} из {r.paidQty ?? "∞"}
                  </Text>
                ),
              },
              {
                title: "С",
                dataIndex: "overSince",
                render: (v: string | null) =>
                  v ? new Date(v).toLocaleDateString("ru-RU") : "—",
              },
              {
                title: "Статус",
                dataIndex: "blockedAt",
                render: (v: string | null) =>
                  v ? (
                    <Tag color="red">Заблокировано</Tag>
                  ) : (
                    <Tag color="orange">Предупреждение</Tag>
                  ),
              },
            ]}
          />
        </Card>
      )}

      {/* (п.2) Платежи с непроверенной подписью (DEGRADED) — подтвердить вручную */}
      {editable && unverified && unverified.length > 0 && (
        <Card
          size="small"
          type="inner"
          title={`Платежи без проверки подписи — подтвердить вручную (${unverified.length})`}
          id="billing-unverified"
          style={{ marginBottom: 16, borderColor: "var(--warning)" }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Ключ Finik ещё не задан, поэтому подпись не проверяется. Сверьте
            сумму и транзакцию глазами, затем подтвердите — подписка
            активируется, действие попадёт в аудит.
          </Text>
          <ResponsiveTable<UnverifiedEvent>
            rowKey="eventId"
            size="small"
            style={{ marginTop: 12 }}
            dataSource={unverified}
            pagination={false}
            scroll={{ x: 720 }}
            columns={[
              {
                title: "Дата",
                dataIndex: "receivedAt",
                key: "receivedAt",
                render: date,
                width: 150,
              },
              {
                title: "Компания",
                dataIndex: "tenantName",
                key: "tenantName",
                render: (v: string | null, r) =>
                  r.tenantId ? (
                    <TenantLink id={r.tenantId} name={v} />
                  ) : (
                    v || <Text type="secondary">—</Text>
                  ),
                ellipsis: true,
              },
              {
                title: "Сумма (от Finik / в счёте)",
                key: "amount",
                width: 190,
                render: (_: unknown, r) => {
                  const wa = r.webhookAmount;
                  const ia = r.invoiceAmount;
                  const mismatch =
                    wa != null && ia != null && Number(wa) !== Number(ia);
                  return (
                    <span style={{ color: mismatch ? "var(--danger-text)" : undefined }}>
                      {wa != null ? money(wa) : "—"} /{" "}
                      {ia != null ? money(ia) : "—"}
                      {mismatch && " ⚠"}
                    </span>
                  );
                },
              },
              {
                title: "Транзакция",
                dataIndex: "transactionId",
                key: "txn",
                render: (v: string | null) => (
                  <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                    {v || "—"}
                  </span>
                ),
              },
              {
                title: "Действие",
                key: "action",
                width: 180,
                fixed: "right",
                render: (_: unknown, r) => (
                  <Popconfirm
                    title="Подтвердить платёж вручную?"
                    description={
                      <div style={{ maxWidth: 260 }}>
                        Сверьте: сумма{" "}
                        <b>
                          {r.webhookAmount != null
                            ? money(r.webhookAmount)
                            : "—"}
                        </b>
                        , транзакция <code>{r.transactionId || "—"}</code>.
                        Подписка активируется, запишется в аудит.
                      </div>
                    }
                    okText="Подтвердить"
                    cancelText="Отмена"
                    disabled={!r.invoiceId}
                    onConfirm={() => confirm(r)}
                  >
                    <Button
                      size="small"
                      type="primary"
                      loading={confirmingId === r.eventId}
                      disabled={!r.invoiceId}
                    >
                      Подтвердить вручную
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* Сводка: деньги, а не число счетов. */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <StatTile
            label="Получено в этом месяце"
            value={som(received.cur)}
            hint={`${received.curN} ${plural(received.curN, "оплата", "оплаты", "оплат")}`}
            accent={SERIES.aqua}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatTile
            label="За прошлый месяц"
            value={som(received.prev)}
            hint={`${received.prevN} ${plural(received.prevN, "оплата", "оплаты", "оплат")}`}
            accent={SERIES.blue}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatTile
            label="Ждут оплаты"
            value={counts.pending}
            hint="счёт выставлен, денег нет"
            accent={SERIES.orange}
            onClick={() => toggleStatus("pending")}
            active={statusF === "pending"}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatTile
            label="Ошибки оплаты"
            value={counts.failed}
            hint={statusF === "failed" ? "нажмите — показать все" : "нажмите — показать"}
            accent={SERIES.red}
            onClick={() => toggleStatus("failed")}
            active={statusF === "failed"}
          />
        </Col>
      </Row>

      {/* Подсказка про застрявшие оплаты Finik */}
      {pendingFinik.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${pendingFinik.length} ${plural(pendingFinik.length, "счёт", "счёта", "счетов")} Finik ${pendingFinik.length === 1 ? "ожидает" : "ожидают"} проведения`}
          description="Оплата могла пройти, но Finik ещё не прислал подтверждение (например, не задан ключ проверки Finik). Проверьте оплату и нажмите «Провести» в строке счёта."
          action={
            statusF !== "pending" || providerF !== "finik" ? (
              <Button
                size="small"
                onClick={() => {
                  setStatusF("pending");
                  setProviderF("finik");
                }}
              >
                Показать их
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Фильтры */}
      <Space size={12} style={{ marginBottom: 12 }} wrap>
        <Segmented
          value={statusF}
          onChange={(v) => setStatusF(v as typeof statusF)}
          options={statusOptions}
        />
        <Select
          value={providerF}
          onChange={setProviderF}
          style={{ width: 150 }}
          options={[
            { value: "all", label: "Все способы" },
            { value: "finik", label: "Finik QR" },
            { value: "manual", label: "Вручную" },
          ]}
        />
        <Input.Search
          allowClear
          placeholder="Компания"
          style={{ width: 220 }}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Space>

      {isError ? <QueryError what="счета" onRetry={refetch} /> : null}
      <ResponsiveTable<BillingInvoiceRow>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={filtered}
        columns={columns}
        virtualList={{ x: 1260 }}
      />

    </div>
  );
};
