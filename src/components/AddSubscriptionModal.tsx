import { ArrowRightOutlined, InfoCircleOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Form,
  Grid,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Tag,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import { can } from "../api/client";
import {
  useAddSubscription,
  useManualQuote,
  useTariffs,
  useTenants,
  type ManualMethod,
} from "../hooks";
import type { TenantRow } from "../types";

/**
 * «Добавить подписку» — одно окно для ручной оплаты из любого места панели
 * (шапка, «Подписки», карточка компании, «Счета», Ctrl+K). Сумму и новую дату
 * «оплачено до» считает сервер по тем же правилам, что и оплату клиентом;
 * админ видит итог до сохранения и может поправить сумму или отметить
 * «бесплатно».
 */

export const ADD_SUBSCRIPTION_EVENT = "platform-add-subscription";

/** Открыть окно «Добавить подписку» (с выбранной компанией или пустым). */
export const openAddSubscription = (tenantId?: string | null): void => {
  window.dispatchEvent(
    new CustomEvent(ADD_SUBSCRIPTION_EVENT, { detail: { tenantId } }),
  );
};

const QUICK_MONTHS = [1, 3, 6, 12] as const;
/** Скидка за срок по умолчанию (%), если у тарифа нет своей — как на сервере. */
const DEFAULT_DISCOUNT: Record<number, number> = { 1: 0, 3: 5, 6: 10, 12: 15 };

const METHODS: Array<{ value: ManualMethod; label: string }> = [
  { value: "transfer", label: "Перевод" },
  { value: "cash", label: "Наличные" },
  { value: "card", label: "Карта" },
  { value: "free", label: "Бесплатно" },
];

const STATUS_LABEL: Record<string, string> = {
  trial: "Триал",
  active: "Активна",
  blocked: "Заморожена",
  deleted: "Удалена",
};

/** Деньги с разделением тысяч: «5 672 сом». */
const money = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} сом`;

/** 'YYYY-MM-DD' → '16.03.2027' без сдвига часового пояса. */
const day = (s: string | null | undefined) => {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
};

const monthsWord = (n: number) => {
  const d = n % 10;
  const h = n % 100;
  if (d === 1 && h !== 11) return "месяц";
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "месяца";
  return "месяцев";
};

const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || fallback;

type Values = {
  tenantId?: string;
  tariffId?: string | null;
  months: number;
  customMonths?: number | null;
  method: ManualMethod;
  amount?: number | null;
  note?: string;
};

const AddSubscriptionModal = ({
  open,
  initialTenantId,
  onClose,
}: {
  open: boolean;
  initialTenantId: string | null;
  onClose: () => void;
}) => {
  const { message } = App.useApp();
  const isMobile = !Grid.useBreakpoint().sm;
  const [form] = Form.useForm<Values>();
  const { data: tenants, isLoading: tenantsLoading } = useTenants({});
  const { data: tariffs } = useTariffs();
  const add = useAddSubscription();

  // Сумму админ правит руками — тогда её не перетираем пересчётом.
  const [customAmount, setCustomAmount] = useState(false);

  const tenantId = Form.useWatch("tenantId", form);
  const tariffId = Form.useWatch("tariffId", form);
  const months = Form.useWatch("months", form);
  const customMonths = Form.useWatch("customMonths", form);
  const method = Form.useWatch("method", form) ?? "transfer";
  const amount = Form.useWatch("amount", form);

  const liveTenants = useMemo(
    () => (tenants ?? []).filter((t) => t.status !== "deleted"),
    [tenants],
  );
  const tenant: TenantRow | undefined = liveTenants.find(
    (t) => t.id === tenantId,
  );
  const periodMonths = months === 0 ? Number(customMonths ?? 0) : Number(months ?? 0);
  const tariff = (tariffs ?? []).find(
    (t) => t.id === (tariffId ?? tenant?.tariffId),
  );

  const quoteInput =
    tenantId && periodMonths >= 1 && periodMonths <= 36
      ? { tenantId, tariffId: tariffId ?? null, periodMonths, method }
      : null;
  const {
    data: quote,
    isFetching,
    error: quoteError,
  } = useManualQuote(quoteInput);
  const fresh = quote && quote.tenantId === tenantId ? quote : undefined;

  // Пересчёт суммы по тарифу — пока админ её не правил.
  useEffect(() => {
    if (!fresh || customAmount) return;
    form.setFieldValue("amount", fresh.computedAmount);
  }, [fresh, customAmount, form]);

  // Новое открытие — чистое окно; выбранная компания и её тариф подставлены.
  const reset = () => {
    form.resetFields();
    setCustomAmount(false);
    const t = liveTenants.find((x) => x.id === initialTenantId);
    form.setFieldsValue({
      tenantId: initialTenantId ?? undefined,
      tariffId: t?.tariffId ?? null,
      months: 1,
      method: "transfer",
    });
  };

  const discountOf = (m: number) => {
    const raw = tariff?.discounts?.[String(m)];
    return raw != null ? Number(raw) : (DEFAULT_DISCOUNT[m] ?? 0);
  };

  const free = method === "free";
  const finalAmount = free ? 0 : Number(amount ?? fresh?.computedAmount ?? 0);
  const ready = !!fresh && !!tenantId && periodMonths >= 1;

  const submit = async (v: Values) => {
    if (!v.tenantId) return;
    try {
      const res = await add.mutateAsync({
        tenantId: v.tenantId,
        tariffId: v.tariffId ?? null,
        periodMonths: v.months === 0 ? Number(v.customMonths) : v.months,
        method: v.method,
        amount:
          v.method === "free" ? 0 : customAmount ? Number(v.amount ?? 0) : null,
        note: v.note?.trim() || null,
      });
      message.success(
        `«${res.quote.tenantName}»: подписка до ${day(res.quote.paidUntilAfter)}`,
      );
      onClose();
    } catch (e) {
      message.error(errText(e, "Не удалось добавить подписку"));
    }
  };

  const startText = (q: NonNullable<typeof fresh>) => {
    // Сервер считает «сегодня» в UTC — сравниваем так же.
    if (q.startsFrom <= new Date().toISOString().slice(0, 10))
      return "с сегодняшнего дня";
    if (q.paidUntilBefore && q.startsFrom === q.paidUntilBefore.slice(0, 10))
      return "продолжит текущий срок";
    return "после пробного периода";
  };

  return (
    <Modal
      open={open}
      title="Добавить подписку"
      onCancel={onClose}
      width={isMobile ? "100%" : 600}
      centered={!isMobile}
      destroyOnHidden
      afterOpenChange={(o) => {
        if (o) reset();
      }}
      footer={
        <div className="addsub-footer">
          <Button onClick={onClose}>Отмена</Button>
          <Button
            type="primary"
            onClick={() => form.submit()}
            loading={add.isPending}
            disabled={!ready}
          >
            {ready
              ? `Добавить · ${free ? "бесплатно" : money(finalAmount)}`
              : "Добавить подписку"}
          </Button>
        </div>
      }
    >
      <Form<Values>
        form={form}
        layout="vertical"
        onFinish={submit}
        requiredMark={false}
        initialValues={{ months: 1, method: "transfer" }}
      >
        <Form.Item
          name="tenantId"
          label="Компания"
          rules={[{ required: true, message: "Выберите компанию" }]}
        >
          <Select
            showSearch
            autoFocus={!initialTenantId}
            loading={tenantsLoading}
            optionFilterProp="search"
            placeholder="Название, адрес или телефон владельца"
            onChange={(id: string) => {
              const t = liveTenants.find((x) => x.id === id);
              form.setFieldValue("tariffId", t?.tariffId ?? null);
              setCustomAmount(false);
            }}
            options={liveTenants.map((t) => ({
              value: t.id,
              search:
                `${t.name} ${t.slug} ${t.ownerName ?? ""} ${t.contactPhone ?? ""} ${t.ownerPhone ?? ""}`
                  .toLowerCase()
                  .replace(/ё/g, "е"),
              label: (
                <span className="addsub-option">
                  <span className="addsub-option-name">{t.name}</span>
                  <span className="addsub-option-sub">
                    {t.status === "trial"
                      ? `триал · ${t.trialDaysLeft > 0 ? `${t.trialDaysLeft} дн.` : "истёк"}`
                      : t.paidUntil
                        ? `до ${day(t.paidUntil)}`
                        : (STATUS_LABEL[t.status] ?? t.status).toLowerCase()}
                  </span>
                </span>
              ),
            }))}
          />
        </Form.Item>

        <Form.Item
          name="tariffId"
          label="Тариф"
          extra={
            !can("tenants.tariff") ? "Сменить тариф может админ с правом «Тарифы компаний»" : undefined
          }
        >
          <Select
            placeholder="Тариф компании"
            disabled={!tenantId || !can("tenants.tariff")}
            onChange={() => setCustomAmount(false)}
            options={(tariffs ?? [])
              .filter((tf) => !tf.archived || tf.id === tenant?.tariffId)
              .map((tf) => ({
                value: tf.id,
                label: `${tf.name} · ${money(Number(tf.price))}${tf.period === "year" ? " в год" : " в месяц"}${tf.id === tenant?.tariffId ? " · текущий" : ""}`,
              }))}
          />
        </Form.Item>
        {fresh?.tariffChanged ? (
          <Alert
            className="addsub-alert"
            type="info"
            showIcon
            title={`Тариф сменится на «${fresh.tariffName}»`}
            description="Модули и лимиты компании сразу станут как у нового тарифа."
          />
        ) : null}

        <Form.Item name="months" label="Срок">
          <Segmented
            block
            onChange={() => setCustomAmount(false)}
            options={[
              ...QUICK_MONTHS.map((m) => {
                const pct = discountOf(m);
                return {
                  value: m as number,
                  label: (
                    <span className="addsub-period">
                      <span>{m} мес.</span>
                      {pct > 0 ? (
                        <span className="addsub-period-off">−{pct}%</span>
                      ) : null}
                    </span>
                  ),
                };
              }),
              {
                value: 0,
                label: <span className="addsub-period">Другой</span>,
              },
            ]}
          />
        </Form.Item>
        {months === 0 ? (
          <Form.Item
            name="customMonths"
            label="Сколько месяцев"
            rules={[
              { required: true, message: "Укажите срок" },
              { type: "number", min: 1, max: 36, message: "От 1 до 36 месяцев" },
            ]}
          >
            <InputNumber<number>
              autoFocus
              min={1}
              max={36}
              precision={0}
              style={{ width: "100%" }}
              suffix="мес."
              onChange={() => setCustomAmount(false)}
            />
          </Form.Item>
        ) : null}

        <Form.Item name="method" label="Как оплатили">
          <Segmented block options={METHODS} />
        </Form.Item>

        <div className="addsub-row">
          <Form.Item
            name="amount"
            label="Сумма"
            className="addsub-amount"
            extra={
              free ? (
                "Бесплатный период — оплата 0 сом"
              ) : customAmount && fresh ? (
                <span>
                  По тарифу {money(fresh.computedAmount)} ·{" "}
                  <a
                    onClick={() => {
                      setCustomAmount(false);
                      form.setFieldValue("amount", fresh.computedAmount);
                    }}
                  >
                    вернуть
                  </a>
                </span>
              ) : (
                "По тарифу со скидкой за срок — можно поправить"
              )
            }
          >
            <InputNumber<number>
              min={0}
              precision={0}
              disabled={free || !tenantId}
              style={{ width: "100%" }}
              suffix="сом"
              formatter={(v) =>
                v == null || String(v) === ""
                  ? ""
                  : Number(v).toLocaleString("ru-RU")
              }
              parser={(v) => Number(String(v ?? "").replace(/[^\d]/g, ""))}
              onChange={() => setCustomAmount(true)}
            />
          </Form.Item>
          <Form.Item
            name="note"
            label="Комментарий / № чека"
            className="addsub-note"
          >
            <Input placeholder="напр. перевод MBank, чек №1024" maxLength={500} />
          </Form.Item>
        </div>

        {/* Итог — что именно произойдёт после сохранения. */}
        <div className="addsub-summary" aria-live="polite">
          {!tenantId ? (
            <div className="addsub-summary-empty">
              <InfoCircleOutlined /> Выберите компанию — покажем новую дату и
              сумму
            </div>
          ) : quoteError && !fresh ? (
            <div className="addsub-summary-empty">
              {errText(quoteError, "Не удалось посчитать")}
            </div>
          ) : !fresh ? (
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          ) : (
            <div
              className={`addsub-summary-body${isFetching ? " is-stale" : ""}`}
            >
              <div className="addsub-dates">
                <div>
                  <div className="addsub-k">Оплачено до</div>
                  <div className="addsub-v addsub-v-old">
                    {fresh.paidUntilBefore
                      ? day(fresh.paidUntilBefore)
                      : "не оплачено"}
                  </div>
                </div>
                <ArrowRightOutlined className="addsub-arrow" aria-hidden />
                <div>
                  <div className="addsub-k">Станет</div>
                  <div className="addsub-v addsub-v-new">
                    {day(fresh.paidUntilAfter)}
                  </div>
                </div>
              </div>
              <ul className="addsub-lines">
                <li>
                  +{fresh.months} {monthsWord(fresh.months)} с{" "}
                  {day(fresh.startsFrom)} — {startText(fresh)}
                </li>
                {!free && fresh.monthly > 0 ? (
                  <li>
                    {money(fresh.monthly)} × {fresh.months} мес.
                    {fresh.discountPct > 0 ? ` − ${fresh.discountPct}%` : ""} ={" "}
                    {money(fresh.computedAmount)}
                    {customAmount && finalAmount !== fresh.computedAmount
                      ? ` · записываем ${money(finalAmount)}`
                      : ""}
                  </li>
                ) : !free ? (
                  <li>У тарифа нет цены — укажите сумму вручную</li>
                ) : null}
                <li>
                  Статус:{" "}
                  {fresh.frozenManually ? (
                    <Tag color="orange" style={{ marginInlineEnd: 0 }}>
                      останется «Заморожена» — заморожена вручную
                    </Tag>
                  ) : fresh.statusBefore === "active" ? (
                    <Tag color="green" style={{ marginInlineEnd: 0 }}>
                      Активна
                    </Tag>
                  ) : (
                    <>
                      {STATUS_LABEL[fresh.statusBefore] ?? fresh.statusBefore} →{" "}
                      <Tag color="green" style={{ marginInlineEnd: 0 }}>
                        Активна
                      </Tag>
                    </>
                  )}
                </li>
              </ul>
            </div>
          )}
        </div>
        <div className="addsub-hint">
          Ошибочную оплату можно отменить в карточке компании → «Подписка».
        </div>
      </Form>
    </Modal>
  );
};

/**
 * Один экземпляр окна на всё приложение: открывается событием
 * openAddSubscription() из любого раздела.
 */
export const AddSubscriptionHost = () => {
  const [state, setState] = useState<{ open: boolean; tenantId: string | null }>(
    { open: false, tenantId: null },
  );
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ tenantId?: string | null }>).detail
        ?.tenantId;
      setState({ open: true, tenantId: id ?? null });
    };
    window.addEventListener(ADD_SUBSCRIPTION_EVENT, onOpen);
    return () => window.removeEventListener(ADD_SUBSCRIPTION_EVENT, onOpen);
  }, []);
  if (!can("billing.edit")) return null;
  return (
    <AddSubscriptionModal
      open={state.open}
      initialTenantId={state.tenantId}
      onClose={() => setState((s) => ({ ...s, open: false }))}
    />
  );
};
