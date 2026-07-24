import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { useEditTariff, useTariffs } from "../hooks";
import type { Tariff } from "../types";
import { LIMIT_META } from "../types";

const fmtLimit = (v: number | null | undefined): string =>
  v === null || v === undefined ? "∞" : String(v);

export const TariffsPage = () => {
  const { message } = App.useApp();
  const { data: tariffs, isLoading } = useTariffs();
  const editTariff = useEditTariff();
  const [editing, setEditing] = useState<Tariff | null>(null);
  const [form] = Form.useForm();

  const openEdit = (t: Tariff) => {
    setEditing(t);
    form.setFieldsValue({
      name: t.name,
      price: Number(t.price),
      currency: t.currency,
      period: t.period,
      isPublic: t.isPublic,
      ...Object.fromEntries(
        LIMIT_META.map((l) => [`limit_${l.key}`, t.limits?.[l.key] ?? null]),
      ),
    });
  };

  const submit = (v: Record<string, unknown>) => {
    if (!editing) return;
    const limits: Record<string, number | null> = {};
    for (const l of LIMIT_META) {
      const raw = v[`limit_${l.key}`];
      limits[l.key] = raw === null || raw === undefined ? null : Number(raw);
    }
    editTariff.mutate(
      {
        id: editing.id,
        patch: {
          name: v.name as string,
          price: v.price as number,
          currency: v.currency as string,
          period: v.period as string,
          isPublic: v.isPublic as boolean,
          limits,
        },
      },
      {
        onSuccess: () => {
          message.success("Тариф сохранён");
          setEditing(null);
        },
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось сохранить";
          message.error(msg);
        },
      },
    );
  };

  const columns: ColumnsType<Tariff> = [
    {
      title: "Тариф",
      dataIndex: "name",
      render: (v: string, r) => (
        <span>
          <b>{v}</b>{" "}
          <Tag>{r.code}</Tag>
          {!r.isPublic && <Tag color="default">скрыт</Tag>}
        </span>
      ),
    },
    {
      title: "Цена",
      dataIndex: "price",
      width: 150,
      render: (v: string, r) =>
        Number(v) > 0
          ? `${Number(v).toLocaleString("ru-RU")} ${r.currency}/${r.period === "year" ? "год" : "мес"}`
          : "—",
    },
    ...LIMIT_META.slice(0, 4).map((l) => ({
      title: l.label,
      width: 110,
      render: (_v: unknown, r: Tariff) => fmtLimit(r.limits?.[l.key]),
    })),
    {
      title: "",
      width: 100,
      render: (_v: unknown, r: Tariff) => (
        <Button size="small" onClick={() => openEdit(r)}>
          Изменить
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Card title="Тарифы — цены и лимиты (меняются без деплоя, лендинг тянет отсюда)">
        <Table<Tariff>
          rowKey="id"
          loading={isLoading}
          dataSource={tariffs ?? []}
          columns={columns}
          pagination={false}
        />
      </Card>

      <Modal
        open={!!editing}
        title={`Тариф: ${editing?.name ?? ""}`}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={editTariff.isPending}
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item
              name="price"
              label="Цена"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="currency" label="Валюта" style={{ width: 110 }}>
              <Input />
            </Form.Item>
            <Form.Item name="period" label="Период" style={{ width: 130 }}>
              <Select
                options={[
                  { value: "month", label: "Месяц" },
                  { value: "year", label: "Год" },
                ]}
              />
            </Form.Item>
          </div>

          <div style={{ fontWeight: 600, margin: "4px 0 8px" }}>
            Лимиты (пусто = без ограничения ∞)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0 12px",
            }}
          >
            {LIMIT_META.map((l) => (
              <Form.Item key={l.key} name={`limit_${l.key}`} label={l.label}>
                <InputNumber min={0} placeholder="∞" style={{ width: "100%" }} />
              </Form.Item>
            ))}
          </div>

          <Form.Item
            name="isPublic"
            label="Показывать на лендинге"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
