import {
  App,
  Button,
  Card,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { can } from "../api/client";
import {
  useBillingInvoices,
  useMarkManualPayment,
  useTenants,
  type BillingInvoiceRow,
} from "../hooks";

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
  const markManual = useMarkManualPayment();
  const [modalOpen, setModalOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState("");
  const { data: tenants } = useTenants(tenantSearch, "", "");
  const [form] = Form.useForm();

  const editable = can("billing.edit");

  const submit = async () => {
    const v = await form.validateFields();
    try {
      await markManual.mutateAsync({
        tenantId: v.tenantId,
        periodMonths: v.periodMonths,
        amount: v.amount ?? null,
        method: v.method ?? null,
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

  const columns: ColumnsType<BillingInvoiceRow> = [
    {
      title: "Дата",
      dataIndex: "createdAt",
      key: "createdAt",
      render: date,
      width: 160,
    },
    {
      title: "Компания",
      dataIndex: "tenantName",
      key: "tenantName",
      render: (v: string | null) => v || "—",
    },
    {
      title: "Назначение",
      key: "kind",
      width: 180,
      render: (_: unknown, r) =>
        r.kind === "addon" ? (
          <Tag color="purple">Докупка{r.addonQty ? ` ×${r.addonQty}` : ""}</Tag>
        ) : (
          <span>Подписка</span>
        ),
    },
    {
      title: "Период",
      dataIndex: "periodMonths",
      key: "periodMonths",
      render: (v: number) => `${v} мес.`,
      width: 90,
    },
    {
      title: "Сумма",
      dataIndex: "amount",
      key: "amount",
      render: (v: string, r) => money(v, r.currency),
      width: 130,
    },
    {
      title: "Способ",
      dataIndex: "provider",
      key: "provider",
      width: 110,
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
      width: 120,
      render: (v: BillingInvoiceRow["status"]) => {
        const m = STATUS[v] ?? STATUS.draft;
        return <Tag color={m.color}>{m.label}</Tag>;
      },
    },
    {
      title: "Транзакция",
      dataIndex: "providerTransactionId",
      key: "txn",
      render: (v: string | null, r) => (
        <Space size={4}>
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>
            {v || "—"}
          </span>
          {r.provider === "finik" && (
            <Tooltip
              title={
                r.signatureValid
                  ? "Подпись вебхука проверена"
                  : "Нет подтверждённой подписи вебхука"
              }
            >
              <Tag color={r.signatureValid ? "success" : "warning"}>
                {r.signatureValid ? "подпись ✓" : "без подписи"}
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "Оплачено до",
      dataIndex: "paidUntil",
      key: "paidUntil",
      width: 130,
      render: (v: string | null) =>
        v ? new Date(v).toLocaleDateString("ru-RU") : "—",
    },
  ];

  return (
    <Card
      title="Биллинг — все счета"
      extra={
        editable && (
          <Button type="primary" onClick={() => setModalOpen(true)}>
            Отметить оплату
          </Button>
        )
      }
    >
      <Table<BillingInvoiceRow>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={invoices || []}
        columns={columns}
        pagination={{ pageSize: 25, showSizeChanger: false }}
        scroll={{ x: 900 }}
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
        <Form form={form} layout="vertical" initialValues={{ periodMonths: 1 }}>
          <Form.Item
            name="tenantId"
            label="Компания"
            rules={[{ required: true, message: "Выберите компанию" }]}
          >
            <Select
              showSearch={{
                onSearch: setTenantSearch,
              }}
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
        </Form>
      </Modal>
    </Card>
  );
};
