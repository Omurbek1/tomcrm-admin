import { App, Button, Form, Input, Typography } from "antd";
import { useState } from "react";

import { api, setPermissions, setToken } from "../api/client";

const { Title, Text } = Typography;

interface Props {
  onLoggedIn: () => void;
}

interface LoginOk {
  token: string;
  permissions: string[];
}

export const LoginPage = ({ onLoggedIn }: Props) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  // Шаг с кодом показываем ТОЛЬКО если у админа включена 2FA (бэк вернёт
  // TOTP_REQUIRED). Нет 2FA → обычный вход по логину/паролю.
  const [needCode, setNeedCode] = useState(false);

  const submit = async (values: {
    login: string;
    password: string;
    totpCode?: string;
  }) => {
    setLoading(true);
    try {
      const { data } = await api.post<LoginOk>("/api/platform/login", values);
      setToken(data.token);
      setPermissions(data.permissions ?? []);
      onLoggedIn();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "";
      if (msg === "TOTP_REQUIRED") {
        setNeedCode(true);
        message.info("Введите код из приложения-аутентификатора");
      } else if (msg.includes("2FA")) {
        message.error("Неверный код 2FA");
      } else {
        message.error("Неверный логин или пароль");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">T</div>
          <div>
            <Title level={4} style={{ margin: 0, lineHeight: 1.1 }}>
              TomStore
            </Title>
            <Text type="secondary">Панель платформы</Text>
          </div>
        </div>

        <Form layout="vertical" onFinish={submit} requiredMark={false} size="large">
          <Form.Item
            name="login"
            label="Логин"
            rules={[{ required: true, message: "Введите логин" }]}
          >
            <Input autoComplete="username" placeholder="admin" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: "Введите пароль" }]}
            style={{ marginBottom: needCode ? 12 : 24 }}
          >
            <Input.Password autoComplete="current-password" placeholder="••••••••" />
          </Form.Item>

          {needCode && (
            <div className="login-2fa">
              <Form.Item
                name="totpCode"
                label="Код двухфакторной защиты"
                rules={[
                  { required: true, message: "Введите 6-значный код" },
                  { len: 6, message: "Код из 6 цифр" },
                ]}
              >
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="123 456"
                  style={{ letterSpacing: 6, textAlign: "center" }}
                />
              </Form.Item>
            </div>
          )}

          <Button type="primary" htmlType="submit" block loading={loading}>
            {needCode ? "Подтвердить вход" : "Войти"}
          </Button>

          {needCode && (
            <Button
              type="link"
              block
              style={{ marginTop: 8 }}
              onClick={() => setNeedCode(false)}
            >
              ← Назад
            </Button>
          )}
        </Form>

        <Text
          type="secondary"
          style={{
            display: "block",
            marginTop: 18,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Доступ только для операторов платформы TomStore
        </Text>
      </div>
    </div>
  );
};
