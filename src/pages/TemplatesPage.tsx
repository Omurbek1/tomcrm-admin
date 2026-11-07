import { App, Button, Card, Form, Input, Modal, Switch, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useRef, useState } from "react";
import type { TextAreaRef } from "antd/es/input/TextArea";

import { useTemplates, useUpdateTemplate } from "../hooks";
import type { NotificationTemplate } from "../types";
import { TEMPLATE_PLACEHOLDERS } from "../types";
import { can, CRM_URL } from "../api/client";
import { PageHeader } from "../components/viz";
import { ResponsiveTable } from "../components/MobileCards";

/** Что подставится вместо переменной и пример для предпросмотра. */
const VARS: Record<string, { label: string; sample: string }> = {
  company: { label: "название компании", sample: "Кафе Нур" },
  daysLeft: { label: "дней до конца триала", sample: "3" },
  trialEndsAt: { label: "дата конца триала", sample: "10.11.2026" },
  paidUntil: { label: "оплачено до", sample: "01.12.2026" },
  nextChargeAt: { label: "следующее списание", sample: "01.12.2026" },
  login: { label: "логин владельца", sample: "nur" },
  password: { label: "временный пароль", sample: "••••••" },
  crmUrl: { label: "ссылка на CRM", sample: CRM_URL },
};

const usedVars = (body: string) =>
  [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

/** Неизвестная переменная уходит клиенту пустым местом — ловим до сохранения. */
const unknownVars = (body: string) =>
  [...new Set(usedVars(body).filter((v) => !TEMPLATE_PLACEHOLDERS.includes(v)))];

const preview = (body: string) =>
  body.replace(/\{(\w+)\}/g, (_m, v: string) => VARS[v]?.sample ?? "");

export const TemplatesPage = () => {
  const editable = can("templates.edit");
  const { message } = App.useApp();
  const { data: templates, isLoading } = useTemplates();
  const update = useUpdateTemplate();
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [form] = Form.useForm();
  const body: string = Form.useWatch("body", form) ?? "";
  const bodyRef = useRef<TextAreaRef>(null);
  const unknown = unknownVars(body);

  // Вставить переменную туда, где стоит курсор.
  const insertVar = (name: string) => {
    const el = bodyRef.current?.resizableTextArea?.textArea;
    const token = `{${name}}`;
    const start = el?.selectionStart ?? body.length;
    const end = el?.selectionEnd ?? body.length;
    form.setFieldValue("body", body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const openEdit = (t: NotificationTemplate) => {
    setEditing(t);
    form.setFieldsValue({ title: t.title, body: t.body, enabled: t.enabled });
  };

  const submit = (v: { title: string; body: string; enabled: boolean }) => {
    if (!editing) return;
    update.mutate(
      { key: editing.key, ...v },
      {
        onSuccess: () => {
          message.success("Шаблон сохранён");
          setEditing(null);
        },
        onError: () => message.error("Не удалось сохранить"),
      },
    );
  };

  const columns: ColumnsType<NotificationTemplate> = [
    {
      title: "Шаблон",
      dataIndex: "title",
      render: (v: string, r) => (
        <span>
          <b>{v}</b> <Tag>{r.key}</Tag>
          {!r.enabled && <Tag color="default">выключен</Tag>}
        </span>
      ),
    },
    {
      title: "Текст",
      dataIndex: "body",
      render: (v: string) => (
        <span style={{ color: "#64748b", fontSize: 13 }}>
          {v.length > 90 ? v.slice(0, 90) + "…" : v}
        </span>
      ),
    },
    {
      title: "",
      width: 100,
      render: (_v, r) => (
        <Button size="small" disabled={!editable} onClick={() => openEdit(r)}>
          Изменить
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        title="Уведомления"
        subtitle="Тексты автоматических сообщений клиентам в WhatsApp"
      />
      <Card>
        <p style={{ color: "#64748b", marginTop: 0 }}>
          Эти сообщения уходят клиентам сами: за 3, 1 и 0 дней до конца
          триала, напоминание об оплате, приглашение владельца при создании
          компании. Правки действуют сразу.
        </p>
        <ResponsiveTable<NotificationTemplate>
          rowKey="key"
          loading={isLoading}
          dataSource={templates ?? []}
          columns={columns}
          scroll={{ x: "max-content" }}
          pagination={false}
        />
      </Card>

      <Modal
        open={!!editing}
        title={`Шаблон: ${editing?.title ?? ""}`}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={update.isPending}
        width={640}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="body"
            label="Текст"
            rules={[
              { required: true, message: "Введите текст" },
              {
                validator: (_r, v: string) =>
                  unknownVars(v ?? "").length
                    ? Promise.reject(
                        new Error(
                          `Нет такой переменной: ${unknownVars(v)
                            .map((x) => `{${x}}`)
                            .join(", ")} — клиент увидит пустое место`,
                        ),
                      )
                    : Promise.resolve(),
              },
            ]}
            extra="Нажмите на переменную ниже — она встанет туда, где курсор."
          >
            <Input.TextArea ref={bodyRef} rows={6} />
          </Form.Item>
          <div style={{ marginTop: -8, marginBottom: 12 }}>
            {TEMPLATE_PLACEHOLDERS.map((p) => (
              <Tag
                key={p}
                style={{ margin: 2, cursor: "pointer" }}
                color={usedVars(body).includes(p) ? "blue" : undefined}
                onClick={() => insertVar(p)}
              >
                {`{${p}}`} · {VARS[p]?.label ?? p}
              </Tag>
            ))}
          </div>
          {body.trim() ? (
            <div className="tpl-preview">
              <div className="tpl-preview-label">Так увидит клиент (пример)</div>
              <div className="tpl-preview-bubble">{preview(body)}</div>
              {unknown.length ? (
                <div className="tpl-preview-warn">
                  Пустое место вместо {unknown.map((x) => `{${x}}`).join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}
          <Form.Item name="enabled" label="Включён" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
