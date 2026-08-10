import { App, Button, Card, Form, Input, Modal, Switch, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import { useTemplates, useUpdateTemplate } from "../hooks";
import type { NotificationTemplate } from "../types";
import { TEMPLATE_PLACEHOLDERS } from "../types";
import { can } from "../api/client";
import { PageHeader } from "../components/viz";

export const TemplatesPage = () => {
  const editable = can("templates.edit");
  const { message } = App.useApp();
  const { data: templates, isLoading } = useTemplates();
  const update = useUpdateTemplate();
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [form] = Form.useForm();

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
        subtitle="Шаблоны клиентских уведомлений (WhatsApp)"
      />
      <Card>
        <p style={{ color: "#64748b", marginTop: 0 }}>
          Автоматика: триал за 3/1/0 дней, напоминание об оплате, приглашение
          владельца при создании компании. Правки применяются без деплоя.
        </p>
        <Table<NotificationTemplate>
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
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="title" label="Название" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body" label="Текст" rules={[{ required: true }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item name="enabled" label="Включён" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Плейсхолдеры:{" "}
            {TEMPLATE_PLACEHOLDERS.map((p) => (
              <Tag key={p} style={{ margin: 2 }}>{`{${p}}`}</Tag>
            ))}
          </div>
        </Form>
      </Modal>
    </div>
  );
};
