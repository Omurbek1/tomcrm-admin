import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";

import { can } from "../api/client";
import { PageHeader, StatTile } from "../components/viz";
import { SERIES } from "../lib/chartTheme";
import {
  useBillingHealth,
  useBillingInvoices,
  useLimitOverages,
  useConfirmEvent,
  useMarkInvoicePaid,
  useMarkManualPayment,
  useTenants,
  useUnverifiedEvents,
  type BillingInvoiceRow,
  type LimitOverageRow,
  type UnverifiedEvent,
} from "../hooks";

const { Text } = Typography;

const money = (v: string | number, currency = "KGS") =>
  `${Number(v).toLocaleString("ru-RU")} ${currency}`;

const date = (v: string | null) =>
  v ? new Date(v).toLocaleString("ru-RU") : "—";

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

const PERIODS = [1, 3, 6, 12];

export const BillingPage = () => {
  const { message } = App.useApp();
  const { data: invoices, isLoading } = useBillingInvoices();
  const { data: overages } = useLimitOverages();
  const { data: health } = useBillingHealth();
  const { data: unverified } = useUnverifiedEvents();
  const confirmEvent = useConfirmEvent();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const markManual = useMarkManualPayment();
  const markPaid = useMarkInvoicePaid();
  const [modalOpen, setModalOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState("");
  const { data: tenants } = useTenants({ search: tenantSearch });
  const [form] = Form.useForm();

  // Фильтры (клиентские — список небольшой, приходит целиком).
  const [statusF, setStatusF] = useState<"all" | BillingInvoiceRow["status"]>(
    "all",
  );
  const [providerF, setProviderF] = useState<"all" | "finik" | "manual">("all");
  const [search, setSearch] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);

  const editable = can("billing.edit");
  const rows = useMemo(() => invoices || [], [invoices]);

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

  const submit = async () => {
    const v = await form.validateFields();
    try {
      await markManual.mutateAsync({
        tenantId: v.tenantId,
        periodMonths: v.periodMonths,
        amount: v.amount ?? null,
        method: v.method ?? null,
        note: v.note ?? null,
      });
      message.success("Оплата отмечена, подписка продлена");
      setModalOpen(false);
      form.resetFields();
    } catch (e) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Не удалось отметить оплату";
      message.error(msg);
    }
  };

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
    { title: "Дата", dataIndex: "createdAt", key: "createdAt", render: date, width: 150 },
    {
      title: "Компания",
      dataIndex: "tenantName",
      key: "tenantName",
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
      ellipsis: true,
    },
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
      width: 100,
      render: (v: string) =>
        v === "manual" ? (
          <Tag>Вручную</Tag>
        ) : (
          <Tag color="blue">{v === "finik" ? "Finik QR" : v}</Tag>
        ),
    },
    {
      title: "Статус",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: BillingInvoiceRow["status"], r) => {
        const m = STATUS[v] ?? STATUS.draft;
        return (
          <Space size={4}>
            <Tag color={m.color}>{m.label}</Tag>
            {v === "pending" && r.provider === "finik" && (
              <Tooltip title="Оплата в Finik могла пройти, но вебхук ещё не зачислил. Проверьте и проведите вручную.">
                <Tag color="warning">ждёт вебхук</Tag>
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
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <PageHeader
        title="Биллинг"
        subtitle="Счета, оплаты и приём вебхуков Finik"
        extra={
          editable && (
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Отметить оплату
            </Button>
          )
        }
      />
      {/* (4.2/4.3) Алерт здоровья вебхуков — виден в UI, не только в логах */}
      {health &&
        (health.invalidSignatureLastHour > 0 ||
          health.stuckPending.length > 0) && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            title="Проблема с приёмом вебхуков Finik"
            description={
              <>
                {health.invalidSignatureLastHour > 0 && (
                  <div>
                    Отклонено по подписи за час:{" "}
                    <b>{health.invalidSignatureLastHour}</b> из{" "}
                    {health.webhookLastHour}. Проверьте{" "}
                    <code>FINIK_WEBHOOK_PUBLIC_PEM</code> (публичный ключ
                    FINIK).
                  </div>
                )}
                {health.stuckPending.length > 0 && (
                  <div>
                    Счетов с пришедшим вебхуком, но всё ещё «Ожидает» (&gt;30
                    мин): <b>{health.stuckPending.length}</b>. Проведите их
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
          style={{ marginBottom: 16, borderColor: "#ff4d4f" }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Используется больше, чем оплачено. Компании уведомлены; по номерам
            WhatsApp через 3 дня отправка с лишних номеров останавливается.
          </Text>
          <Table<LimitOverageRow>
            rowKey={(r) => `${r.tenantId}:${r.optionKey}`}
            size="small"
            style={{ marginTop: 12 }}
            pagination={false}
            dataSource={overages}
            columns={[
              {
                title: "Компания",
                dataIndex: "tenantName",
                render: (v, r) => v || r.tenantId,
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
          style={{ marginBottom: 16, borderColor: "#faad14" }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Ключ Finik ещё не задан, поэтому подпись не проверяется. Сверьте
            сумму и транзакцию глазами, затем подтвердите — подписка
            активируется, действие попадёт в аудит.
          </Text>
          <Table<UnverifiedEvent>
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
                render: (v: string | null) =>
                  v || <Text type="secondary">—</Text>,
                ellipsis: true,
              },
              {
                title: "Сумма (вебхук / счёт)",
                key: "amount",
                width: 190,
                render: (_: unknown, r) => {
                  const wa = r.webhookAmount;
                  const ia = r.invoiceAmount;
                  const mismatch =
                    wa != null && ia != null && Number(wa) !== Number(ia);
                  return (
                    <span style={{ color: mismatch ? "#cf1322" : undefined }}>
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

      {/* Сводка — единые KPI-плитки */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <StatTile
            label="Всего счетов"
            value={counts.total}
            accent={SERIES.blue}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatTile label="Оплачено" value={counts.paid} accent={SERIES.aqua} />
        </Col>
        <Col xs={12} sm={6}>
          <StatTile
            label="Ожидают"
            value={counts.pending}
            accent={SERIES.orange}
          />
        </Col>
        <Col xs={12} sm={6}>
          <StatTile label="Ошибки" value={counts.failed} accent={SERIES.red} />
        </Col>
      </Row>

      {/* Подсказка про застрявшие оплаты Finik */}
      {pendingFinik.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${pendingFinik.length} счёт(ов) Finik ожидают проведения`}
          description="Оплата могла пройти, но вебхук ещё не зачислил её (например, не задан публичный ключ Finik). Проверьте оплату и нажмите «Провести» в строке счёта."
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

      <Table<BillingInvoiceRow>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={filtered}
        columns={columns}
        pagination={{
          pageSize: 25,
          showSizeChanger: false,
          hideOnSinglePage: true,
        }}
        scroll={{ x: 1040 }}
      />

      <Modal
        title="Отметить ручную оплату"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        okText="Отметить оплату"
        confirmLoading={markManual.isPending}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title="Создаёт новый оплаченный счёт и продлевает подписку."
          description="Для оплаты, которая уже прошла в Finik, лучше нажать «Провести» в строке нужного счёта — так не появится дубль."
        />
        <Form form={form} layout="vertical" initialValues={{ periodMonths: 1 }}>
          <Form.Item
            name="tenantId"
            label="Компания"
            rules={[{ required: true, message: "Выберите компанию" }]}
          >
            <Select
              showSearch={{ onSearch: setTenantSearch }}
              placeholder="Начните вводить название"
              options={(tenants || []).map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="periodMonths"
            label="Период (мес.)"
            rules={[{ required: true }]}
          >
            <Select
              options={PERIODS.map((m) => ({ value: m, label: `${m} мес.` }))}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Сумма (необязательно — иначе по тарифу)"
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0}
              placeholder="Оставьте пустым для расчёта по тарифу"
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
            />
          </Form.Item>
          <Form.Item name="method" label="Способ">
            <Select
              allowClear
              placeholder="Наличные / перевод / …"
              options={[
                { value: "cash", label: "Наличные" },
                { value: "transfer", label: "Банковский перевод" },
                { value: "card", label: "Карта (вручную)" },
                { value: "other", label: "Другое" },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="Заметка (необязательно)">
            <Input.TextArea
              rows={2}
              placeholder="Комментарий для истории (кто/за что)"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
