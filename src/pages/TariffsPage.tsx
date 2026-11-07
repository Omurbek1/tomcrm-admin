import {
  App,
  Alert,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Segmented,
  Switch,
  Tabs,
  Tag,
  Tree,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";

import { can } from "../api/client";
import { PageHeader } from "../components/viz";
import { navigate } from "../lib/nav";
import {
  useConfig,
  useCreateTariff,
  useEditTariff,
  useModuleCatalog,
  useSetConfig,
  useTariffs,
  useTenants,
  useCallsSwitch,
  useSetCallsSwitch,
} from "../hooks";
import type { Tariff } from "../types";
import {
  ADDON_META,
  TARIFF_LIMIT_META,
  MODULE_GROUPS_FALLBACK,
  PAYMENT_PERIODS,
} from "../types";
import { ResponsiveTable } from "../components/MobileCards";

/** Код тарифа из названия: латиница, цифры, дефис («Бизнес Плюс» → biznes-plyus). */
const TR: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",ү:"u",ө:"o",ң:"n" };
const slugify = (v: string) =>
  v
    .toLowerCase()
    .split("")
    .map((c) => TR[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

const DISCOUNT_PERIODS = PAYMENT_PERIODS.filter((m) => m > 1); // 3/6/12

const fmtLimit = (v: number | null | undefined): string =>
  v === null || v === undefined ? "∞" : String(v);


/** Общий выключатель звонков платформы — для всех компаний сразу. */
const CallsSwitchCard = () => {
  const { message, modal } = App.useApp();
  const q = useCallsSwitch();
  const set = useSetCallsSwitch();
  if (q.isError || !q.data) return null;
  const d = q.data;
  const editable = can("calls.manage") && !d.envDisabled;
  const toggle = (on: boolean) => {
    const run = () =>
      set.mutateAsync(!on).then(
        () => void message.success(on ? "Звонки включены" : "Звонки выключены"),
        () => void message.error("Не удалось переключить"),
      );
    if (on) return void run();
    modal.confirm({
      title: "Выключить звонки у всех компаний?",
      content:
        "Звонить и принимать звонки через CRM перестанут все компании сразу. Включить обратно можно здесь же.",
      okText: "Выключить",
      okButtonProps: { danger: true },
      cancelText: "Отмена",
      onOk: run,
    });
  };
  return (
    <Card size="small" style={{ marginBottom: 16 }} title="Звонки WhatsApp на платформе">
      <Space wrap align="center">
        <Switch
          checked={!d.disabled}
          disabled={!editable}
          loading={set.isPending}
          onChange={toggle}
        />
        <span style={{ fontWeight: 500 }}>
          {d.disabled ? "Выключены у всех компаний" : "Включены"}
        </span>
        <span style={{ color: "var(--text-3)", fontSize: 13 }}>
          {d.envDisabled
            ? "Выключены настройкой сервера (WA_CALLS_DISABLED) — из админки не включить."
            : "Аварийный выключатель: на случай сбоя или жалоб. Линии каждой компании — в её карточке → «Тариф и модули»."}
        </span>
      </Space>
    </Card>
  );
};

export const TariffsPage = () => {
  const { message } = App.useApp();
  const { data: tariffs, isLoading } = useTariffs();
  const editTariff = useEditTariff();
  const createTariff = useCreateTariff();
  // Единый источник — группы/разделы/аддоны с бэка; хардкод только фолбэк.
  const { data: moduleCatalog } = useModuleCatalog();
  const groups = moduleCatalog?.groups ?? MODULE_GROUPS_FALLBACK;
  const addonMeta = moduleCatalog?.addons ?? ADDON_META;
  const allSectionKeys = groups.flatMap((g) => g.sections.map((s) => s.key));
  const treeData = groups.map((g) => ({
    key: `grp:${g.key}`,
    title: g.label,
    children: g.sections.map((s) => ({
      key: s.key,
      // Всегда-включённые разделы (Сотрудники/Безопасность/Настройки) показываем,
      // но отключить нельзя — disabled + всегда отмечены.
      title: s.alwaysOn
        ? `${s.label} · всегда`
        : s.flag
          ? `${s.label} · платная опция (в тарифе бесплатно, если включить)`
          : s.label,
      disabled: s.alwaysOn,
    })),
  }));
  const { data: config } = useConfig();
  const setConfig = useSetConfig();
  const [grace, setGrace] = useState<number>(3);
  const [readOnlyDays, setReadOnlyDays] = useState<number>(0);
  const [trialGraceDays, setTrialGraceDays] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tariff | null>(null); // null = создание
  // Включённые разделы (листья дерева). Раздел вкл, если не выключен явно.
  const [moduleChecked, setModuleChecked] = useState<string[]>([]);
  // Код при создании заполняется из названия, пока его не правили руками.
  const [codeTouched, setCodeTouched] = useState(false);
  const [form] = Form.useForm();
  const priceW: number | undefined = Form.useWatch("price", form);
  const periodW: string | undefined = Form.useWatch("period", form);
  const currencyW: string | undefined = Form.useWatch("currency", form);
  // Все поля формы одним watch — без хуков в цикле.
  const allW = Form.useWatch([], form) as Record<string, unknown> | undefined;
  const discountsW = Object.fromEntries(
    DISCOUNT_PERIODS.map((m) => [m, allW?.[`discount_${m}`] as number | undefined]),
  ) as Record<number, number | undefined>;

  useEffect(() => {
    if (!config) return;
    setGrace(config.graceDays);
    setReadOnlyDays(config.readOnlyDays ?? 0);
    setTrialGraceDays(config.trialGraceDays ?? 0);
  }, [config]);

  const openCreate = (from?: Tariff) => {
    setEditing(null);
    setCodeTouched(false);
    form.resetFields();
    if (from) {
      fillFrom(from, true);
      setOpen(true);
      return;
    }
    form.setFieldsValue({
      code: "",
      name: "",
      price: 0,
      currency: "KGS",
      period: "month",
      isPublic: true,
      archived: false,
      ...Object.fromEntries(TARIFF_LIMIT_META.map((l) => [`limit_${l.key}`, null])),
      ...Object.fromEntries(DISCOUNT_PERIODS.map((m) => [`discount_${m}`, 0])),
      ...Object.fromEntries(addonMeta.map((a) => [`addon_${a.key}`, 0])),
    });
    // Разделы включены по умолчанию; платные флаги (AI-менеджер) — выключены.
    setModuleChecked(
      allSectionKeys.filter(
        (k) => !groups.some((g) => g.sections.some((s) => s.key === k && s.flag)),
      ),
    );
    setOpen(true);
  };

  // Заполнить форму значениями тарифа (правка или «копия»).
  const fillFrom = (t: Tariff, asCopy: boolean) => {
    form.setFieldsValue({
      code: asCopy ? "" : t.code,
      name: asCopy ? `${t.name} (копия)` : t.name,
      price: Number(t.price),
      currency: t.currency,
      period: t.period,
      isPublic: t.isPublic,
      archived: asCopy ? false : t.archived,
      ...Object.fromEntries(
        TARIFF_LIMIT_META.map((l) => [`limit_${l.key}`, t.limits?.[l.key] ?? null]),
      ),
      ...Object.fromEntries(
        DISCOUNT_PERIODS.map((m) => [`discount_${m}`, t.discounts?.[String(m)] ?? 0]),
      ),
      ...Object.fromEntries(
        addonMeta.map((a) => [`addon_${a.key}`, t.addons?.[a.key] ?? 0]),
      ),
    });
    // Раздел включён, если не выключен явно (modules[k] !== false). Платные
    // флаги-пакеты (AI-менеджер) — наоборот: включены только явно (=== true).
    const flagKeys = new Set(
      groups.flatMap((g) => g.sections.filter((s) => s.flag).map((s) => s.key)),
    );
    setModuleChecked(
      allSectionKeys.filter((k) =>
        flagKeys.has(k) ? t.modules?.[k] === true : t.modules?.[k] !== false,
      ),
    );
  };

  const openEdit = (t: Tariff) => {
    setEditing(t);
    setCodeTouched(true);
    fillFrom(t, false);
    setOpen(true);
  };

  const submit = (v: Record<string, unknown>) => {
    const limits: Record<string, number | null> = {};
    for (const l of TARIFF_LIMIT_META) {
      const raw = v[`limit_${l.key}`];
      limits[l.key] = raw === null || raw === undefined ? null : Number(raw);
    }
    const discounts: Record<string, number> = {};
    for (const m of DISCOUNT_PERIODS) {
      discounts[String(m)] = Number(v[`discount_${m}`] ?? 0);
    }
    // Разделы дерева → modules (вкл=true, выкл=false); прочие ключи сохраняем.
    const modules: Record<string, boolean> = { ...(editing?.modules ?? {}) };
    for (const k of allSectionKeys) modules[k] = moduleChecked.includes(k);
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

  // Сколько живых компаний на каждом тарифе — из кэша списка «Компании».
  const { data: allTenants } = useTenants({});
  const tenantsByTariff = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of allTenants ?? [])
      if (t.tariffId && t.status !== "deleted")
        m.set(t.tariffId, (m.get(t.tariffId) ?? 0) + 1);
    return m;
  }, [allTenants]);

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
          ? `${Number(v).toLocaleString("ru-RU")} ${r.currency === "KGS" ? "сом" : r.currency}/${r.period === "year" ? "год" : "мес"}`
          : "—",
    },
    {
      title: "Компаний",
      width: 100,
      render: (_v: unknown, r: Tariff) => {
        const n = tenantsByTariff.get(r.id) ?? 0;
        return n ? (
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            onClick={() => navigate("tenants", { tariff: r.id })}
          >
            {n.toLocaleString("ru-RU")}
          </Button>
        ) : (
          <span style={{ color: "#94a3b8" }}>0</span>
        );
      },
    },
    ...TARIFF_LIMIT_META.slice(0, 3).map((l) => ({
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
      <PageHeader
        title="Тарифы"
        subtitle="Цены и лимиты планов, что происходит при неоплате"
      />
      <Card
        title="Тарифы"
        style={{ marginBottom: 16 }}
        extra={
          <Dropdown.Button
            type="primary"
            disabled={!can("tariffs.edit")}
            onClick={() => openCreate()}
            menu={{
              items: (tariffs ?? [])
                .filter((t) => !t.archived)
                .map((t) => ({
                  key: t.id,
                  label: `Копия «${t.name}»`,
                  onClick: () => openCreate(t),
                })),
            }}
          >
            Создать тариф
          </Dropdown.Button>
        }
      >
        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 10 }}>
          Цены, модули и лимиты меняются сразу, без выкладки; лендинг берёт их
          отсюда.
        </div>
        <ResponsiveTable<Tariff>
          rowKey="id"
          loading={isLoading}
          dataSource={tariffs ?? []}
          columns={columns}
          scroll={{ x: "max-content" }}
          pagination={false}
          onRow={(t) =>
            can("tariffs.edit")
              ? { onClick: () => openEdit(t), style: { cursor: "pointer" } }
              : {}
          }
        />
      </Card>
      <CallsSwitchCard />

      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title="Что происходит при неоплате"
      >
        <div className="dunning">
          <span>Оплата просрочена</span>
          <span className="dunning-step">
            {grace} дн. — полный доступ и баннер
          </span>
          <span className="dunning-step">
            {readOnlyDays} дн. — только чтение
          </span>
          <span className="dunning-step is-end">блокировка до оплаты</span>
        </div>
        <div style={{ color: "#64748b", fontSize: 13, marginBottom: 12 }}>
          После триала: ещё {trialGraceDays} дн. до экрана оплаты. Действует
          для всех компаний сразу.
        </div>
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <Space wrap align="center">
            <span style={{ fontWeight: 600, minWidth: 260 }}>
              Льготный период после «оплачено до»
            </span>
            <InputNumber
              min={0}
              max={90}
              value={grace}
              onChange={(v) => setGrace(Number(v ?? 0))}
              style={{ width: 90 }}
              suffix="дн."
            />
            <span style={{ color: "#64748b", fontSize: 13 }}>
              Полный доступ + баннер «оплата просрочена».
            </span>
          </Space>
          <Space wrap align="center">
            <span style={{ fontWeight: 600, minWidth: 260 }}>
              Режим «только чтение» после льготного
            </span>
            <InputNumber
              min={0}
              max={90}
              value={readOnlyDays}
              onChange={(v) => setReadOnlyDays(Number(v ?? 0))}
              style={{ width: 90 }}
              suffix="дн."
            />
            <span style={{ color: "#64748b", fontSize: 13 }}>
              0 — сразу блокировка. Данные видны, изменения и отправка закрыты.
            </span>
          </Space>
          <Space wrap align="center">
            <span style={{ fontWeight: 600, minWidth: 260 }}>
              Отсрочка после окончания триала
            </span>
            <InputNumber
              min={0}
              max={90}
              value={trialGraceDays}
              onChange={(v) => setTrialGraceDays(Number(v ?? 0))}
              style={{ width: 90 }}
              suffix="дн."
            />
            <span style={{ color: "#64748b", fontSize: 13 }}>
              0 — экран оплаты сразу по истечении триала.
            </span>
          </Space>
          <Space wrap align="center">
            <Button
              type="primary"
              disabled={!can("tariffs.edit")}
              onClick={() =>
                setConfig.mutate(
                  { graceDays: grace, readOnlyDays, trialGraceDays },
                  {
                    onSuccess: () => message.success("Сохранено"),
                    onError: () => message.error("Не удалось сохранить"),
                  },
                )
              }
              loading={setConfig.isPending}
            >
              Сохранить
            </Button>
            <span style={{ color: "#64748b", fontSize: 13 }}>
              После блокировки компания видит экран оплаты (вход сохраняется);
              WhatsApp-сессии живут, входящие копятся, отправка/AI/автоматизации
              остановлены. Оплата снимает блокировку автоматически.
            </span>
          </Space>
        </Space>
      </Card>


      <Modal
        open={open}
        title={editing ? `Тариф: ${editing.name}` : "Новый тариф"}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText={editing ? "Сохранить" : "Создать"}
        cancelText="Отмена"
        confirmLoading={saving}
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          {/* forceRender: поля всех вкладок зарегистрированы — сохраняются,
              даже если вкладку не открывали. */}
          {editing && (tenantsByTariff.get(editing.id) ?? 0) > 0 ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              title={`На тарифе ${tenantsByTariff.get(editing.id)} комп. — цена, лимиты и модули изменятся у них сразу после сохранения.`}
            />
          ) : null}
          <Tabs
            items={[
              {
                key: "main",
                label: "Основное",
                forceRender: true,
                children: (
                  <>
                    <div className="form-row">
                      {!editing && (
                        <Form.Item
                          name="code"
                          label="Код (латиница)"
                          style={{ flex: "0 1 160px" }}
                          extra="Нельзя изменить после создания"
                          rules={[
                            { required: true, message: "Укажите код" },
                            { pattern: /^[a-z0-9_-]+$/, message: "a-z, 0-9, - _" },
                          ]}
                        >
                          <Input
                            placeholder="team"
                            onChange={() => setCodeTouched(true)}
                          />
                        </Form.Item>
                      )}
                      <Form.Item
                        name="name"
                        label="Название"
                        style={{ flex: "1 1 220px" }}
                        rules={[{ required: true, message: "Укажите название" }]}
                      >
                        <Input
                          autoFocus
                          onChange={(e) => {
                            if (!editing && !codeTouched)
                              form.setFieldValue("code", slugify(e.target.value));
                          }}
                        />
                      </Form.Item>
                    </div>
                    <div className="form-row">
                      <Form.Item
                        name="price"
                        label="Цена"
                        style={{ flex: "1 1 160px" }}
                        rules={[{ required: true, message: "Укажите цену" }]}
                      >
                        <InputNumber<number>
                          min={0}
                          style={{ width: "100%" }}
                          formatter={(v) => (v == null ? "" : Number(v).toLocaleString("ru-RU"))}
                          parser={(v) => Number(String(v ?? "").replace(/\D/g, ""))}
                        />
                      </Form.Item>
                      <Form.Item name="currency" label="Валюта" style={{ flex: "0 1 100px" }}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="period" label="За" style={{ flex: "0 1 140px" }}>
                        <Segmented
                          block
                          options={[
                            { value: "month", label: "Месяц" },
                            { value: "year", label: "Год" },
                          ]}
                        />
                      </Form.Item>
                    </div>
                    <div className="form-label">Скидка при оплате вперёд</div>
                    <div className="form-row">
                      {DISCOUNT_PERIODS.map((m) => {
                        const pct = Number(discountsW?.[m] ?? 0);
                        const total =
                          Number(priceW ?? 0) * m * (1 - Math.min(pct, 90) / 100);
                        return (
                          <Form.Item
                            key={m}
                            name={`discount_${m}`}
                            label={`${m} мес.`}
                            style={{ flex: "1 1 120px" }}
                            extra={
                              priceW && periodW !== "year"
                                ? `${Math.round(total).toLocaleString("ru-RU")} ${!currencyW || currencyW === "KGS" ? "сом" : currencyW}`
                                : undefined
                            }
                          >
                            <InputNumber min={0} max={90} suffix="%" style={{ width: "100%" }} />
                          </Form.Item>
                        );
                      })}
                    </div>
                    <div className="form-row">
                      <Form.Item
                        name="isPublic"
                        label="Показывать на лендинге"
                        valuePropName="checked"
                        style={{ flex: "1 1 200px" }}
                      >
                        <Switch />
                      </Form.Item>
                      {editing && (
                        <Form.Item
                          name="archived"
                          label="В архиве"
                          extra="У кого есть — останется, новым не выбрать"
                          valuePropName="checked"
                          style={{ flex: "1 1 200px" }}
                        >
                          <Switch />
                        </Form.Item>
                      )}
                    </div>
                  </>
                ),
              },
              {
                key: "limits",
                label: "Лимиты",
                forceRender: true,
                children: (
                  <>
                    <div className="form-hint">Пусто — без ограничений (∞).</div>
                    <div className="form-grid">
                      {TARIFF_LIMIT_META.map((l) => (
                        <Form.Item key={l.key} name={`limit_${l.key}`} label={l.label}>
                          <InputNumber min={0} placeholder="∞" style={{ width: "100%" }} />
                        </Form.Item>
                      ))}
                    </div>
                  </>
                ),
              },
              {
                key: "modules",
                label: `Модули · ${moduleChecked.length}/${allSectionKeys.length}`,
                forceRender: true,
                children: (
                  <>
                    <div className="form-hint">
                      Разделы CRM, которые входят в тариф (как в меню).
                    </div>
                    <Tree
                      checkable
                      selectable={false}
                      defaultExpandAll
                      treeData={treeData}
                      checkedKeys={moduleChecked}
                      onCheck={(keys) => {
                        const arr = (Array.isArray(keys) ? keys : keys.checked).map(String);
                        setModuleChecked(arr.filter((k) => !k.startsWith("grp:")));
                      }}
                    />
                  </>
                ),
              },
              {
                key: "addons",
                label: "Опции",
                forceRender: true,
                children: (
                  <>
                    <div className="form-hint">
                      Докупаются поверх тарифа, цена в месяц. 0 — опцию не продаём.
                    </div>
                    <div className="form-grid">
                      {addonMeta.map((a) => (
                        <Form.Item
                          key={a.key}
                          name={`addon_${a.key}`}
                          label={<span title={a.unit}>{a.label}</span>}
                        >
                          <InputNumber min={0} placeholder="0" style={{ width: "100%" }} suffix="/мес" />
                        </Form.Item>
                      ))}
                    </div>
                  </>
                ),
              },
            ]}
          />
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
