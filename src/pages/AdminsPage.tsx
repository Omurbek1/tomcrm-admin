import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  QRCode,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";

import {
  use2faDisable,
  use2faEnable,
  use2faSetup,
  useAdmins,
  useChangeAdminPassword,
  useCreateAdmin,
  useDeleteAdmin,
  useMe,
  usePermissionCatalog,
  useSetAdminActive,
  useSetAdminPermissions,
} from "../hooks";
import type { AdminRow } from "../types";
import { can } from "../api/client";
import { PageHeader } from "../components/viz";
import { ResponsiveTable } from "../components/MobileCards";

const { Text, Paragraph } = Typography;

const permsSummary = (perms: string[]): string =>
  perms.includes("*") ? "Полный доступ" : perms.length ? `${perms.length} прав` : "—";


/** Надёжный пароль без похожих символов (0/O, 1/l/I) — легко продиктовать. */
const genPassword = (len = 14): string => {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => abc[n % abc.length]).join("");
};

/** Поле пароля с кнопкой «Сгенерировать» (сразу копирует в буфер). */
const PasswordField = ({
  form,
  onCopied,
}: {
  form: ReturnType<typeof Form.useForm>[0];
  onCopied: () => void;
}) => (
  <Form.Item
    label="Пароль"
    required
    extra="Не короче 6 символов. «Сгенерировать» — сразу скопирует в буфер."
  >
    <Space.Compact style={{ width: "100%" }}>
      <Form.Item
        name="password"
        noStyle
        rules={[{ required: true, min: 6, message: "Минимум 6 символов" }]}
      >
        <Input.Password autoComplete="new-password" />
      </Form.Item>
      <Button
        onClick={() => {
          const pw = genPassword();
          form.setFieldsValue({ password: pw });
          void navigator.clipboard?.writeText(pw).then(onCopied, () => undefined);
        }}
      >
        Сгенерировать
      </Button>
    </Space.Compact>
  </Form.Item>
);

export const AdminsPage = () => {
  const { message } = App.useApp();
  const { data: admins, isLoading } = useAdmins();
  const { data: catalog } = usePermissionCatalog();
  const { data: me } = useMe();
  const createAdmin = useCreateAdmin();
  const setActive = useSetAdminActive();
  const changePassword = useChangeAdminPassword();
  const deleteAdmin = useDeleteAdmin();
  const setPerms = useSetAdminPermissions();

  const [createOpen, setCreateOpen] = useState(false);
  const [pwFor, setPwFor] = useState<AdminRow | null>(null);
  const [permsFor, setPermsFor] = useState<AdminRow | null>(null);
  const [createForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [permDraft, setPermDraft] = useState<string[]>([]);

  const errMsg = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback;

  const submitCreate = (v: {
    login: string;
    name?: string;
    password: string;
    permissions?: string[];
  }) => {
    createAdmin.mutate(
      { ...v, permissions: v.permissions ?? [] },
      {
        onSuccess: () => {
          message.success("Админ создан");
          setCreateOpen(false);
          createForm.resetFields();
        },
        onError: (e) => message.error(errMsg(e, "Не удалось создать")),
      },
    );
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
        onError: (e) => message.error(errMsg(e, "Не удалось")),
      },
    );
  };

  const savePerms = () => {
    if (!permsFor) return;
    setPerms.mutate(
      { id: permsFor.id, permissions: permDraft },
      {
        onSuccess: () => {
          message.success("Права обновлены");
          setPermsFor(null);
        },
        onError: (e) => message.error(errMsg(e, "Не удалось")),
      },
    );
  };

  const manage = can("admins.manage");
  // Активные админы без 2FA — главный риск доступа к панели всех компаний.
  const no2fa = (admins ?? []).filter((a) => a.isActive && !a.totpEnabled);

  const columns: ColumnsType<AdminRow> = [
    {
      title: "Логин",
      dataIndex: "login",
      render: (v: string, r) => (
        <span>
          <b>{v}</b>
          {me?.id === r.id && (
            <Tag color="blue" style={{ marginLeft: 8 }}>
              вы
            </Tag>
          )}
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
      title: "Права",
      dataIndex: "permissions",
      render: (p: string[]) =>
        p.includes("*") ? (
          <Tag color="gold">полный доступ</Tag>
        ) : (
          <Text type="secondary">{permsSummary(p)}</Text>
        ),
    },
    {
      title: "2FA",
      dataIndex: "totpEnabled",
      width: 70,
      render: (v: boolean) =>
        v ? <Tag color="green">вкл</Tag> : <Tag>выкл</Tag>,
    },
    {
      title: "Последний вход",
      dataIndex: "lastLoginAt",
      width: 140,
      render: (v: string | null) => {
        if (!v) return <Text type="secondary">не входил</Text>;
        const days = Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000);
        return (
          <Text type={days > 30 ? "danger" : undefined}>
            {new Date(v).toLocaleDateString("ru-RU")}
            {days > 30 ? ` · ${days} дн. назад` : ""}
          </Text>
        );
      },
    },
    {
      title: "Активен",
      dataIndex: "isActive",
      width: 90,
      render: (v: boolean, r) => (
        <Switch
          checked={v}
          disabled={!manage || me?.id === r.id}
          onChange={(checked) =>
            setActive.mutate(
              { id: r.id, isActive: checked },
              { onError: (e) => message.error(errMsg(e, "Не удалось")) },
            )
          }
          loading={setActive.isPending}
        />
      ),
    },
    {
      title: "",
      width: 260,
      render: (_v, r) =>
        !manage ? null : (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setPermsFor(r);
              setPermDraft(r.permissions);
            }}
          >
            Права
          </Button>
          <Button size="small" onClick={() => setPwFor(r)}>
            Пароль
          </Button>
          <Popconfirm
            disabled={me?.id === r.id}
            title="Удалить админа?"
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={() =>
              deleteAdmin.mutate(r.id, {
                onSuccess: () => message.success("Удалён"),
                onError: (e) => message.error(errMsg(e, "Не удалось")),
              })
            }
          >
            <Button size="small" danger disabled={me?.id === r.id}>
              Удалить
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: "0 auto" }}>
      <PageHeader
        title="Администраторы"
        subtitle="Доступы к платформенной панели"
        extra={
          can("admins.manage") && (
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              Добавить админа
            </Button>
          )
        }
      />
      {me && <My2fa me={me} />}
      {no2fa.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`Без 2FA: ${no2fa.map((a) => a.login).join(", ")}`}
          description="У панели доступ ко всем компаниям. Попросите включить 2FA — это делается здесь же, в блоке «Двухфакторная защита» под своим логином."
        />
      )}

      <Card>
        <ResponsiveTable<AdminRow>
          rowKey="id"
          loading={isLoading}
          dataSource={admins ?? []}
          columns={columns}
          scroll={{ x: "max-content" }}
          pagination={false}
        />
      </Card>

      {/* Создание */}
      <Modal
        open={createOpen}
        title="Новый администратор"
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createAdmin.isPending}
        destroyOnHidden
        afterClose={() => createForm.resetFields()}
      >
        <Form form={createForm} layout="vertical" onFinish={submitCreate}>
          <Form.Item
            name="login"
            label="Логин"
            rules={[{ required: true, min: 3, message: "Минимум 3 символа" }]}
          >
            <Input autoComplete="off" autoFocus />
          </Form.Item>
          <Form.Item name="name" label="Имя">
            <Input autoComplete="off" />
          </Form.Item>
          <PasswordField
            form={createForm}
            onCopied={() => message.success("Пароль скопирован")}
          />
          <Form.Item
            name="permissions"
            label="Права"
            extra="Без галочек — только просмотр."
          >
            <Checkbox.Group
              className="perm-grid"
              options={(catalog ?? []).map((p) => ({
                label: p.label,
                value: p.key,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Права */}
      <Modal
        open={!!permsFor}
        title={`Права: ${permsFor?.login ?? ""}`}
        onCancel={() => setPermsFor(null)}
        onOk={savePerms}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={setPerms.isPending}
        destroyOnHidden
      >
        {permsFor?.permissions.includes("*") && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            title="Сейчас полный доступ (владелец). Снимите, чтобы задать точечные права."
          />
        )}
        <Checkbox
          checked={permDraft.includes("*")}
          onChange={(e) => setPermDraft(e.target.checked ? ["*"] : [])}
        >
          Полный доступ (владелец)
        </Checkbox>
        {!permDraft.includes("*") && (
          <div style={{ marginTop: 12 }}>
            <Space size={4} style={{ marginBottom: 8 }}>
              <Button
                size="small"
                onClick={() => setPermDraft((catalog ?? []).map((p) => p.key))}
              >
                Выбрать все
              </Button>
              <Button size="small" onClick={() => setPermDraft([])}>
                Снять все
              </Button>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                Выбрано {permDraft.length} из {(catalog ?? []).length}
              </span>
            </Space>
            <Checkbox.Group
              className="perm-grid"
              value={permDraft}
              onChange={(v) => setPermDraft(v as string[])}
              options={(catalog ?? []).map((p) => ({
                label: p.label,
                value: p.key,
              }))}
            />
          </div>
        )}
      </Modal>

      {/* Пароль */}
      <Modal
        open={!!pwFor}
        title={`Новый пароль для ${pwFor?.login ?? ""}`}
        onCancel={() => setPwFor(null)}
        onOk={() => pwForm.submit()}
        okText="Сменить пароль"
        cancelText="Отмена"
        confirmLoading={changePassword.isPending}
        destroyOnHidden
        afterClose={() => pwForm.resetFields()}
      >
        <Form form={pwForm} layout="vertical" onFinish={submitPassword}>
          <PasswordField
            form={pwForm}
            onCopied={() => message.success("Пароль скопирован — передайте админу")}
          />
        </Form>
      </Modal>
    </div>
  );
};

/** Панель управления собственной 2FA. */
const My2fa = ({ me }: { me: AdminRow }) => {
  const { message } = App.useApp();
  const setup = use2faSetup();
  const enable = use2faEnable();
  const disable = use2faDisable();
  const [setupData, setSetupData] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [code, setCode] = useState("");

  if (me.totpEnabled) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap align="center">
          <Tag color="green">2FA включена</Tag>
          <Text type="secondary">Ваш аккаунт защищён кодом.</Text>
          <Input
            placeholder="код для отключения"
            style={{ width: 160 }}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button
            danger
            onClick={() =>
              disable.mutate(code, {
                onSuccess: () => {
                  message.success("2FA отключена");
                  setCode("");
                },
                onError: () => message.error("Неверный код"),
              })
            }
            loading={disable.isPending}
          >
            Отключить 2FA
          </Button>
        </Space>
      </Card>
    );
  }

  return (
    <Card
      size="small"
      title="Двухфакторная защита (2FA)"
      style={{ marginBottom: 16 }}
    >
      {!setupData ? (
        <Space wrap align="center">
          <Tag>Выключена</Tag>
          <Text type="secondary">
            Защитите свой вход кодом из приложения-аутентификатора.
          </Text>
          <Button
            type="primary"
            onClick={() =>
              setup.mutate(undefined, {
                onSuccess: (r) =>
                  setSetupData({ secret: r.secret, otpauthUrl: r.otpauthUrl }),
                onError: () => message.error("Не удалось"),
              })
            }
            loading={setup.isPending}
          >
            Включить 2FA
          </Button>
        </Space>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <QRCode value={setupData.otpauthUrl} size={172} />
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Сканируйте в приложении
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Paragraph style={{ marginBottom: 8 }}>
              <b>1.</b> Откройте Google Authenticator / 1Password и отсканируйте
              QR (или добавьте ключ вручную).
            </Paragraph>
            <Paragraph style={{ marginBottom: 12 }}>
              <Text type="secondary">Ключ вручную:</Text>{" "}
              <Text code copyable>
                {setupData.secret}
              </Text>
            </Paragraph>
            <Paragraph style={{ marginBottom: 8 }}>
              <b>2.</b> Введите 6-значный код из приложения:
            </Paragraph>
            <Space>
              <Input
                placeholder="123456"
                style={{ width: 160 }}
                maxLength={6}
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button
                type="primary"
                onClick={() =>
                  enable.mutate(code, {
                    onSuccess: () => {
                      message.success("2FA включена");
                      setSetupData(null);
                      setCode("");
                    },
                    onError: () => message.error("Неверный код"),
                  })
                }
                loading={enable.isPending}
              >
                Подтвердить
              </Button>
              <Button
                type="text"
                onClick={() => {
                  setSetupData(null);
                  setCode("");
                }}
              >
                Отмена
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Card>
  );
};
