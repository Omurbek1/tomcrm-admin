import {
  App,
  Alert,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";

import { CRM_URL } from "../api/client";
import {
  useAudit,
  useExtendTrial,
  useImpersonate,
  usePayments,
  useRecordPayment,
  useSetContacts,
  useSetStatus,
  useSetTariff,
  useTariffs,
  useTenant,
} from "../hooks";
import type { TenantStatus } from "../types";
import {
  AUDIT_ACTION_LABEL,
  LIMIT_META,
  PAYMENT_COLOR,
  PAYMENT_LABEL,
  STATUS_COLOR,
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
  const { data: audit } = useAudit(tenantId ?? undefined);
  const { data: payments } = usePayments(tenantId);
  const setStatus = useSetStatus();
  const extendTrial = useExtendTrial();
  const setTariff = useSetTariff();
  const setContacts = useSetContacts();
  const recordPayment = useRecordPayment();
  const impersonate = useImpersonate();
  const [contactForm] = Form.useForm();
  const [payOpen, setPayOpen] = useState(false);
  const [payForm] = Form.useForm();

  const t = data?.tenant;

  const submitPayment = (v: {
    amount: number;
    currency: string;
    periodMonths: number;
    note?: string;
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

  return (
    <Drawer
      open={!!tenantId}
      onClose={onClose}
      width={560}
      title={t ? t.name : "Компания"}
    >
      {isLoading || !t || !data ? (
        <Spin />
      ) : (
        <>
          <Space size="middle" wrap style={{ marginBottom: 8 }}>
            <Tag color={STATUS_COLOR[t.status]}>{STATUS_LABEL[t.status]}</Tag>
            <Text type="secondary">/{t.slug}</Text>
            {t.status === "trial" && (
              <Text type={t.trialDaysLeft <= 0 ? "danger" : "secondary"}>
                Триал: {t.trialDaysLeft} дн.
              </Text>
            )}
          </Space>
          <div style={{ marginBottom: 8 }}>
            <Button
              onClick={doImpersonate}
              loading={impersonate.isPending}
              disabled={t.status === "deleted"}
            >
              Войти под владельцем ↗
            </Button>
          </div>

          {noContacts && (
            <Alert
              type="warning"
              showIcon
              style={{ margin: "8px 0" }}
              message="Нет контактов — некому написать при истечении триала. Заполните телефон/email ниже."
            />
          )}

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

          {/* Биллинг (ручной) */}
          <Divider titlePlacement="start">Оплата</Divider>
          <Space wrap style={{ marginBottom: 8 }}>
            <Tag color={PAYMENT_COLOR[t.paymentStatus]}>
              {PAYMENT_LABEL[t.paymentStatus]}
            </Tag>
            <Text type="secondary">Оплачено до: {fmtDate(t.paidUntil)}</Text>
            <Text type="secondary">След. списание: {fmtDate(t.nextChargeAt)}</Text>
          </Space>
          <div>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                payForm.setFieldsValue({
                  amount: t.tariffId ? undefined : 0,
                  currency: "KGS",
                  periodMonths: 1,
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
            dataSource={(payments ?? []).slice(0, 10)}
            renderItem={(p) => (
              <List.Item>
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <Text>
                    {Number(p.amount).toLocaleString("ru-RU")} {p.currency}
                    {p.periodMonths ? ` · ${p.periodMonths} мес.` : ""}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    до {fmtDate(p.paidUntil)} ·{" "}
                    {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                  </Text>
                </Space>
              </List.Item>
            )}
          />

          {/* Действия */}
          <Divider titlePlacement="start">Действия</Divider>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <div>
              <Text strong>Статус</Text>
              <br />
              <Select
                value={t.status}
                style={{ width: "100%", marginTop: 4 }}
                onChange={changeStatus}
                loading={setStatus.isPending}
                options={(
                  ["trial", "active", "blocked", "deleted"] as TenantStatus[]
                ).map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {STATUS_DATA_POLICY[t.status]}
              </Text>
            </div>

            <div>
              <Text strong>Продлить триал</Text>
              <br />
              {t.status === "active" ? (
                <Text type="secondary">
                  Компания оплачена — управляйте датой оплаты в биллинге, триал
                  не применяется.
                </Text>
              ) : (
                <Space style={{ marginTop: 4 }}>
                  {[7, 14, 30].map((d) => (
                    <Button
                      key={d}
                      onClick={() => addDays(d)}
                      loading={extendTrial.isPending}
                    >
                      +{d} дн.
                    </Button>
                  ))}
                </Space>
              )}
            </div>

            <div>
              <Text strong>Тариф</Text>
              <br />
              <Select
                value={t.tariffId ?? undefined}
                placeholder="Выбрать тариф"
                style={{ width: "100%", marginTop: 4 }}
                onChange={changeTariff}
                loading={setTariff.isPending}
                options={(tariffs ?? []).map((tf) => ({
                  value: tf.id,
                  label: `${tf.name} (${tf.code})`,
                }))}
              />
            </div>
          </Space>

          {/* Журнал действий админа */}
          <Divider titlePlacement="start">Журнал действий</Divider>
          <List
            size="small"
            locale={{ emptyText: "Пока нет действий" }}
            dataSource={(audit ?? []).slice(0, 20)}
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
              <Form.Item
                name="periodMonths"
                label="Период (месяцев)"
                rules={[{ required: true, message: "Укажите период" }]}
              >
                <InputNumber min={1} max={120} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="note" label="Примечание">
                <Input.TextArea rows={2} placeholder="Напр. счёт №, способ" />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Компания переводится в «Активна», оплата продлевается на указанный
                период.
              </Text>
            </Form>
          </Modal>
        </>
      )}
    </Drawer>
  );
};
