import {
  App,
  Button,
  Card,
  Checkbox,
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
import {
  useConfig,
  useCreateTariff,
  useEditTariff,
  useModuleCatalog,
  useSetConfig,
  useTariffs,
} from "../hooks";
import type { Tariff } from "../types";
import { ADDON_META, LIMIT_META, MODULE_BUNDLES, PAYMENT_PERIODS } from "../types";

const DISCOUNT_PERIODS = PAYMENT_PERIODS.filter((m) => m > 1); // 3/6/12

const fmtLimit = (v: number | null | undefined): string =>
  v === null || v === undefined ? "∞" : String(v);

/** Пакет включён, если ни один его сигнал не выключен явно (false). */
const bundleChecked = (
  modules: Record<string, boolean> | undefined,
  b: (typeof MODULE_BUNDLES)[number],
): boolean =>
  b.blocks.length
    ? b.blocks.every((k) => modules?.[k] !== false)
    : modules?.[b.key] !== false;

export const TariffsPage = () => {
  const { message } = App.useApp();
  const { data: tariffs, isLoading } = useTariffs();
  const editTariff = useEditTariff();
  const createTariff = useCreateTariff();
  // Единый источник — пакеты/аддоны с бэка; хардкод из types.ts только фолбэк.
  const { data: moduleCatalog } = useModuleCatalog();
  const bundles = moduleCatalog?.bundles ?? MODULE_BUNDLES;
  const addonMeta = moduleCatalog?.addons ?? ADDON_META;
  const { data: config } = useConfig();
  const setConfig = useSetConfig();
  const [grace, setGrace] = useState<number>(3);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tariff | null>(null); // null = создание
  const [form] = Form.useForm();

  useEffect(() => {
    if (config) setGrace(config.graceDays);
  }, [config]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      code: "",
      name: "",
      price: 0,
      currency: "KGS",
      period: "month",
      isPublic: true,
      archived: false,
      ...Object.fromEntries(bundles.map((b) => [`mod_${b.key}`, true])),
      ...Object.fromEntries(LIMIT_META.map((l) => [`limit_${l.key}`, null])),
      ...Object.fromEntries(DISCOUNT_PERIODS.map((m) => [`discount_${m}`, 0])),
      ...Object.fromEntries(addonMeta.map((a) => [`addon_${a.key}`, 0])),
    });
    setOpen(true);
  };

  const openEdit = (t: Tariff) => {
    setEditing(t);
    form.setFieldsValue({
      code: t.code,
      name: t.name,
      price: Number(t.price),
      currency: t.currency,
      period: t.period,
      isPublic: t.isPublic,
      archived: t.archived,
      ...Object.fromEntries(
        bundles.map((b) => [`mod_${b.key}`, bundleChecked(t.modules, b)]),
      ),
      ...Object.fromEntries(
        LIMIT_META.map((l) => [`limit_${l.key}`, t.limits?.[l.key] ?? null]),
      ),
      ...Object.fromEntries(
        DISCOUNT_PERIODS.map((m) => [`discount_${m}`, t.discounts?.[String(m)] ?? 0]),
      ),
      ...Object.fromEntries(
        addonMeta.map((a) => [`addon_${a.key}`, t.addons?.[a.key] ?? 0]),
      ),
    });
    setOpen(true);
  };

  const submit = (v: Record<string, unknown>) => {
    const limits: Record<string, number | null> = {};
    for (const l of LIMIT_META) {
      const raw = v[`limit_${l.key}`];
      limits[l.key] = raw === null || raw === undefined ? null : Number(raw);
    }
    const discounts: Record<string, number> = {};
    for (const m of DISCOUNT_PERIODS) {
      discounts[String(m)] = Number(v[`discount_${m}`] ?? 0);
    }
    // Пакеты → реальные блоки CRM (сохраняем прочие ключи существующих modules).
    const modules: Record<string, boolean> = { ...(editing?.modules ?? {}) };
    for (const b of bundles) {
      const on = Boolean(v[`mod_${b.key}`]);
      if (b.blocks.length) for (const k of b.blocks) modules[k] = on;
      else modules[b.key] = on;
    }
    const addons: Record<string, number> = {};
    for (const a of addonMeta) addons[a.key] = Number(v[`addon_${a.key}`] ?? 0);

    const base = {
      name: v.name as string,
      price: v.price as number,
      currency: v.currency as string,
      period: v.period as string,
      isPublic: v.isPublic as boolean,
      modules,
      limits,
      discounts,
      addons,
    };

    if (editing) {
      editTariff.mutate(
        { id: editing.id, patch: { ...base, archived: v.archived as boolean } },
        {
          onSuccess: () => {
            message.success("Тариф сохранён");
            setOpen(false);
          },
          onError: (e: unknown) => message.error(errMsg(e)),
        },
      );
    } else {
      createTariff.mutate(
        { ...base, code: String(v.code ?? "").trim() },
        {
          onSuccess: () => {
            message.success("Тариф создан");
            setOpen(false);
          },
          onError: (e: unknown) => message.error(errMsg(e)),
        },
      );
    }
  };

  const columns: ColumnsType<Tariff> = [
    {
      title: "Тариф",
      dataIndex: "name",
      render: (v: string, r) => (
        <span>
          <b>{v}</b> <Tag>{r.code}</Tag>
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
    ...LIMIT_META.slice(0, 3).map((l) => ({
      title: l.label,
      width: 100,
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

  const saving = editTariff.isPending || createTariff.isPending;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap align="center">
          <span style={{ fontWeight: 600 }}>
            Grace-период (дней после «оплачено до»)
          </span>
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

      <Card
        title="Тарифы — цены, модули и лимиты (меняются без деплоя, лендинг тянет отсюда)"
        extra={
          <Button
            type="primary"
            disabled={!can("tariffs.edit")}
            onClick={openCreate}
          >
            Создать тариф
          </Button>
        }
      >
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
        open={open}
        title={editing ? `Тариф: ${editing.name}` : "Новый тариф"}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? "Сохранить" : "Создать"}
        cancelText="Отмена"
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <div style={{ display: "flex", gap: 12 }}>
            {!editing && (
              <Form.Item
                name="code"
                label="Код (латиница)"
                style={{ width: 160 }}
                rules={[
                  { required: true, message: "Код" },
                  {
                    pattern: /^[a-z0-9_-]+$/,
                    message: "a-z, 0-9, - _",
                  },
                ]}
              >
                <Input placeholder="team" />
              </Form.Item>
            )}
            <Form.Item
              name="name"
              label="Название"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item
              name="price"
              label="Цена"
              style={{ flex: 1 }}
              rules={[{ required: true }]}
            >
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="currency" label="Валюта" style={{ width: 100 }}>
              <Input />
            </Form.Item>
            <Form.Item name="period" label="Период" style={{ width: 120 }}>
              <Select
                options={[
                  { value: "month", label: "Месяц" },
                  { value: "year", label: "Год" },
                ]}
              />
            </Form.Item>
          </div>

          <div style={{ fontWeight: 600, margin: "4px 0 8px" }}>Модули</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2px 12px",
              marginBottom: 8,
            }}
          >
            {bundles.map((b) => (
              <Form.Item
                key={b.key}
                name={`mod_${b.key}`}
                valuePropName="checked"
                noStyle
              >
                <Checkbox style={{ padding: "4px 0" }}>{b.label}</Checkbox>
              </Form.Item>
            ))}
          </div>

          <div style={{ fontWeight: 600, margin: "8px 0 8px" }}>
            Аддоны (докупаются поверх пакета)
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "0 12px",
            }}
          >
            {addonMeta.map((a) => (
              <Form.Item
                key={a.key}
                name={`addon_${a.key}`}
                label={<span title={a.unit}>{a.label}</span>}
              >
                <InputNumber
                  min={0}
                  placeholder="0"
                  style={{ width: "100%" }}
                  addonAfter="/мес"
                />
              </Form.Item>
            ))}
          </div>

          <div style={{ fontWeight: 600, margin: "4px 0 8px" }}>
            Лимиты (пусто = ∞)
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
                <InputNumber min={0} max={90} addonAfter="%" style={{ width: "100%" }} />
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
          {editing && (
            <Form.Item
              name="archived"
              label="Архивный (существующие остаются, новым нельзя)"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

function errMsg(e: unknown): string {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? "Не удалось сохранить"
  );
}
