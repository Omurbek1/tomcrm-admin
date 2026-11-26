import { Alert, Button, Form, Input, Typography, type InputRef } from "antd";
import { useRef, useState } from "react";

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
  const [loading, setLoading] = useState(false);
  // Ошибка — рядом с полями и не исчезает сама (раньше — всплывашка на 3 с).
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<InputRef>(null);
  const codeRef = useRef<InputRef>(null);
  // Шаг с кодом показываем ТОЛЬКО если у админа включена 2FA (бэк вернёт
  // TOTP_REQUIRED). Нет 2FA → обычный вход по логину/паролю.
  const [needCode, setNeedCode] = useState(false);
  const [form] = Form.useForm();

  const submit = async (values: {
    login: string;
    password: string;
    totpCode?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<LoginOk>("/api/platform/login", values);
      setToken(data.token);
      setPermissions(data.permissions ?? []);
      onLoggedIn();
    } catch (e: unknown) {
      const err = e as {
        response?: { status?: number; data?: { message?: string } };
      };
      const msg = err.response?.data?.message ?? "";
      const status = err.response?.status;
      if (!err.response) {
        setError("Нет связи с сервером — проверьте интернет и повторите");
      } else if (status === 429) {
        setError("Слишком много попыток входа — подождите минуту");
      } else if (status && status >= 500) {
        setError("Сервер временно недоступен — попробуйте чуть позже");
      } else if (msg === "TOTP_REQUIRED") {
        setNeedCode(true);
      } else if (msg.includes("2FA")) {
        // Неверный код: очищаем и ставим курсор — следующие 6 цифр уйдут сами.
        setError("Код не подошёл — введите новый из приложения");
        form.setFieldValue("totpCode", "");
        setTimeout(() => codeRef.current?.focus(), 0);
      } else {
        setError("Неверный логин или пароль");
        setTimeout(() => passwordRef.current?.focus({ cursor: "all" }), 0);
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

        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          requiredMark={false}
          size="large"
        >
          <Form.Item
            name="login"
            label="Логин"
            rules={[{ required: true, message: "Введите логин" }]}
          >
            <Input autoComplete="username" placeholder="admin" autoFocus />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: "Введите пароль" }]}
            style={{ marginBottom: needCode ? 12 : 24 }}
          >
            <Input.Password
              ref={passwordRef}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Form.Item>

          {needCode && (
            <div className="login-2fa">
              <Form.Item
                name="totpCode"
                label="Код из приложения-аутентификатора"
                extra="Google Authenticator, 1Password и т. п. — 6 цифр"
                rules={[
                  { required: true, message: "Введите 6-значный код" },
                  { len: 6, message: "Код из 6 цифр" },
                ]}
              >
                <Input
                  ref={codeRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  autoFocus
                  onChange={(e) => {
                    // Только цифры (вставка «123 456» тоже), 6 цифр — вход сам.
                    const code = e.target.value.replace(/\D/g, "").slice(0, 6);
                    form.setFieldValue("totpCode", code);
                    if (code.length === 6 && !loading) form.submit();
                  }}
                  placeholder="123 456"
                  style={{ letterSpacing: 6, textAlign: "center" }}
                />
              </Form.Item>
            </div>
          )}

          {error ? (
            <Alert
              type="error"
              showIcon
              role="alert"
              title={error}
              style={{ marginBottom: 12 }}
            />
          ) : null}
          <Button type="primary" htmlType="submit" block loading={loading}>
            {needCode ? "Подтвердить вход" : "Войти"}
          </Button>

          {needCode && (
            <Button
              type="link"
              block
              style={{ marginTop: 8 }}
              onClick={() => {
                setNeedCode(false);
                setError(null);
              }}
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
