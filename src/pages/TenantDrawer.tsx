import {
  App,
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Divider,
  Drawer,
  Dropdown,
  Form,
  Tooltip,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Tree,
  Typography,
} from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { useState } from "react";

import { can, CRM_URL } from "../api/client";
import {
  useAudit,
  useCancelPayment,
  useModuleCatalog,
  useExtendTrial,
  useImpersonate,
  useNotifications,
  usePayments,
  useRecordPayment,
  useSendReminder,
  useSetContacts,
  useSetPriceOverride,
  useSetStatus,
  useSetTariff,
  useSetTenantAddons,
  useSetTenantModules,
  useSetTest,
  useTariffs,
  useTenant,
} from "../hooks";
import type { TenantStatus } from "../types";
import {
  ADDON_META,
  AUDIT_ACTION_LABEL,
  AUDIT_FILTERS,
  LIMIT_META,
  MODULE_GROUPS_FALLBACK,
  NOTIF_STATUS_COLOR,
  PAYMENT_COLOR,
  PAYMENT_LABEL,
  PAYMENT_PERIODS,
  REMINDER_TYPES,
  STATUS_DATA_POLICY,
  STATUS_LABEL,
} from "../types";

const { Text } = Typography;

interface Props {
  tenantId: string | null;
  onClose: () => void;
}

export const TenantDrawer = ({ tenantId, onClose }: Props) => {
  const { message, modal } = App.useApp();
  const { data, isLoading } = useTenant(tenantId);
  const { data: tariffs } = useTariffs();
  const [auditFilter, setAuditFilter] = useState(0);
  const [auditLimit, setAuditLimit] = useState(20);
  const { data: audit } = useAudit(tenantId ?? undefined, {
    actions: AUDIT_FILTERS[auditFilter].actions,
    limit: auditLimit,
  });
  const [payPage, setPayPage] = useState(1);
  const { data: paymentsResp } = usePayments(tenantId, payPage, 10);
  const { data: notifications } = useNotifications(tenantId);
  const sendReminder = useSendReminder();
  const setStatus = useSetStatus();
  const extendTrial = useExtendTrial();
  const setTariff = useSetTariff();
  const setContacts = useSetContacts();
  const recordPayment = useRecordPayment();
  const cancelPayment = useCancelPayment();
  const setPrice = useSetPriceOverride();
  const setAddons = useSetTenantAddons();
  const setModules = useSetTenantModules();
  const setTest = useSetTest();
  // Единый источник — группы/разделы/аддоны с бэка; хардкод только фолбэк.
  const { data: moduleCatalog } = useModuleCatalog();
  const groups = moduleCatalog?.groups ?? MODULE_GROUPS_FALLBACK;
  const addonMeta = moduleCatalog?.addons ?? ADDON_META;
  const allSectionKeys = groups.flatMap((g) => g.sections.map((s) => s.key));
  // Override = эффективный набор компании ОТЛИЧАЕТСЯ от тарифа (сравниваем
  // effective vs plan, а не только явный override-словарь — он может быть пуст,
  // а отличие всё равно есть). Помечаем такие модули в дереве.
  const isOverride = (k: string) =>
    (data?.modules?.[k] !== false) !== (data?.tariffModules?.[k] !== false);
  const overrideKeys = new Set(allSectionKeys.filter(isOverride));
  const overrideCount = overrideKeys.size;
  const moduleTreeData = groups.map((g) => ({
    key: `grp:${g.key}`,
    title: g.label,
    children: g.sections.map((s) => ({
      key: s.key,
      title: (
        <span>
          {s.alwaysOn ? `${s.label} · всегда` : s.label}
          {overrideKeys.has(s.key) && (
            <Tag
              color="gold"
              style={{
                marginLeft: 6,
                fontSize: 10,
                lineHeight: "16px",
                padding: "0 4px",
              }}
            >
              override
            </Tag>
          )}
        </span>
      ),
      disabled: s.alwaysOn,
    })),
  }));
  const impersonate = useImpersonate();
  const [addonDraft, setAddonDraft] = useState<Record<string, number> | null>(
    null,
  );
  // Включённые разделы (листья). null = не редактировали (показываем эффективные).
  const [moduleChecked, setModuleChecked] = useState<string[] | null>(null);
  const [contactForm] = Form.useForm();
  const [payOpen, setPayOpen] = useState(false);
  const [payForm] = Form.useForm();
  const [priceDraft, setPriceDraft] = useState<string>("");

  const savePrice = (price: number | null) => {
    if (!t) return;
    setPrice.mutate(
      { id: t.id, price },
      {
        onSuccess: () =>
          message.success(price === null ? "Сброшено" : "Цена сохранена"),
        onError: () => message.error("Не удалось сохранить цену"),
      },
    );
  };

  const t = data?.tenant;
  const tariff = tariffs?.find((tf) => tf.id === t?.tariffId);

  // Подсказка суммы: цена тарифа × месяцы × (1 − скидка периода).
  const suggestAmount = (months: number): number => {
    if (!tariff) return 0;
    const base = Number(tariff.price) * months;
    const pct = tariff.discounts?.[String(months)] ?? 0;
    return Math.round(base * (1 - pct / 100));
  };

  const submitPayment = (v: {
    amount: number;
    currency: string;
    periodMonths: number;
    note?: string;
    receipt?: string;
  }) => {
    if (!t) return;
    recordPayment.mutate(
      { id: t.id, ...v },
      {
        onSuccess: () => {
          message.success("Платёж записан");
          setPayOpen(false);
          payForm.resetFields();
        },
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось записать платёж";
          message.error(msg);
        },
      },
    );
  };

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString("ru-RU") : "—";
  // Деньги в интерфейсе — локализованно «5 000 сом» (неразрывные пробелы);
  // код валюты (KGS) оставляем для CSV/API.
  const fmtMoney = (n: number | string | null | undefined) => {
    const v = Number(n ?? 0);
    return `${v.toLocaleString("ru-RU").replace(/\s/g, " ")} сом`;
  };

  const doSendReminder = (type: string) => {
    if (!t) return;
    sendReminder.mutate(
      { id: t.id, type },
      {
        onSuccess: (r) => {
          if (r.status === "sent") message.success("Отправлено");
          else if (r.status === "skipped")
            message.warning(`Пропущено: ${r.detail ?? "нет условий"}`);
          else message.error(`Не отправлено: ${r.detail ?? r.status}`);
        },
        onError: () => message.error("Ошибка отправки"),
      },
    );
  };

  const applyStatus = (status: string) => {
    if (!t) return;
    setStatus.mutate(
      { id: t.id, status },
      {
        onSuccess: () => message.success("Статус обновлён"),
        onError: () => message.error("Не удалось сменить статус"),
      },
    );
  };

  const changeStatus = (status: string) => {
    if (!t) return;
    // Заморозка/удаление — с подтверждением и пояснением о судьбе данных.
    if (status === "deleted" || status === "blocked") {
      modal.confirm({
        title: status === "deleted" ? "Удалить компанию?" : "Заморозить компанию?",
        content:
          STATUS_DATA_POLICY[status as TenantStatus] ??
          "Сменить статус компании?",
        okText: status === "deleted" ? "Удалить" : "Заморозить",
        okButtonProps: { danger: true },
        cancelText: "Отмена",
        onOk: () => applyStatus(status),
      });
      return;
    }
    applyStatus(status);
  };

  const doImpersonate = () => {
    if (!t) return;
    impersonate.mutate(t.id, {
      onSuccess: (r) => {
        // Открываем CRM с токеном владельца в hash — CRM подхватит и войдёт.
        window.open(
          `${CRM_URL}/#impersonate=${encodeURIComponent(r.token)}`,
          "_blank",
          "noopener",
        );
      },
      onError: (e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Не удалось войти под владельцем";
        message.error(msg);
      },
    });
  };

  const addDays = (days: number) => {
    if (!t) return;
    extendTrial.mutate(
      { id: t.id, days },
      {
        onSuccess: () => message.success(`Триал продлён на ${days} дн.`),
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось продлить триал";
          message.error(msg);
        },
      },
    );
  };

  const changeTariff = (tariffId: string) => {
    if (!t) return;
    setTariff.mutate(
      { id: t.id, tariffId },
      {
        onSuccess: () => message.success("Тариф изменён"),
        onError: () => message.error("Не удалось сменить тариф"),
      },
    );
  };

  const saveContacts = (v: { contactPhone?: string; contactEmail?: string }) => {
    if (!t) return;
    setContacts.mutate(
      {
        id: t.id,
        contactPhone: v.contactPhone ?? "",
        contactEmail: v.contactEmail ?? "",
      },
      {
        onSuccess: () => message.success("Контакты сохранены"),
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось сохранить";
          message.error(msg);
        },
      },
    );
  };

  const noContacts = t && !t.contactPhone && !t.contactEmail;

  // Статус — ВЫЧИСЛЯЕМЫЙ (оплачено/триал/истёк/просрочено/заморожена/удалена),
  // руками не меняется (только заморозка/разморозка/продление триала).
  const statusBadge = t
    ? t.deletedAt || t.status === "deleted"
      ? { label: "Удалена", color: "default" as const }
      : t.status === "blocked"
        ? { label: "Заморожена", color: "red" as const }
        : t.paymentStatus === "overdue"
          ? { label: "Просрочено", color: "volcano" as const }
          : t.status === "active"
            ? { label: "Оплачено", color: "green" as const }
            : t.status === "trial"
              ? t.trialDaysLeft <= 0
                ? { label: "Триал истёк", color: "orange" as const }
                : { label: `Триал · ${t.trialDaysLeft} дн.`, color: "blue" as const }
              : { label: STATUS_LABEL[t.status], color: "default" as const }
    : { label: "", color: "default" as const };

  // Деструктив (заморозка/удаление) — подтверждение с вводом slug вручную.
  const [danger, setDanger] = useState<null | "freeze" | "delete">(null);
  const [confirmSlug, setConfirmSlug] = useState("");
  const openDanger = (kind: "freeze" | "delete") => {
    setConfirmSlug("");
    setDanger(kind);
  };
  const runDanger = () => {
    if (!t) return;
    changeStatus(danger === "delete" ? "deleted" : "blocked");
    setDanger(null);
  };

  return (
    <Drawer
      open={!!tenantId}
      onClose={onClose}
      width={720}
      title={t ? t.name : "Компания"}
      styles={{
        // Тело Drawer заполняет высоту экрана → flex-колонка: шапка + таб-бар
        // фиксированы, скроллится только контент вкладки (.tenant-card-tabs).
        body: {
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "12px 16px 0",
        },
      }}
    >
      {isLoading || !t || !data ? (
        <Spin />
      ) : (
        <>
          {/* Шапка: статус-бейдж (вычисляемый) · slug (копируется) · тест · ⋯ */}
          <Space size="middle" wrap style={{ marginBottom: 8 }}>
            <Tag color={statusBadge.color}>{statusBadge.label}</Tag>
            <Text copyable={{ text: t.slug }} type="secondary">
              /{t.slug}
            </Text>
            <Tooltip title="Не учитывается в MRR, конверсии и аналитике">
              <Checkbox
                checked={t.isTest}
                style={{ fontSize: 12 }}
                onChange={(e) =>
                  setTest.mutate(
                    { id: t.id, isTest: e.target.checked },
                    { onError: () => message.error("Не удалось") },
                  )
                }
              >
                Тестовая компания
              </Checkbox>
            </Tooltip>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  {
                    key: "impersonate",
                    label: "Войти под владельцем ↗",
                    disabled: t.status === "deleted" || !can("impersonate"),
                    onClick: doImpersonate,
                  },
                  {
                    key: "reset-pw",
                    label: "Сбросить пароль владельца",
                    disabled: true, // Фаза 3 (эндпоинт)
                  },
                  { type: "divider" },
                  {
                    key: "freeze",
                    danger: true,
                    disabled: t.status === "deleted",
                    label:
                      t.status === "blocked"
                        ? "Разморозить компанию"
                        : "Заморозить компанию",
                    onClick: () =>
                      t.status === "blocked"
                        ? modal.confirm({
                            title: "Разморозить компанию?",
                            content: "Доступ восстановится сразу.",
                            okText: "Разморозить",
                            onOk: () => changeStatus("active"),
                          })
                        : openDanger("freeze"),
                  },
                  {
                    key: "delete",
                    danger: true,
                    disabled: t.status === "deleted" || !can("tenants.delete"),
                    label: "Удалить компанию",
                    onClick: () => openDanger("delete"),
                  },
                ],
              }}
            >
              <Tooltip title="Действия">
                <Button icon={<MoreOutlined />} aria-label="Действия" />
              </Tooltip>
            </Dropdown>
          </Space>

          {/* Строка метрик */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 16px",
              marginBottom: 8,
              fontSize: 12,
              color: "#64748b",
            }}
          >
            <span>
              Отрасль: <b>—</b>
            </span>
            <span>
              Владелец: <b>—</b>
            </span>
            <span>
              Оплачено до: <b>{fmtDate(t.paidUntil)}</b>
            </span>
            <span>
              Сотрудников: <b>{t.employees}</b>
            </span>
            <span>
              Сделок: <b>{t.deals}</b>
            </span>
            <span>
              Создана:{" "}
              <b>{new Date(t.createdAt).toLocaleDateString("ru-RU")}</b>
            </span>
          </div>

          {noContacts && (
            <Alert
              type="warning"
              showIcon
              style={{ margin: "8px 0" }}
              message="Нет контактов — некому написать при истечении триала. Заполните телефон/email ниже."
            />
          )}

          <Tabs
            defaultActiveKey="overview"
            className="tenant-card-tabs"
            style={{ flex: 1, minHeight: 0 }}
            items={[
              {
                label: "Обзор",
                key: "overview",
                children: (
                  <>
          {/* Контакты (редактируемые) */}
          <Divider titlePlacement="start">Контакты</Divider>
          <Form
            form={contactForm}
            layout="vertical"
            onFinish={saveContacts}
            initialValues={{
              contactPhone: t.contactPhone ?? "",
              contactEmail: t.contactEmail ?? "",
            }}
          >
            <div style={{ display: "flex", gap: 12 }}>
              <Form.Item name="contactPhone" label="Телефон" style={{ flex: 1 }}>
                <Input placeholder="+996 ..." />
              </Form.Item>
              <Form.Item name="contactEmail" label="Email" style={{ flex: 1 }}>
                <Input placeholder="mail@company.kg" />
              </Form.Item>
            </div>
            <Button
              htmlType="submit"
              loading={setContacts.isPending}
              size="small"
            >
              Сохранить контакты
            </Button>
          </Form>


                  </>
                ),
              },
              {
                label: "Тариф и модули",
                key: "tariff",
                children: (
                  <>
          {/* Секция 1: Тариф и цена */}
          <Divider titlePlacement="start" style={{ marginTop: 0 }}>
            Тариф и цена
          </Divider>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Text strong>Тариф</Text>
              <br />
              <Select
                value={t.tariffId ?? undefined}
                placeholder="Выбрать тариф"
                style={{ width: "100%", marginTop: 4 }}
                onChange={changeTariff}
                disabled={!can("tenants.tariff")}
                loading={setTariff.isPending}
                options={(tariffs ?? [])
                  .filter((tf) => !tf.archived || tf.id === t.tariffId)
                  .map((tf) => ({
                    value: tf.id,
                    label: `${tf.name} (${tf.code})${tf.archived ? " · архив" : ""}`,
                  }))}
              />
            </div>

            <div>
              <Text strong>Индивидуальная цена, сом/мес</Text>
              <br />
              <Space.Compact style={{ width: "100%", marginTop: 4 }}>
                <InputNumber
                  min={0}
                  max={100_000_000}
                  style={{ width: "100%" }}
                  placeholder={
                    tariff ? String(Number(tariff.price)) : "по тарифу"
                  }
                  value={t.priceOverride ? Number(t.priceOverride) : undefined}
                  onChange={(v) => setPriceDraft(v == null ? "" : String(v))}
                />
                <Button
                  onClick={() =>
                    savePrice(priceDraft === "" ? null : Number(priceDraft))
                  }
                  loading={setPrice.isPending}
                >
                  Сохранить
                </Button>
                {t.priceOverride && (
                  <Button onClick={() => savePrice(null)}>Сброс</Button>
                )}
              </Space.Compact>
              {tariff &&
                t.priceOverride &&
                Number(t.priceOverride) !== Number(tariff.price) && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    на {fmtMoney(Math.abs(Number(t.priceOverride) - Number(tariff.price)))}{" "}
                    {Number(t.priceOverride) > Number(tariff.price)
                      ? "больше"
                      : "меньше"}{" "}
                    тарифа
                  </Text>
                )}
            </div>

            <Divider titlePlacement="start">Модули</Divider>
            <div>
              <Space
                style={{
                  width: "100%",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text strong>Модули компании</Text>
                {overrideCount > 0 && (
                  <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Изменено относительно тарифа: {overrideCount}
                    </Text>
                    <Button
                      size="small"
                      disabled={!can("tenants.tariff")}
                      onClick={() =>
                        modal.confirm({
                          title: "Сбросить модули к тарифу?",
                          content:
                            "Индивидуальные правки модулей удалятся, останутся модули тарифа.",
                          okText: "Сбросить",
                          okButtonProps: { danger: true },
                          cancelText: "Отмена",
                          onOk: () =>
                            setModules.mutate(
                              { id: t.id, modules: {} },
                              {
                                onSuccess: () => {
                                  message.success("Сброшено к тарифу");
                                  setModuleChecked(null);
                                },
                                onError: () =>
                                  message.error("Не удалось сбросить"),
                              },
                            ),
                        })
                      }
                    >
                      Сбросить к тарифу
                    </Button>
                  </Space>
                )}
              </Space>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                Итоговый набор разделов = тариф + индивидуальные правки. Отличия
                от тарифа помечены.
              </div>
              <Tree
                checkable
                selectable={false}
                defaultExpandAll
                disabled={!can("tenants.tariff")}
                treeData={moduleTreeData}
                checkedKeys={
                  moduleChecked ??
                  allSectionKeys.filter((k) => data.modules[k] !== false)
                }
                onCheck={(keys) => {
                  const arr = (Array.isArray(keys) ? keys : keys.checked).map(
                    String,
                  );
                  setModuleChecked(arr.filter((k) => !k.startsWith("grp:")));
                }}
              />
              <Button
                size="small"
                style={{ marginTop: 8 }}
                disabled={!can("tenants.tariff") || !moduleChecked}
                loading={setModules.isPending}
                onClick={() => {
                  // Override = отличия от тарифа (иначе — по тарифу, ключа нет).
                  const desired = moduleChecked ?? [];
                  const override: Record<string, boolean> = {};
                  for (const k of allSectionKeys) {
                    const want = desired.includes(k);
                    const byTariff = data.tariffModules?.[k] !== false;
                    if (want !== byTariff) override[k] = want;
                  }
                  setModules.mutate(
                    { id: t.id, modules: override },
                    {
                      onSuccess: () => {
                        message.success("Модули компании сохранены");
                        setModuleChecked(null);
                      },
                      onError: () => message.error("Не удалось сохранить"),
                    },
                  );
                }}
              >
                Сохранить модули
              </Button>
            </div>

            <div>
              <Text strong>Аддоны (докуплено)</Text>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                Прибавляются к лимитам: доп. сотрудник → +сотрудники, WABA/доп.
                WhatsApp → +номера WhatsApp.
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0 8px",
                }}
              >
                {addonMeta.map((a) => {
                  const cur = addonDraft ?? data.addons ?? {};
                  return (
                    <div key={a.key}>
                      <div style={{ fontSize: 12 }}>{a.label}</div>
                      <InputNumber
                        min={0}
                        style={{ width: "100%" }}
                        placeholder="0"
                        disabled={!can("billing.edit")}
                        value={cur[a.key] ?? 0}
                        onChange={(v) =>
                          setAddonDraft({
                            ...(addonDraft ?? data.addons ?? {}),
                            [a.key]: Number(v ?? 0),
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
              {(() => {
                const seat = data.addons?.extraSeat ?? 0;
                const wa =
                  (data.addons?.wabaNumber ?? 0) +
                  (data.addons?.extraWhatsapp ?? 0);
                const line = (
                  label: string,
                  eff: number | null | undefined,
                  bonus: number,
                ) => {
                  const e = eff ?? null;
                  const txt =
                    e === null
                      ? "∞"
                      : bonus > 0
                        ? `${e - bonus} (тариф) + ${bonus} (аддон) = ${e}`
                        : `${e}`;
                  return `${label}: ${txt}`;
                };
                return (
                  <div
                    style={{ fontSize: 12, color: "#475569", margin: "8px 0 4px" }}
                  >
                    <div>{line("Лимит сотрудников", data.limits?.users, seat)}</div>
                    <div>
                      {line("Лимит номеров WhatsApp", data.limits?.whatsappNumbers, wa)}
                    </div>
                  </div>
                );
              })()}
              <Button
                size="small"
                style={{ marginTop: 8 }}
                disabled={!can("billing.edit") || !addonDraft}
                loading={setAddons.isPending}
                onClick={() =>
                  setAddons.mutate(
                    { id: t.id, addons: addonDraft ?? {} },
                    {
                      onSuccess: () => {
                        message.success("Аддоны сохранены");
                        setAddonDraft(null);
                      },
                      onError: () => message.error("Не удалось сохранить"),
                    },
                  )
                }
              >
                Сохранить аддоны
              </Button>
            </div>
          </Space>

          {/* Расход vs лимиты тарифа */}
          <Divider titlePlacement="start">
            Лимиты тарифа {t.tariffName ? `(${t.tariffName})` : ""}
          </Divider>
          <Descriptions column={1} size="small">
            {LIMIT_META.map((l) => {
              const used = data.usage[l.key] ?? 0;
              const limit = data.limits[l.key];
              const exceeded = limit !== null && limit !== undefined && used > limit;
              return (
                <Descriptions.Item key={l.key} label={l.label}>
                  <Text type={exceeded ? "danger" : undefined} strong={exceeded}>
                    {used} / {limit === null || limit === undefined ? "∞" : limit}
                    {exceeded ? " — превышение" : ""}
                  </Text>
                </Descriptions.Item>
              );
            })}
          </Descriptions>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {data.limitPolicy === "hard"
              ? "При превышении создание блокируется (402)."
              : "При превышении показывается предупреждение, создание разрешено."}
          </Text>

                  </>
                ),
              },
              {
                label: "Биллинг",
                key: "billing",
                children: (
                  <>
          {/* Биллинг (ручной) */}
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color={PAYMENT_COLOR[t.paymentStatus]}>
              {PAYMENT_LABEL[t.paymentStatus]}
            </Tag>
            <Text type="secondary">Оплачено до: {fmtDate(t.paidUntil)}</Text>
            <Text type="secondary">След. списание: {fmtDate(t.nextChargeAt)}</Text>
          </Space>

          {/* Триал — только если активен */}
          {t.status !== "active" && t.status !== "deleted" && (
            <>
              <Divider titlePlacement="start">Триал</Divider>
              <Space direction="vertical" style={{ marginBottom: 8 }}>
                <Text type={t.trialDaysLeft <= 0 ? "danger" : undefined}>
                  {t.trialDaysLeft > 0
                    ? `Осталось ${t.trialDaysLeft} дн. (до ${fmtDate(t.trialEndsAt)})`
                    : `Триал истёк (${fmtDate(t.trialEndsAt)})`}
                </Text>
                <Space>
                  {[7, 14, 30].map((d) => (
                    <Button
                      key={d}
                      size="small"
                      onClick={() => addDays(d)}
                      loading={extendTrial.isPending}
                    >
                      +{d} дн.
                    </Button>
                  ))}
                </Space>
              </Space>
              <Divider titlePlacement="start">Платежи</Divider>
            </>
          )}
          <div>
            <Button
              type="primary"
              size="small"
              disabled={!can("billing.edit")}
              onClick={() => {
                payForm.setFieldsValue({
                  periodMonths: 1,
                  amount: suggestAmount(1),
                  currency: tariff?.currency ?? "KGS",
                });
                setPayOpen(true);
              }}
            >
              Отметить оплату
            </Button>
          </div>
          <List
            size="small"
            style={{ marginTop: 8 }}
            locale={{ emptyText: "Платежей ещё не было" }}
            dataSource={paymentsResp?.items ?? []}
            pagination={
              (paymentsResp?.total ?? 0) > 10
                ? {
                    current: payPage,
                    pageSize: 10,
                    total: paymentsResp?.total ?? 0,
                    onChange: setPayPage,
                    size: "small",
                  }
                : false
            }
            renderItem={(p) => (
              <List.Item>
                <Space direction="vertical" size={0} style={{ width: "100%" }}>
                  <Space style={{ width: "100%", justifyContent: "space-between" }}>
                    <Text delete={p.cancelled}>
                      {Number(p.amount).toLocaleString("ru-RU")} {p.currency}
                      {p.periodMonths ? ` · ${p.periodMonths} мес.` : ""}
                      {p.cancelled && (
                        <Tag color="default" style={{ marginLeft: 6 }}>
                          отменён
                        </Tag>
                      )}
                    </Text>
                    {!p.cancelled && (
                      <Button
                        type="link"
                        size="small"
                        danger
                        loading={cancelPayment.isPending}
                        onClick={() =>
                          modal.confirm({
                            title: "Отменить платёж?",
                            content:
                              "Оплачено-до пересчитается по оставшимся платежам.",
                            okText: "Отменить",
                            okButtonProps: { danger: true },
                            cancelText: "Нет",
                            onOk: () =>
                              cancelPayment.mutate(
                                { id: t.id, paymentId: p.id },
                                {
                                  onError: () =>
                                    message.error("Не удалось отменить"),
                                },
                              ),
                          })
                        }
                      >
                        Отменить
                      </Button>
                    )}
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    до {fmtDate(p.paidUntil)} ·{" "}
                    {new Date(p.createdAt).toLocaleDateString("ru-RU")} ·{" "}
                    {p.adminLogin}
                    {p.receipt ? ` · чек ${p.receipt}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </Text>
                </Space>
              </List.Item>
            )}
          />

          {/* Уведомления клиенту (все уведомления — про триал и оплату) */}
          <Divider titlePlacement="start">Уведомления</Divider>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: REMINDER_TYPES.map((rt) => ({
                key: rt.value,
                label: rt.label,
                onClick: () =>
                  modal.confirm({
                    title: "Отправить уведомление?",
                    content: `«${rt.label}» получателю: ${
                      t.contactPhone || t.contactEmail || "контакт не указан"
                    }`,
                    okText: "Отправить",
                    cancelText: "Отмена",
                    onOk: () => doSendReminder(rt.value),
                  }),
              })),
            }}
          >
            <Button size="small" loading={sendReminder.isPending}>
              Отправить уведомление ▾
            </Button>
          </Dropdown>
          <List
            size="small"
            style={{ marginTop: 8 }}
            locale={{ emptyText: "Уведомлений ещё не было" }}
            dataSource={(notifications ?? []).slice(0, 10)}
            renderItem={(n) => (
              <List.Item>
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <span>
                    <Tag color={NOTIF_STATUS_COLOR[n.status] ?? "default"}>
                      {n.status}
                    </Tag>
                    {n.type}
                  </span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(n.createdAt).toLocaleString("ru-RU")}
                  </Text>
                </Space>
              </List.Item>
            )}
          />

                  </>
                ),
              },
              {
                label: "Журнал",
                key: "journal",
                children: (
                  <>
          {/* Журнал действий админа */}
          <Select
            size="small"
            value={auditFilter}
            style={{ width: "100%", marginBottom: 8 }}
            onChange={(v) => {
              setAuditFilter(v);
              setAuditLimit(20);
            }}
            options={AUDIT_FILTERS.map((f, i) => ({ value: i, label: f.label }))}
          />
          <List
            size="small"
            locale={{ emptyText: "Пока нет действий" }}
            loadMore={
              audit?.hasMore ? (
                <div style={{ textAlign: "center", padding: 8 }}>
                  <Button
                    size="small"
                    onClick={() => setAuditLimit((l) => l + 20)}
                  >
                    Показать ещё
                  </Button>
                </div>
              ) : undefined
            }
            dataSource={audit?.rows ?? []}
            renderItem={(r) => (
              <List.Item>
                <Space direction="vertical" size={0} style={{ width: "100%" }}>
                  <Text>
                    {AUDIT_ACTION_LABEL[r.action] ?? r.action}{" "}
                    <Text type="secondary">· {r.adminLogin}</Text>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(r.createdAt).toLocaleString("ru-RU")}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
                  </>
                ),
              },
            ]}
          />

          <Modal
            open={payOpen}
            title="Отметить оплату"
            onCancel={() => setPayOpen(false)}
            onOk={() => payForm.submit()}
            okText="Записать"
            cancelText="Отмена"
            confirmLoading={recordPayment.isPending}
          >
            <Form form={payForm} layout="vertical" onFinish={submitPayment}>
              <Form.Item
                name="periodMonths"
                label="Период оплаты"
                rules={[{ required: true }]}
              >
                <Select
                  onChange={(m: number) =>
                    payForm.setFieldsValue({ amount: suggestAmount(m) })
                  }
                  options={PAYMENT_PERIODS.map((m) => {
                    const pct = tariff?.discounts?.[String(m)] ?? 0;
                    return {
                      value: m,
                      label: `${m} мес.${pct ? ` (−${pct}%)` : ""}`,
                    };
                  })}
                />
              </Form.Item>
              <div style={{ display: "flex", gap: 12 }}>
                <Form.Item
                  name="amount"
                  label="Сумма"
                  style={{ flex: 1 }}
                  rules={[{ required: true, message: "Укажите сумму" }]}
                >
                  <InputNumber min={0} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item name="currency" label="Валюта" style={{ width: 110 }}>
                  <Input />
                </Form.Item>
              </div>
              <Form.Item name="receipt" label="Номер чека / счёта">
                <Input placeholder="напр. №1024" />
              </Form.Item>
              <Form.Item name="note" label="Комментарий">
                <Input.TextArea rows={2} placeholder="Способ оплаты, детали" />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {tariff
                  ? `Сумма подставлена из тарифа «${tariff.name}» с учётом скидки — можно поправить вручную.`
                  : "У компании не выбран тариф — укажите сумму вручную."}{" "}
                Компания переводится в «Активна».
              </Text>
            </Form>
          </Modal>

          {/* Деструктив (заморозка/удаление) — ввод slug вручную. */}
          <Modal
            open={danger !== null}
            title={
              danger === "delete" ? "Удалить компанию?" : "Заморозить компанию?"
            }
            okText={danger === "delete" ? "Удалить" : "Заморозить"}
            okButtonProps={{
              danger: true,
              disabled: confirmSlug.trim() !== t.slug,
            }}
            confirmLoading={setStatus.isPending}
            cancelText="Отмена"
            onCancel={() => setDanger(null)}
            onOk={runDanger}
          >
            <Text>
              {danger === "delete"
                ? "Вход закроется, данные — мягкое удаление (восстановимо сменой статуса)."
                : "Доступ станет только на чтение, данные сохранятся."}
            </Text>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Для подтверждения введите slug компании:{" "}
                <Text code>{t.slug}</Text>
              </Text>
              <Input
                style={{ marginTop: 6 }}
                value={confirmSlug}
                onChange={(e) => setConfirmSlug(e.target.value)}
                placeholder={t.slug}
              />
            </div>
          </Modal>
        </>
      )}
    </Drawer>
  );
};
