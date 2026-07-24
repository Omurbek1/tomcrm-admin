import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import {
  useAdmins,
  useChangeAdminPassword,
  useCreateAdmin,
  useDeleteAdmin,
  useSetAdminActive,
} from "../hooks";
import type { AdminRow } from "../types";

export const AdminsPage = () => {
  const { message } = App.useApp();
  const { data: admins, isLoading } = useAdmins();
  const createAdmin = useCreateAdmin();
  const setActive = useSetAdminActive();
  const changePassword = useChangeAdminPassword();
  const deleteAdmin = useDeleteAdmin();

  const [createOpen, setCreateOpen] = useState(false);
  const [pwFor, setPwFor] = useState<AdminRow | null>(null);
  const [createForm] = Form.useForm();
  const [pwForm] = Form.useForm();

  const submitCreate = (v: {
    login: string;
    name?: string;
    password: string;
  }) => {
    createAdmin.mutate(v, {
      onSuccess: () => {
        message.success("Админ создан");
        setCreateOpen(false);
        createForm.resetFields();
      },
      onError: (e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Не удалось создать";
        message.error(msg);
      },
    });
  };

  const submitPassword = (v: { password: string }) => {
    if (!pwFor) return;
    changePassword.mutate(
      { id: pwFor.id, password: v.password },
      {
        onSuccess: () => {
          message.success("Пароль изменён");
          setPwFor(null);
          pwForm.resetFields();
        },
        onError: () => message.error("Не удалось сменить пароль"),
      },
    );
  };

  const toggleActive = (r: AdminRow, isActive: boolean) => {
    setActive.mutate(
      { id: r.id, isActive },
      {
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response
              ?.data?.message ?? "Не удалось изменить";
          message.error(msg);
        },
      },
    );
  };

  const remove = (r: AdminRow) => {
    deleteAdmin.mutate(r.id, {
      onSuccess: () => message.success("Админ удалён"),
      onError: (e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "Не удалось удалить";
        message.error(msg);
      },
    });
  };

  const columns: ColumnsType<AdminRow> = [
    {
      title: "Логин",
      dataIndex: "login",
      render: (v: string, r) => (
        <span>
          <b>{v}</b>
          {r.mustChangePassword && (
            <Tag color="orange" style={{ marginLeft: 8 }}>
              сменить пароль
            </Tag>
          )}
        </span>
      ),
    },
    { title: "Имя", dataIndex: "name", render: (v) => v ?? "—" },
    {
      title: "Активен",
      dataIndex: "isActive",
      width: 100,
      render: (v: boolean, r) => (
        <Switch
          checked={v}
          onChange={(checked) => toggleActive(r, checked)}
          loading={setActive.isPending}
        />
      ),
    },
    {
      title: "Последний вход",
      dataIndex: "lastLoginAt",
      width: 170,
      render: (v: string | null) =>
        v ? new Date(v).toLocaleString("ru-RU") : "—",
    },
    {
      title: "",
      width: 220,
      render: (_v, r) => (
        <Space>
          <Button size="small" onClick={() => setPwFor(r)}>
            Пароль
          </Button>
          <Popconfirm
            title="Удалить админа?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() => remove(r)}
          >
            <Button size="small" danger>
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <Card
        title="Администраторы платформы"
        extra={
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Добавить админа
          </Button>
        }
      >
        <Table<AdminRow>
          rowKey="id"
          loading={isLoading}
          dataSource={admins ?? []}
          columns={columns}
          pagination={false}
        />
      </Card>

      <Modal
        open={createOpen}
        title="Новый администратор"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createAdmin.isPending}
      >
        <Form form={createForm} layout="vertical" onFinish={submitCreate}>
          <Form.Item
            name="login"
            label="Логин"
            rules={[{ required: true, min: 3, message: "Минимум 3 символа" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item name="name" label="Имя">
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, min: 6, message: "Минимум 6 символов" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!pwFor}
        title={`Новый пароль для ${pwFor?.login ?? ""}`}
        onCancel={() => setPwFor(null)}
        onOk={() => pwForm.submit()}
        okText="Сменить"
        cancelText="Отмена"
        confirmLoading={changePassword.isPending}
      >
        <Form form={pwForm} layout="vertical" onFinish={submitPassword}>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, min: 6, message: "Минимум 6 символов" }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
