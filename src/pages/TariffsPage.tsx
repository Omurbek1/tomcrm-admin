import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useState } from "react";

import { can } from "../api/client";
import { useConfig, useEditTariff, useSetConfig, useTariffs } from "../hooks";
import type { Tariff } from "../types";
import { LIMIT_META, PAYMENT_PERIODS } from "../types";

const DISCOUNT_PERIODS = PAYMENT_PERIODS.filter((m) => m > 1); // 3/6/12

const fmtLimit = (v: number | null | undefined): string =>
  v === null || v === undefined ? "∞" : String(v);

export const TariffsPage = () => {
  const { message } = App.useApp();
  const { data: tariffs, isLoading } = useTariffs();
  const editTariff = useEditTariff();
  const { data: config } = useConfig();
  const setConfig = useSetConfig();
  const [grace, setGrace] = useState<number>(3);
  const [editing, setEditing] = useState<Tariff | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (config) setGrace(config.graceDays);
  }, [config]);

  const openEdit = (t: Tariff) => {
    setEditing(t);
    form.setFieldsValue({
      name: t.name,
      price: Number(t.price),
      currency: t.currency,
      period: t.period,
      isPublic: t.isPublic,
      archived: t.archived,
      ...Object.fromEntries(
        LIMIT_META.map((l) => [`limit_${l.key}`, t.limits?.[l.key] ?? null]),
      ),
      ...Object.fromEntries(
        DISCOUNT_PERIODS.map((m) => [
          `discount_${m}`,
          t.discounts?.[String(m)] ?? 0,
        ]),
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
    const discounts: Record<string, number> = {};
    for (const m of DISCOUNT_PERIODS) {
      discounts[String(m)] = Number(v[`discount_${m}`] ?? 0);
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
          archived: v.archived as boolean,
          limits,
          discounts,
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
          {r.archived && <Tag color="orange">архив</Tag>}
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
        <Button
          size="small"
          disabled={!can("tariffs.edit")}
          onClick={() => openEdit(r)}
        >
          Изменить
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap align="center">
          <span style={{ fontWeight: 600 }}>Grace-период (дней после «оплачено до»)</span>
          <InputNumber
            min={0}
            max={90}
            value={grace}
            onChange={(v) => setGrace(Number(v ?? 0))}
            style={{ width: 90 }}
          />
          <Button
            disabled={!can("tariffs.edit")}
            onClick={() =>
              setConfig.mutate(grace, {
                onSuccess: () => message.success("Сохранено"),
                onError: () => message.error("Не удалось сохранить"),
              })
            }
            loading={setConfig.isPending}
          >
            Сохранить
          </Button>
          <span style={{ color: "#64748b", fontSize: 13 }}>
            По истечении — компания автоматически переводится в «Заморожена».
          </span>
        </Space>
      </Card>

      <Card title="Тарифы — цены и лимиты (меняются без деплоя, лендинг тянет отсюда)">
        <Table<Tariff>
          rowKey="id"
          loading={isLoading}
          dataSource={tariffs ?? []}
          columns={columns}
          scroll={{ x: "max-content" }}
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

          <div style={{ fontWeight: 600, margin: "4px 0 8px" }}>
            Скидка за период (%)
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {DISCOUNT_PERIODS.map((m) => (
              <Form.Item
                key={m}
                name={`discount_${m}`}
                label={`${m} мес.`}
                style={{ flex: 1 }}
              >
                <InputNumber
                  min={0}
                  max={90}
                  addonAfter="%"
                  style={{ width: "100%" }}
                />
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
          <Form.Item
            name="archived"
            label="Архивный (существующие остаются, новым нельзя)"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
